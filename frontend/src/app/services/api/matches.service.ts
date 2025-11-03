// src/app/services/api/matches.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, switchMap, of, shareReplay, tap } from 'rxjs';

// Ajusta la ruta si tu TeamService está en otro path
import { TeamService } from './team.service';

export type TeamSide = 'home' | 'away';

export interface MatchModel {
  id: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  foulsHome: number;
  foulsAway: number;
  quarter: number;
  timeRemaining: number;
  timerRunning: boolean;
  status: string;
  dateTime: string;
  quarterDurationSeconds?: number;
}

export interface ProgramMatchPayload {
  homeTeamId: number;
  awayTeamId: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  quarterDurationSeconds?: number;
}

interface ProgramMatchDto {
  homeTeamId: number;
  awayTeamId: number;
  dateMatch: string; // YYYY-MM-DDTHH:mm:00 (local, sin Z)
  quarterDurationSeconds?: number;
}

@Injectable({ providedIn: 'root' })
export class MatchesService {
  private readonly http = inject(HttpClient);
  private readonly teams = inject(TeamService);
  private readonly baseUrl = '/api/matches';

  /** Cache { teamId -> name } para enriquecer nombres cuando el back no los manda */
  private teamsIndexCache?: Map<number, string>;
  private teamsIndexLoading$?: Observable<Map<number, string>>;

  // -------------------------
  // Normalizador
  // -------------------------
  private normalize(api: any): MatchModel {
    const num = (...vals: any[]): number => {
      for (const v of vals) if (typeof v === 'number' && !Number.isNaN(v)) return v;
      return 0;
    };
    const bool = (...vals: any[]): boolean => {
      for (const v of vals) if (typeof v === 'boolean') return v;
      return false;
    };
    const s = (v: any): string => (typeof v === 'string' ? v : '');

    const nameFrom = (o: any): string | undefined =>
      o && typeof o === 'object'
        ? o.name ?? o.Name ?? o.teamName ?? o.TeamName ?? o.shortName ?? undefined
        : undefined;

    const statusRaw = s(api?.status ?? api?.state ?? 'scheduled').toLowerCase();
    const status =
      statusRaw === 'programado'
        ? 'scheduled'
        : statusRaw === 'en juego'
        ? 'live'
        : statusRaw === 'finalizado'
        ? 'finished'
        : (api?.status ?? 'scheduled');

    const homeTeamName =
      s(api?.homeTeamName) ||
      nameFrom(api?.homeTeam) ||
      nameFrom(api?.home) ||
      s(api?.homeName) ||
      '';

    const awayTeamName =
      s(api?.awayTeamName) ||
      nameFrom(api?.awayTeam) ||
      nameFrom(api?.away) ||
      s(api?.awayName) ||
      '';

    return {
      id: num(api?.id, api?.matchId),
      homeTeamId: num(api?.homeTeamId, api?.homeId, api?.homeTeam?.id, api?.home?.id),
      awayTeamId: num(api?.awayTeamId, api?.awayId, api?.awayTeam?.id, api?.away?.id),
      homeTeamName,
      awayTeamName,
      homeScore: num(api?.homeScore, api?.scoreHome, api?.scores?.home),
      awayScore: num(api?.awayScore, api?.scoreAway, api?.scores?.away),
      foulsHome: num(api?.foulsHome, api?.homeFouls, api?.fouls?.home),
      foulsAway: num(api?.foulsAway, api?.awayFouls, api?.fouls?.away),
      quarter: num(api?.quarter, api?.period, api?.timer?.quarter) || 1,
      timeRemaining: num(api?.timeRemaining, api?.timer?.remainingSeconds),
      timerRunning: bool(api?.timerRunning, api?.timer?.running),
      status,
      dateTime: s(api?.dateTime ?? api?.dateMatch ?? api?.date ?? ''),
      quarterDurationSeconds:
        num(api?.quarterDurationSeconds, api?.timer?.quarterDurationSeconds) || undefined
    };
  }

