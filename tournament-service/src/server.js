const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors());

const TEAMS_SERVICE_BASE_URL =
  process.env.TEAMS_SERVICE_BASE_URL || 'http://teams-service:8082';
const MATCHES_SERVICE_BASE_URL =
  process.env.MATCHES_SERVICE_BASE_URL || 'http://matches-service:8081';
const PORT = parseInt(process.env.PORT || '8083', 10);
const CACHE_TTL_MS = 60 * 1000;

const STATUS_LABELS = {
  scheduled: 'Programado',
  live: 'En juego',
  finished: 'Finalizado'
};

let tournamentState = null;

/* ------------------------------------------------------- *
 * Helpers
 * ------------------------------------------------------- */

function paletteAt(index) {
  const swatches = [
    { primary: '#2563eb', secondary: '#60a5fa' },
    { primary: '#f97316', secondary: '#fed7aa' },
    { primary: '#10b981', secondary: '#6ee7b7' },
    { primary: '#7c3aed', secondary: '#c4b5fd' },
    { primary: '#14b8a6', secondary: '#5eead4' },
    { primary: '#0ea5e9', secondary: '#93c5fd' },
    { primary: '#f87171', secondary: '#fecaca' },
    { primary: '#a855f7', secondary: '#d8b4fe' }
  ];
  return swatches[index % swatches.length];
}

function normalizeStatus(raw) {
  const value = (raw || '').toString().toLowerCase();
  if (value === 'live' || value === 'finished' || value === 'scheduled') {
    return value;
  }
  return 'scheduled';
}

function formatScheduleLabel(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return 'Sin fecha';
  }
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function formatUpdatedLabel(date) {
  return `Actualizado ${new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date)}`;
}

function placeholderSlot(label) {
  return {
    id: null,
    displayName: label,
    score: null,
    isPlaceholder: true,
    detail: null,
    palette: null
  };
}

function createTeamDetail(raw, index) {
  const palette = paletteAt(index);
  return {
    id: String(raw.id),
    name: raw.name || `Equipo ${raw.id}`,
    shortName: (raw.acronym || raw.name || `EQ${raw.id}`).slice(0, 3).toUpperCase(),
    city: raw.city || null,
    coach: raw.coach || null,
    seed: index + 1,
    record: '0-0',
    streak: 'N/A',
    palette,
    narrative: `El conjunto ${raw.name || raw.id} representa a ${
      raw.city || 'la liga'
    } dirigido por ${raw.coach || 'su cuerpo técnico actual'}.`,
    players: [
      `${raw.name || raw.id} Player 1`,
      `${raw.name || raw.id} Player 2`,
      `${raw.name || raw.id} Player 3`
    ],
    stats: [
      { label: 'PPG', value: (70 + index * 2).toFixed(1) },
      { label: 'RPG', value: (34 + index).toFixed(1) },
      { label: 'APG', value: (18 + index).toFixed(1) }
    ]
  };
}

function teamSlot(detail) {
  return {
    id: detail.id,
    displayName: detail.name,
    shortName: detail.shortName,
    seed: detail.seed,
    record: detail.record,
    score: null,
    isPlaceholder: false,
    originLabel: null,
    detail,
    palette: detail.palette
  };
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `Request to ${url} failed with ${response.status}: ${text}`.trim()
    );
  }
  return response.json();
}

async function fetchTeams() {
  const url = new URL('/api/teams', TEAMS_SERVICE_BASE_URL);
  url.searchParams.set('page', '0');
  url.searchParams.set('size', '200');

  const payload = await fetchJson(url);
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

async function fetchMatches() {
  const url = new URL('/api/matches', MATCHES_SERVICE_BASE_URL);
  const payload = await fetchJson(url);
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.value)) return payload.value;
  return [];
}

async function fetchMatchById(id) {
  const url = new URL(`/api/matches/${id}`, MATCHES_SERVICE_BASE_URL);
  return fetchJson(url);
}

async function scheduleMatch(homeTeamId, awayTeamId, scheduledAt) {
  const url = new URL('/api/matches/programar', MATCHES_SERVICE_BASE_URL);
  const iso = scheduledAt.toISOString();
  const [date, timeWithMs] = iso.split('T');
  const time = timeWithMs.slice(0, 5);
  const payload = {
    homeTeamId,
    awayTeamId,
    date,
    time,
    quarterDurationSeconds: 600
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.warn(
        `[tournament-service] matches-service responded ${response.status}: ${text}`
      );
      return null;
    }
    const match = await response.json();
    return match?.id ?? null;
  } catch (error) {
    console.warn(
      '[tournament-service] unable to schedule match',
      error?.message || error
    );
    return null;
  }
}

