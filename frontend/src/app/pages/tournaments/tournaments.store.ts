import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  TournamentSummary,
  TournamentTeamDetail,
  TournamentViewModel,
  TournamentMatchView,
  TournamentMatchTeamSlot,
  UpdateMatchRequest
} from './tournaments.models';
import { TournamentsApiService } from '@app/services/api/tournaments.service';
import { MatchesService, MatchModel } from '@app/services/api/matches.service';

const DEFAULT_TOURNAMENT_ID = 'cup-current';

function ensureTeamIndex(t: TournamentViewModel): Record<string, TournamentTeamDetail> {
  if (t.teamsIndex && Object.keys(t.teamsIndex).length) return t.teamsIndex;
  return t.teams.reduce<Record<string, TournamentTeamDetail>>((acc, team) => {
    acc[team.id] = team;
    return acc;
  }, {});
}

/** Hidrata un slot con info del team index (palette, detail) cuando sea posible */
function hydrateFromIndex(slot: TournamentMatchTeamSlot, index: Record<string, TournamentTeamDetail>): TournamentMatchTeamSlot {
  if (!slot?.id) return slot;
  const d = index[slot.id];
  if (!d) return slot;
  return {
    ...slot,
    detail: d,
    palette: slot.palette ?? d.palette
  };
}

/** Normaliza status a scheduled|live|finished en minúsculas */
function normStatus(s?: string): 'scheduled'|'live'|'finished' {
  const v = (s ?? '').toLowerCase().trim();
  return (v === 'live' || v === 'finished') ? v : 'scheduled';
}

@Injectable({ providedIn: 'root' })
export class TournamentsStore {
  private readonly api = inject(TournamentsApiService);
  private readonly matchesApi = inject(MatchesService);

  private readonly summariesState = signal<TournamentSummary[]>([]);
  private readonly selectedTournamentId = signal<string | null>(null);
  private readonly tournamentDetailState = signal<TournamentViewModel | null>(null);
  private readonly focusedTeamId = signal<string | null>(null);

  private readonly loadingSummariesState = signal<boolean>(false);
  private readonly loadingDetailState = signal<boolean>(false);
  private readonly errorState = signal<string | null>(null);

  readonly tournaments = computed<TournamentSummary[]>(() => this.summariesState());
  readonly selectedTournament = computed<TournamentViewModel | null>(() => this.tournamentDetailState());
  readonly loadingSummaries = computed<boolean>(() => this.loadingSummariesState());
  readonly loadingDetail = computed<boolean>(() => this.loadingDetailState());
  readonly loading = computed<boolean>(() => this.loadingSummariesState() || this.loadingDetailState());
  readonly error = computed<string | null>(() => this.errorState());

  readonly activeTeam = computed<TournamentTeamDetail | null>(() => {
    const teamId = this.focusedTeamId();
    const tournament = this.tournamentDetailState();
    if (!teamId || !tournament) return null;
    const index = ensureTeamIndex(tournament);
    return index[teamId] ?? null;
  });

  constructor() {
    void this.loadTournaments();
  }

  async refresh(): Promise<void> {
    await this.loadTournaments(true);
  }

  async selectTournament(id: string): Promise<void> {
    if (id === this.selectedTournamentId()) return;
    await this.loadTournament(id);
  }

  focusTeam(id: string | null): void {
    this.focusedTeamId.set(id);
  }

  // ---------- Mutaciones de negocio ----------
  async updateMatchResult(tournamentId: string, matchId: string, scoreA: number, scoreB: number): Promise<void> {
    const payload: UpdateMatchRequest = { scoreA, scoreB, status: 'finished' };
    try {
      this.errorState.set(null);
      const updated = await this.api.updateMatch(tournamentId, matchId, payload);
      const normalized: TournamentViewModel = { ...updated, teamsIndex: ensureTeamIndex(updated) };
      const enriched = await this.enrichAllSlots(normalized);
      this.tournamentDetailState.set(enriched);
      this.selectedTournamentId.set(enriched.id);
      this.syncSummary(enriched);
    } catch (error) {
      console.error('Failed to update match result', error);
      this.errorState.set('No se pudo actualizar el resultado del partido.');
    }
  }