  // -------------------------
  // Índice de equipos (tolerante a {content:[]}, {data:[]}, etc.)
  // -------------------------
  private ensureTeamsIndex(): Observable<Map<number, string>> {
    if (this.teamsIndexCache) return of(this.teamsIndexCache);
    if (!this.teamsIndexLoading$) {
      this.teamsIndexLoading$ = this.teams.getTeams().pipe(
        map((res: any) => {
          const list: any[] = Array.isArray(res)
            ? res
            : Array.isArray(res?.content)
            ? res.content
            : Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res?.Data)
            ? res.Data
            : [];
          const idx = new Map<number, string>();
          for (const t of list) {
            const id =
              typeof t?.id === 'number'
                ? t.id
                : typeof t?.Id === 'number'
                ? t.Id
                : undefined;
            const name: string =
              t?.name ?? t?.Name ?? t?.teamName ?? t?.TeamName ?? t?.shortName ?? '';
            if (id != null && name) idx.set(id, name);
          }
          return idx;
        }),
        tap((idx) => (this.teamsIndexCache = idx)),
        shareReplay(1)
      );
    }
    return this.teamsIndexLoading$;
  }

  private enrichNames(matches: MatchModel[]): Observable<MatchModel[]> {
    const needs = matches.some(
      (m) =>
        (!m.homeTeamName || m.homeTeamName.toLowerCase() === 'local') ||
        (!m.awayTeamName || m.awayTeamName.toLowerCase() === 'visita')
    );
    if (!needs) return of(matches);

    return this.ensureTeamsIndex().pipe(
      map((idx) =>
        matches.map((m) => ({
          ...m,
          homeTeamName: m.homeTeamName || idx.get(m.homeTeamId) || 'Local',
          awayTeamName: m.awayTeamName || idx.get(m.awayTeamId) || 'Visita'
        }))
      )
    );
  }

  // -------------------------
  // Endpoints
  // -------------------------
  getMatches(): Observable<MatchModel[]> {
    return this.http.get<any>(this.baseUrl).pipe(
      map((res) => {
        const arr = Array.isArray(res)
          ? res
          : Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.Data)
          ? res.Data
          : [];
        return arr.map((x: any) => this.normalize(x));
      }),
      switchMap((list) => this.enrichNames(list))
    );
  }

  getMatch(matchId: number): Observable<MatchModel> {
    return this.http.get<any>(`${this.baseUrl}/${matchId}`).pipe(
      map((x) => this.normalize(x)),
      switchMap((m) => this.enrichNames([m])),
      map(([m]) => m)
    );
  }

  programMatch(payload: ProgramMatchPayload): Observable<MatchModel> {
    const { date, time, homeTeamId, awayTeamId, quarterDurationSeconds } = payload;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
      throw new Error('Fecha u hora inválida. Usa YYYY-MM-DD y HH:mm');
    }
    const dateMatch = `${date}T${time}:00`;
    const body: ProgramMatchDto = { homeTeamId, awayTeamId, dateMatch, quarterDurationSeconds };

    return this.http.post<any>(`${this.baseUrl}/programar`, body).pipe(
      map((x) => this.normalize(x)),
      switchMap((m) => this.enrichNames([m])),
      map(([m]) => m)
    );
  }

  addScore(matchId: number, team: TeamSide, points: number): Observable<MatchModel> {
    return this.resolveTeamId(matchId, team).pipe(
      switchMap((teamId) =>
        this.http.post<any>(`${this.baseUrl}/${matchId}/score`, { teamId, points })
      ),
      map((x) => this.normalize(x)),
      switchMap((m) => this.enrichNames([m])),
      map(([m]) => m)
    );
  }

  addFoul(matchId: number, team: TeamSide, amount: number = 1): Observable<MatchModel> {
    return this.resolveTeamId(matchId, team).pipe(
      switchMap((teamId) =>
        this.http.post<any>(`${this.baseUrl}/${matchId}/fouls/adjust`, { teamId, delta: amount })
      ),
      map((x) => this.normalize(x)),
      switchMap((m) => this.enrichNames([m])),
      map(([m]) => m)
    );
  }

  updateTimer(
    matchId: number,
    action: 'start' | 'pause' | 'resume' | 'reset',
    _timeRemaining?: number
  ): Observable<MatchModel> {
    if (action === 'start') {
      return this.getMatch(matchId).pipe(
        switchMap((m) => {
          const duration =
            (m.timeRemaining && m.timeRemaining > 0 ? m.timeRemaining : undefined) ??
            m.quarterDurationSeconds ??
            600;
          const body = { seconds: duration, quarterDurationSeconds: duration };
          return this.http.post<any>(`${this.baseUrl}/${matchId}/timer/start`, body);
        }),
        map((x) => this.normalize(x)),
        switchMap((m) => this.enrichNames([m])),
        map(([m]) => m)
      );
    }
    return this.http.post<any>(`${this.baseUrl}/${matchId}/timer/${action}`, {}).pipe(
      map((x) => this.normalize(x)),
      switchMap((m) => this.enrichNames([m])),
      map(([m]) => m)
    );
  }

  nextQuarter(matchId: number): Observable<MatchModel> {
    return this.http
      .post<any>(`${this.baseUrl}/${matchId}/quarters/advance`, {})
      .pipe(
        map((x) => this.normalize(x)),
        switchMap((m) => this.enrichNames([m])),
        map(([m]) => m)
      );
  }

  finishMatch(
    matchId: number,
    scores?: { homeScore?: number; awayScore?: number }
  ): Observable<MatchModel> {
    return this.http
      .post<any>(`${this.baseUrl}/${matchId}/finish`, scores ?? {})
      .pipe(
        map((x) => this.normalize(x)),
        switchMap((m) => this.enrichNames([m])),
        map(([m]) => m)
      );
  }