async function finishMatchInMatchesService(matchId, scoreA, scoreB) {
  if (!matchId) return;
  const url = new URL(`/api/matches/${matchId}/finish`, MATCHES_SERVICE_BASE_URL);
  try {
    await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        homeScore: scoreA ?? undefined,
        awayScore: scoreB ?? undefined
      })
    });
  } catch (error) {
    console.warn(
      `[tournament-service] finish match ${matchId} failed`,
      error?.message || error
    );
  }
}

function createMatchView(match, teamDetailsMap) {
  const status = normalizeStatus(match.status);
  const statusLabel = STATUS_LABELS[status] ?? STATUS_LABELS.scheduled;

  const homeDetail =
    teamDetailsMap.get(String(match.homeTeamId)) ??
    createTeamDetail(
      { id: match.homeTeamId, name: `Equipo ${match.homeTeamId}` },
      teamDetailsMap.size
    );
  const awayDetail =
    teamDetailsMap.get(String(match.awayTeamId)) ??
    createTeamDetail(
      { id: match.awayTeamId, name: `Equipo ${match.awayTeamId}` },
      teamDetailsMap.size + 1
    );

  teamDetailsMap.set(homeDetail.id, homeDetail);
  teamDetailsMap.set(awayDetail.id, awayDetail);

  const scheduledAt = match.dateTime ? new Date(match.dateTime) : null;
  const scheduleLabel = scheduledAt
    ? formatScheduleLabel(scheduledAt)
    : 'Sin fecha';

  const view = {
    id: String(match.id),
    label: match.label || 'Jornada',
    round: (match.round || 'group'),
    status,
    statusLabel,
    scheduleLabel,
    scheduledAtUtc: scheduledAt ? scheduledAt.toISOString() : null,
    venue: match.venue || 'Estadio Principal',
    broadcast: match.broadcast || null,
    teamA: {
      ...teamSlot(homeDetail),
      score:
        typeof match.homeScore === 'number' ? match.homeScore : null,
      isPlaceholder: false
    },
    teamB: {
      ...teamSlot(awayDetail),
      score:
        typeof match.awayScore === 'number' ? match.awayScore : null,
      isPlaceholder: false
    },
    winnerId: null
  };

  if (
    status === 'finished' &&
    view.teamA.score !== null &&
    view.teamB.score !== null
  ) {
    if (view.teamA.score > view.teamB.score) {
      view.winnerId = view.teamA.id;
    } else if (view.teamB.score > view.teamA.score) {
      view.winnerId = view.teamB.id;
    }
  }

  return {
    view,
    serviceMatchId: match.id
  };
}

function determineGroupResults(matchViews) {
  const winners = [];
  const seen = new Set();

  for (const match of matchViews) {
    if (
      match.status === 'finished' &&
      match.teamA.score !== null &&
      match.teamB.score !== null
    ) {
      const winner =
        match.teamA.score > match.teamB.score
          ? match.teamA
          : match.teamB.score > match.teamA.score
          ? match.teamB
          : null;
      if (winner && !seen.has(winner.id)) {
        winners.push(winner);
        seen.add(winner.id);
      }
    }
  }

  const champion =
    winners.length > 0 ? winners[winners.length - 1] : null;

  return { winners, champion };
}

async function buildFinalView({
  championA,
  championB,
  usedMatchIds,
  matches,
  teamDetailsMap
}) {
  if (!championA || !championB) {
    return {
      view: {
        id: 'final-placeholder',
        label: 'Final',
        round: 'final',
        status: 'scheduled',
        statusLabel: 'Pendiente',
        scheduleLabel: 'Esperando ganadores',
        scheduledAtUtc: null,
        venue: 'Arena Nacional',
        broadcast: null,
        teamA: championA ?? placeholderSlot('Ganador Grupo A'),
        teamB: championB ?? placeholderSlot('Ganador Grupo B'),
        winnerId: null
      },
      serviceMatchId: null
    };
  }

  const targetPair = new Set([championA.id, championB.id]);
  const existing = matches.find((match) => {
    const idString = String(match.id);
    if (usedMatchIds.has(idString)) return false;
    const teams = new Set([
      String(match.homeTeamId),
      String(match.awayTeamId)
    ]);
    return (
      teams.size === 2 &&
      teams.has(championA.id) &&
      teams.has(championB.id)
    );
  });

  let finalMatchRecord = existing;

  if (!finalMatchRecord) {
    const latestGroupDate = [...usedMatchIds]
      .map((id) => matches.find((m) => String(m.id) === id))
      .filter(Boolean)
      .map((match) => new Date(match.dateTime).getTime())
      .reduce((max, value) => Math.max(max, value || 0), Date.now());

    const scheduledAt = new Date(latestGroupDate + 24 * 60 * 60 * 1000);
    const newMatchId = await scheduleMatch(
      Number(championA.id),
      Number(championB.id),
      scheduledAt
    );
    if (newMatchId) {
      try {
        finalMatchRecord = await fetchMatchById(newMatchId);
      } catch (error) {
        console.warn(
          '[tournament-service] final match fetch failed',
          error?.message || error
        );
        finalMatchRecord = {
          id: newMatchId,
          label: 'Final',
          round: 'final',
          status: 'Scheduled',
          dateTime: scheduledAt.toISOString(),
          homeTeamId: Number(championA.id),
          awayTeamId: Number(championB.id),
          homeScore: 0,
          awayScore: 0
        };
      }
    }
  }

  if (!finalMatchRecord) {
    return {
      view: {
        id: 'final-placeholder',
        label: 'Final',
        round: 'final',
        status: 'scheduled',
        statusLabel: 'Pendiente',
        scheduleLabel: 'Programar final',
        scheduledAtUtc: null,
        venue: 'Arena Nacional',
        broadcast: null,
        teamA: championA,
        teamB: championB,
        winnerId: null
      },
      serviceMatchId: null
    };
  }

  const { view, serviceMatchId } = createMatchView(
    {
      ...finalMatchRecord,
      label: finalMatchRecord.label || 'Final',
      round: finalMatchRecord.round || 'final'
    },
    teamDetailsMap
  );
  return { view, serviceMatchId };
}