  async assignMatchToSlot(groupId: string, slotIndex: number, matchId: number | null): Promise<void> {
    const tournamentId = this.selectedTournamentId() ?? DEFAULT_TOURNAMENT_ID;
    try {
      const updated = await this.api.assignMatchToSlot(tournamentId, groupId, slotIndex, matchId);
      const normalized: TournamentViewModel = { ...updated, teamsIndex: ensureTeamIndex(updated) };
      const enriched = await this.enrichAllSlots(normalized);
      this.tournamentDetailState.set(enriched);
      this.selectedTournamentId.set(enriched.id);
      this.syncSummary(enriched);
    } catch (error: any) {
      const message = error?.error?.error ?? error?.message ?? 'No se pudo asignar el partido al bracket.';
      console.error('Failed to assign match to slot', message);
      this.errorState.set(message);
      throw error;
    }
  }

  // ---------- Cargas ----------
  private async loadTournaments(forceRefresh = false): Promise<void> {
    this.loadingSummariesState.set(true);
    this.errorState.set(null);
    try {
      const summaries = await this.api.listTournaments(forceRefresh);
      this.summariesState.set(summaries);

      const preferredId = this.selectedTournamentId();
      const targetId = preferredId && summaries.some((i) => i.id === preferredId)
        ? preferredId
        : summaries[0]?.id ?? null;

      if (targetId) {
        await this.loadTournament(targetId);
      } else {
        this.tournamentDetailState.set(null);
        this.selectedTournamentId.set(null);
      }
    } catch (error) {
      console.error('Failed to load tournaments', error);
      this.errorState.set('No se pudieron cargar los torneos. Inténtalo nuevamente.');
    } finally {
      this.loadingSummariesState.set(false);
    }
  }

  private async loadTournament(id: string): Promise<void> {
    this.loadingDetailState.set(true);
    this.errorState.set(null);
    try {
      const detail = await this.api.getTournament(id);
      const normalized: TournamentViewModel = { ...detail, teamsIndex: ensureTeamIndex(detail) };
      const enriched = await this.enrichAllSlots(normalized);
      this.tournamentDetailState.set(enriched);
      this.selectedTournamentId.set(id);
      this.focusedTeamId.set(null);
      this.syncSummary(enriched);
    } catch (error) {
      console.error('Failed to load tournament detail', error);
      this.errorState.set('No se pudo cargar el torneo seleccionado.');
    } finally {
      this.loadingDetailState.set(false);
    }
  }

  // ---------- Enriquecimiento con datos de matches ----------
  private async enrichAllSlots(vm: TournamentViewModel): Promise<TournamentViewModel> {
    const all = await firstValueFrom(this.matchesApi.getMatches());
    const idx = new Map<number, MatchModel>();
    for (const m of all) idx.set(Number(m.id), m);

    const nextGroups = vm.groups.map(g => {
      const matches = g.matches.map(slot => {
        if (slot.isPlaceholder) return slot;
        const numId = Number(slot.id);
        if (!Number.isFinite(numId)) return slot;
        const info = idx.get(numId);
        return info ? this.applyMatchToSlot(slot, info) : slot;
      });
      return { ...g, matches };
    });

    let nextFinal: TournamentMatchView | null = vm.final ?? null;
    if (nextFinal && !nextFinal.isPlaceholder) {
      const numId = Number(nextFinal.id);
      if (Number.isFinite(numId)) {
        const info = idx.get(numId);
        if (info) nextFinal = this.applyMatchToSlot(nextFinal, info);
      }
    }

    // Derivar clasificados y semi virtual (con palettes y detail del index)
    const progressed = this.computeProgression({ ...vm, groups: nextGroups, final: nextFinal });
    return progressed;
  }

