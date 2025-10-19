const STATUS_LABEL = {
  scheduled: 'Programado',
  live: 'En juego',
  finished: 'Finalizado'
};

const ROUND_WEIGHT = {
  group: 0,
  semi: 1,
  final: 2
};

function formatDateRange(startUtc, endUtc) {
  const start = new Date(startUtc);
  const end = new Date(endUtc);
  const sameMonth = start.getUTCFullYear() === end.getUTCFullYear() && start.getUTCMonth() === end.getUTCMonth();

  const dateFormatter = new Intl.DateTimeFormat('es-MX', {
    month: 'short',
    day: 'numeric'
  });

  const startLabel = dateFormatter.format(start);
  const endLabel = sameMonth
    ? new Intl.DateTimeFormat('es-MX', { day: 'numeric' }).format(end)
    : dateFormatter.format(end);

  return `${startLabel} - ${endLabel}`;
}

function formatDateTime(utc) {
  if (!utc) {
    return 'Horario por definir';
  }

  const date = new Date(utc);
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

function buildMatchTeam(match, slot, teams) {
  const teamId = slot === 'teamA' ? match.teamAId : match.teamBId;
  const originLabel = slot === 'teamA' ? match.teamAOrigin : match.teamBOrigin;
  const score = slot === 'teamA' ? match.scoreA : match.scoreB;

  if (!teamId) {
    return {
      id: null,
      displayName: originLabel ?? 'Por definir',
      score,
      isPlaceholder: true,
      originLabel: originLabel ?? null,
      detail: null,
      palette: null
    };
  }

  const detail = teams.get(teamId) ?? null;

  if (!detail) {
    return {
      id: teamId,
      displayName: originLabel ?? 'Por definir',
      score,
      isPlaceholder: true,
      originLabel: originLabel ?? null,
      detail: null,
      palette: null
    };
  }

  return {
    id: detail.id,
    displayName: detail.name,
    shortName: detail.shortName,
    seed: detail.seed,
    record: detail.record,
    score,
    isPlaceholder: false,
    originLabel: originLabel ?? null,
    detail,
    palette: detail.palette
  };
}

function buildMatchView(match, teams) {
  const teamA = buildMatchTeam(match, 'teamA', teams);
  const teamB = buildMatchTeam(match, 'teamB', teams);

  return {
    id: match.id,
    label: match.label,
    round: match.round,
    status: match.status,
    statusLabel: STATUS_LABEL[match.status],
    scheduleLabel: formatDateTime(match.scheduledAtUtc),
    scheduledAtUtc: match.scheduledAtUtc,
    venue: match.venue,
    broadcast: match.broadcast,
    teamA,
    teamB,
    winnerId: match.winnerId
  };
}

function computeWinner(match) {
  if (match.status !== 'finished') {
    return null;
  }

  if (typeof match.scoreA === 'number' && typeof match.scoreB === 'number') {
    if (match.scoreA > match.scoreB && match.teamAId) {
      return match.teamAId;
    }
    if (match.scoreB > match.scoreA && match.teamBId) {
      return match.teamBId;
    }
  }

  return null;
}

function mapToObject(map) {
  const result = {};
  for (const [key, value] of map.entries()) {
    result[key] = value;
  }
  return result;
}

function buildView(state) {
  const teamsMap = new Map(state.teams.map((team) => [team.id, team]));
  const matchesMap = new Map();

  for (const match of state.matches) {
    matchesMap.set(match.id, {
      ...match,
      next: Array.isArray(match.next) ? match.next.map((link) => ({ ...link })) : [],
      winnerId: null
    });
  }

  const sortedMatches = Array.from(matchesMap.values()).sort(
    (a, b) => ROUND_WEIGHT[a.round] - ROUND_WEIGHT[b.round]
  );

  for (const match of sortedMatches) {
    const winner = computeWinner(match);
    match.winnerId = winner;

    if (!winner || !match.next?.length) {
      continue;
    }

    for (const link of match.next) {
      const target = matchesMap.get(link.matchId);
      if (!target) {
        continue;
      }

      if (link.slot === 'teamA') {
        target.teamAId = winner;
      } else {
        target.teamBId = winner;
      }
    }
  }

  const matchViews = new Map();

  for (const match of matchesMap.values()) {
    matchViews.set(match.id, buildMatchView(match, teamsMap));
  }

  const groups = state.groups.map((group) => {
    const matches = group.initialMatchIds
      .map((id) => matchViews.get(id))
      .filter(Boolean);

    const qualifierMap = new Map();

    for (const match of matches) {
      if (!match.winnerId) {
        continue;
      }

      const candidate = match.winnerId === match.teamA.id ? match.teamA : match.teamB;
      if (!candidate || candidate.isPlaceholder) {
        continue;
      }

      qualifierMap.set(match.winnerId, candidate);
    }

    const semiFinal = matchViews.get(group.semiFinalMatchId) ?? null;

    return {
      id: group.id,
      name: group.name,
      color: group.color,
      matches,
      qualifiers: Array.from(qualifierMap.values()),
      semiFinal
    };
  });

  const finalMatch = matchViews.get(state.finalMatchId) ?? null;
  let winner = null;

  if (finalMatch?.winnerId) {
    winner = finalMatch.winnerId === finalMatch.teamA.id ? finalMatch.teamA : finalMatch.teamB;
    if (winner?.isPlaceholder) {
      winner = null;
    }
  }

  const matchesPlayed = sortedMatches.filter((match) => match.status === 'finished').length;
  const totalMatches = sortedMatches.length;
  const progress = totalMatches === 0 ? 0 : matchesPlayed / totalMatches;

  return {
    id: state.id,
    code: state.code,
    name: state.name,
    heroTitle: state.heroTitle,
    season: state.season,
    location: state.location,
    venue: state.venue,
    description: state.description,
    scheduleLabel: formatDateRange(state.startDateUtc, state.endDateUtc),
    updatedLabel: formatDateTime(state.updatedAtUtc),
    domain: state.domain,
    progress,
    matchesPlayed,
    totalMatches,
    summary: `${state.teams.length} equipos · ${totalMatches} partidos`,
    groups,
    final: finalMatch ?? null,
    winner,
    teams: state.teams,
    teamsIndex: mapToObject(teamsMap)
  };
}

function buildSummary(view) {
  return {
    id: view.id,
    code: view.code,
    name: view.name,
    heroTitle: view.heroTitle,
    season: view.season,
    location: view.location,
    scheduleLabel: view.scheduleLabel,
    progress: view.progress,
    matchesPlayed: view.matchesPlayed,
    totalMatches: view.totalMatches
  };
}

module.exports = {
  STATUS_LABEL,
  buildView,
  buildSummary
};