async function buildTournamentState(forceRefresh = false) {
  if (
    tournamentState &&
    !forceRefresh &&
    Date.now() - tournamentState.createdAt < CACHE_TTL_MS
  ) {
    return tournamentState;
  }

  const [teams, matches] = await Promise.all([
    fetchTeams(),
    fetchMatches()
  ]);

  if (!matches.length) {
    throw new Error('No hay partidos programados todavía.');
  }

  const teamDetailsMap = new Map();
  teams.forEach((team, index) => {
    teamDetailsMap.set(
      String(team.id),
      createTeamDetail(team, index)
    );
  });

  const orderedMatches = matches
    .filter((match) => match.status)
    .sort((a, b) => {
      const da = new Date(a.dateTime || 0).getTime();
      const db = new Date(b.dateTime || 0).getTime();
      return da - db;
    });

  const groupMatchesPool = orderedMatches.slice(0, 4);
  const usedServiceMatchIds = new Set();

  const groupAViews = [];
  const groupBViews = [];

  groupMatchesPool.forEach((match, index) => {
    const label = `Jornada ${index + 1}`;
    const { view } = createMatchView(
      { ...match, label, round: 'group' },
      teamDetailsMap
    );
    usedServiceMatchIds.add(String(match.id));
    if (index % 2 === 0) {
      groupAViews.push(view);
    } else {
      groupBViews.push(view);
    }
  });

  if (groupAViews.length === 0) {
    groupAViews.push({
      id: 'placeholder-a-1',
      label: 'Jornada 1',
      round: 'group',
      status: 'scheduled',
      statusLabel: STATUS_LABELS.scheduled,
      scheduleLabel: 'Pendiente',
      scheduledAtUtc: null,
      venue: 'Estadio Principal',
      broadcast: null,
      teamA: placeholderSlot('Equipo A1'),
      teamB: placeholderSlot('Equipo A2'),
      winnerId: null
    });
  }
  if (groupBViews.length === 0) {
    groupBViews.push({
      id: 'placeholder-b-1',
      label: 'Jornada 1',
      round: 'group',
      status: 'scheduled',
      statusLabel: STATUS_LABELS.scheduled,
      scheduleLabel: 'Pendiente',
      scheduledAtUtc: null,
      venue: 'Estadio Principal',
      broadcast: null,
      teamA: placeholderSlot('Equipo B1'),
      teamB: placeholderSlot('Equipo B2'),
      winnerId: null
    });
  }

  const { winners: groupAWinners, champion: championA } =
    determineGroupResults(groupAViews);
  const { winners: groupBWinners, champion: championB } =
    determineGroupResults(groupBViews);

  const remainingMatches = orderedMatches.filter(
    (match) => !usedServiceMatchIds.has(String(match.id))
  );

  const finalInfo = await buildFinalView({
    championA,
    championB,
    usedMatchIds: usedServiceMatchIds,
    matches: remainingMatches,
    teamDetailsMap
  });

  if (finalInfo.serviceMatchId) {
    usedServiceMatchIds.add(String(finalInfo.serviceMatchId));
  }

  const matchLookup = {};
  for (const view of [...groupAViews, ...groupBViews]) {
    if (!view.id.startsWith('placeholder')) {
      matchLookup[view.id] = {
        view,
        serviceMatchId: Number(view.id)
      };
    }
  }

  if (finalInfo.serviceMatchId) {
    matchLookup[String(finalInfo.serviceMatchId)] = {
      view: finalInfo.view,
      serviceMatchId: finalInfo.serviceMatchId
    };
  }

  const matchViews = [
    ...groupAViews,
    ...groupBViews,
    finalInfo.view
  ];

  const matchesPlayed = matchViews.filter(
    (match) => match.status === 'finished'
  ).length;
  const totalMatches = matchViews.filter(
    (match) => !match.id.startsWith('placeholder')
  ).length;
  const progress =
    totalMatches > 0 ? matchesPlayed / totalMatches : 0;

  const detail = {
    id: 'cup-current',
    code: 'CUP-2025',
    name: 'Copa Invitacional',
    heroTitle: 'Copa Invitacional 2025',
    season: '2025',
    location: 'Sedes Oficiales',
    venue: 'Arena Nacional',
    description:
      'Torneo generado dinámicamente con los partidos programados actuales.',
    scheduleLabel: `${new Intl.DateTimeFormat('es-ES', {
      month: 'short'
    }).format(new Date())} ${new Date().getFullYear()} - ${new Intl.DateTimeFormat(
      'es-ES',
      { month: 'short' }
    ).format(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000))} ${new Date().getFullYear()}`,
    updatedLabel: formatUpdatedLabel(new Date()),
    domain: 'scoreboard.local',
    progress,
    matchesPlayed,
    totalMatches,
    summary:
      'Fase de grupos a un partido y gran final entre los líderes de cada grupo.',
    groups: [
      {
        id: 'group-a',
        name: 'Grupo A',
        color: paletteAt(0).secondary,
        matches: groupAViews,
        qualifiers: groupAWinners,
        semiFinal: null
      },
      {
        id: 'group-b',
        name: 'Grupo B',
        color: paletteAt(1).secondary,
        matches: groupBViews,
        qualifiers: groupBWinners,
        semiFinal: null
      }
    ],
    final: finalInfo.view,
    winner:
      finalInfo.view.status === 'finished' && finalInfo.view.winnerId
        ? finalInfo.view.winnerId === finalInfo.view.teamA.id
          ? finalInfo.view.teamA
          : finalInfo.view.teamB
        : null,
    teams: Array.from(teamDetailsMap.values()).slice(0, 16),
    teamsIndex: Object.fromEntries(teamDetailsMap)
  };

  const summary = {
    id: detail.id,
    code: detail.code,
    name: detail.name,
    season: detail.season,
    heroTitle: detail.heroTitle,
    location: detail.location,
    scheduleLabel: detail.scheduleLabel,
    progress: detail.progress,
    matchesPlayed: detail.matchesPlayed,
    totalMatches: detail.totalMatches
  };

  tournamentState = {
    summary,
    detail,
    matchLookup,
    createdAt: Date.now()
  };

  return tournamentState;
}