  private applyMatchToSlot(slot: TournamentMatchView, info: MatchModel): TournamentMatchView {
    const fmt = (iso?: string | null) =>
      iso
        ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
            .format(new Date(iso))
        : 'Sin fecha';

    const safeNum = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

    const homeScore = safeNum(info.homeScore);
    const awayScore = safeNum(info.awayScore);

    const status = normStatus(info.status);

    const winnerId =
      status === 'finished' && homeScore !== null && awayScore !== null && homeScore !== awayScore
        ? String(homeScore > awayScore ? info.homeTeamId : info.awayTeamId)
        : null;

    const makeTeam = (
      orig: TournamentMatchTeamSlot,
      idNum: number | null,
      name: string | undefined,
      score: number | null
    ): TournamentMatchTeamSlot => ({
      ...orig,
      id: idNum ? String(idNum) : null,
      displayName: name && name.trim() ? name : (orig.displayName || 'Por definir'),
      score,
      isPlaceholder: false
    });

    return {
      ...slot,
      teamA: makeTeam(slot.teamA, info.homeTeamId || null, info.homeTeamName, homeScore),
      teamB: makeTeam(slot.teamB, info.awayTeamId || null, info.awayTeamName, awayScore),
      scheduledAtUtc: info.dateTime || slot.scheduledAtUtc || null,
      status,
      statusLabel: status,
      scheduleLabel: info.dateTime ? fmt(info.dateTime) : (slot.scheduleLabel || 'Sin fecha'),
      winnerId,
      isPlaceholder: false
    };
  }

  private computeProgression(vm: TournamentViewModel): TournamentViewModel {
    const tIndex = ensureTeamIndex(vm);

    const nextGroups = vm.groups.map(g => {
      let qualifiers: TournamentMatchTeamSlot[] = Array.isArray(g.qualifiers) ? [...g.qualifiers] : [];

      for (const m of g.matches) {
        const a = m.teamA, b = m.teamB;
        const aOk = !!a && a.score !== null;
        const bOk = !!b && b.score !== null;
        if (normStatus(m.status) === 'finished' && aOk && bOk) {
          if (a!.score! > b!.score!) qualifiers.push(a!);
          else if (b!.score! > a!.score!) qualifiers.push(b!);
        }
      }

      // Unificar por id/displayName y quedarnos con 2
      const uniq = new Map<string, TournamentMatchTeamSlot>();
      for (const w of qualifiers) {
        const key = (w.id ?? w.displayName) as string;
        if (!key) continue;
        // hidratar palette/detail desde el índice
        uniq.set(key, hydrateFromIndex(w, tIndex));
      }
      qualifiers = Array.from(uniq.values()).slice(0, 2);

      let semi = g.semiFinal ?? null;
      if (!semi && qualifiers.length === 2) {
        semi = {
          id: `semi:${g.id}`,
          label: 'Semi-Finals',
          round: 'semi',
          status: 'scheduled',
          statusLabel: 'scheduled',
          scheduleLabel: 'Por programar',
          teamA: qualifiers[0],
          teamB: qualifiers[1],
          winnerId: null,
          groupId: g.id,
          isPlaceholder: true
        };
      }

      return { ...g, qualifiers, semiFinal: semi };
    });

    return { ...vm, groups: nextGroups };
  }

  // ---------- Sincroniza resumen ----------
  private syncSummary(detail: TournamentViewModel): void {
    this.summariesState.update(items =>
      items.map(item =>
        item.id === detail.id
          ? {
              ...item,
              progress: detail.progress,
              matchesPlayed: detail.matchesPlayed,
              totalMatches: detail.totalMatches,
              scheduleLabel: detail.scheduleLabel
            }
          : item
      )
    );
  }
}