async function ensureState(forceRefresh = false) {
  try {
    return await buildTournamentState(forceRefresh);
  } catch (error) {
    console.error('[tournament-service] rebuild error', error?.message || error);
    throw error;
  }
}

/* ------------------------------------------------------- *
 * Routes
 * ------------------------------------------------------- */

app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

app.get('/api/tournaments', async (req, res) => {
  try {
    const force = req.query.refresh === 'true';
    const state = await ensureState(force);
    res.json([state.summary]);
  } catch (error) {
    res.status(502).json({ error: 'No se pudieron obtener los torneos.' });
  }
});

app.get('/api/tournaments/:id', async (req, res) => {
  try {
    const state = await ensureState(req.query.refresh === 'true');
    if (state.detail.id !== req.params.id) {
      return res.status(404).json({ error: 'Torneo no encontrado.' });
    }
    res.json(state.detail);
  } catch (error) {
    res.status(502).json({ error: 'No se pudo cargar el torneo solicitado.' });
  }
});

app.patch('/api/tournaments/:id/matches/:mid', async (req, res) => {
  try {
    const state = await ensureState(true);
    if (state.detail.id !== req.params.id) {
      return res.status(404).json({ error: 'Torneo no encontrado.' });
    }

    const matchMeta = state.matchLookup[req.params.mid];
    if (!matchMeta || !matchMeta.serviceMatchId) {
      return res
        .status(404)
        .json({ error: 'Partido no encontrado dentro del torneo.' });
    }

    const { scoreA = null, scoreB = null, status } = req.body || {};
    if (status === 'finished') {
      await finishMatchInMatchesService(
        matchMeta.serviceMatchId,
        scoreA,
        scoreB
      );
    }

    const refreshed = await ensureState(true);
    res.json(refreshed.detail);
  } catch (error) {
    console.error(
      '[tournament-service] update error',
      error?.message || error
    );
    res.status(502).json({ error: 'No se pudo actualizar el partido.' });
  }
});

app.listen(PORT, () => {
  console.log(`[tournament-service] listening on :${PORT}`);
});
