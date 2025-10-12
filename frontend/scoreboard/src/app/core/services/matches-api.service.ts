import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

function normalizeBase(url: string | null | undefined): string {
  if (!url) {
    return '';
  }
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export type MatchStatus = 'Scheduled' | 'Live' | 'Finished' | 'Canceled' | 'Suspended';

export interface TeamSummaryDto {
  id: number;
  name: string;
}

export interface MatchTimerDto {
  running: boolean;
  remainingSeconds: number;
  quarterEndsAtUtc?: string | null;
}

export interface MatchDetailDto {
  id: number;
  home: TeamSummaryDto;
  away: TeamSummaryDto;
  status: MatchStatus;
  period: number;
  quarterDurationSeconds: number;
  timer: MatchTimerDto;
  homeScore: number;
  awayScore: number;
  homeFouls: number;
  awayFouls: number;
  dateMatchUtc: string;
}

export interface MatchListItemDto {
  id: number;
  dateMatchUtc: string;
  status: MatchStatus;
  home: TeamSummaryDto;
  away: TeamSummaryDto;
  homeScore: number;
  awayScore: number;
  period: number;
  quarterDurationSeconds: number;
  homeFouls: number;
  awayFouls: number;
}

export interface MatchListResponseDto {
  items: MatchListItemDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProgramMatchPayload {
  homeTeamId: number;
  awayTeamId: number;
  dateMatchUtc: string;
  quarterDurationSeconds?: number;
}

export interface ReprogramPayload {
  newDateMatchUtc: string;
}

export interface StartTimerPayload {
  quarterDurationSeconds?: number;
}

export interface ScoreEventPayload {
  teamId: number;
  playerId?: number | null;
  points: number;
  registeredAtUtc?: string;
}

export interface AdjustScorePayload {
  teamId: number;
  delta: number;
}

export interface FoulPayload {
  teamId: number;
  playerId?: number | null;
  type?: string | null;
  registeredAtUtc?: string;
}

export interface AdjustFoulPayload {
  teamId: number;
  delta: number;
}

export interface SetQuarterPayload {
  quarter: number;
}

export interface FinishMatchPayload {
  homeScore: number;
  awayScore: number;
  homeFouls: number;
  awayFouls: number;
  scoreEvents?: ScoreEventPayload[];
  fouls?: FoulPayload[];
}

export interface MatchRosterDto {
  team: TeamSummaryDto;
  players: PlayerSummaryDto[];
}

export interface PlayerSummaryDto {
  id?: number | null;
  name?: string | null;
  position?: string | null;
  number?: number | null;
  nationality?: string | null;
  team?: string | null;
}

export interface MatchRostersResponseDto {
  home: MatchRosterDto;
  away: MatchRosterDto;
}

export interface PauseTimerResponse {
  remainingSeconds: number;
}

export interface MatchQuery {
  page?: number;
  pageSize?: number;
  status?: MatchStatus | '';
  teamId?: number;
  from?: string;
  to?: string;
}

@Injectable({ providedIn: 'root' })
export class MatchesApiService {
  private readonly http = inject(HttpClient);
  private readonly env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
  private readonly baseUrl = normalizeBase(
    this.env['NG_APP_MATCHES_API_URL'] ?? this.env['VITE_MATCHES_API_URL'] ?? 'http://127.0.0.1:5050/api'
  );

  async listMatches(query: MatchQuery = {}): Promise<MatchListResponseDto> {
    const params: Record<string, string> = {};

    if (typeof query.page === 'number' && Number.isFinite(query.page)) {
      params['page'] = String(Math.max(1, Math.trunc(query.page)));
    }

    if (typeof query.pageSize === 'number' && Number.isFinite(query.pageSize)) {
      params['pageSize'] = String(Math.max(1, Math.min(200, Math.trunc(query.pageSize))));
    }

    if (query.status) {
      params['status'] = query.status;
    }

    if (typeof query.teamId === 'number' && Number.isFinite(query.teamId)) {
      params['teamId'] = String(query.teamId);
    }

    if (query.from) {
      params['from'] = query.from;
    }

    if (query.to) {
      params['to'] = query.to;
    }

    return firstValueFrom(this.http.get<MatchListResponseDto>(`${this.baseUrl}/matches`, { params }));
  }

  async upcoming(): Promise<MatchListItemDto[]> {
    return firstValueFrom(this.http.get<MatchListItemDto[]>(`${this.baseUrl}/matches/upcoming`));
  }

  async getMatch(matchId: number): Promise<MatchDetailDto> {
    return firstValueFrom(this.http.get<MatchDetailDto>(`${this.baseUrl}/matches/${matchId}`));
  }

  async getRosters(matchId: number): Promise<MatchRostersResponseDto> {
    return firstValueFrom(this.http.get<MatchRostersResponseDto>(`${this.baseUrl}/matches/${matchId}/rosters`));
  }

  async program(payload: ProgramMatchPayload): Promise<MatchDetailDto> {
    return firstValueFrom(this.http.post<MatchDetailDto>(`${this.baseUrl}/matches`, payload));
  }

  async reprogram(matchId: number, payload: ReprogramPayload): Promise<MatchDetailDto> {
    return firstValueFrom(this.http.put<MatchDetailDto>(`${this.baseUrl}/matches/${matchId}/reschedule`, payload));
  }

  async startTimer(matchId: number, payload: StartTimerPayload = {}): Promise<MatchTimerDto> {
    return firstValueFrom(this.http.post<MatchTimerDto>(`${this.baseUrl}/matches/${matchId}/start`, payload));
  }

  async pauseTimer(matchId: number): Promise<PauseTimerResponse> {
    return firstValueFrom(this.http.post<PauseTimerResponse>(`${this.baseUrl}/matches/${matchId}/timer/pause`, {}));
  }

  async resumeTimer(matchId: number): Promise<MatchTimerDto> {
    return firstValueFrom(this.http.post<MatchTimerDto>(`${this.baseUrl}/matches/${matchId}/timer/resume`, {}));
  }

  async resetTimer(matchId: number): Promise<MatchTimerDto> {
    return firstValueFrom(this.http.post<MatchTimerDto>(`${this.baseUrl}/matches/${matchId}/timer/reset`, {}));
  }

  async addScore(matchId: number, payload: ScoreEventPayload): Promise<MatchDetailDto> {
    return firstValueFrom(this.http.post<MatchDetailDto>(`${this.baseUrl}/matches/${matchId}/score`, payload));
  }

  async adjustScore(matchId: number, payload: AdjustScorePayload): Promise<MatchDetailDto> {
    return firstValueFrom(this.http.post<MatchDetailDto>(`${this.baseUrl}/matches/${matchId}/score/adjust`, payload));
  }

  async addFoul(matchId: number, payload: FoulPayload): Promise<MatchDetailDto> {
    return firstValueFrom(this.http.post<MatchDetailDto>(`${this.baseUrl}/matches/${matchId}/fouls`, payload));
  }

  async adjustFouls(matchId: number, payload: AdjustFoulPayload): Promise<MatchDetailDto> {
    return firstValueFrom(this.http.post<MatchDetailDto>(`${this.baseUrl}/matches/${matchId}/fouls/adjust`, payload));
  }

  async advanceQuarter(matchId: number): Promise<MatchDetailDto> {
    return firstValueFrom(this.http.post<MatchDetailDto>(`${this.baseUrl}/matches/${matchId}/quarters/advance`, {}));
  }

  async setQuarter(matchId: number, payload: SetQuarterPayload): Promise<MatchDetailDto> {
    return firstValueFrom(this.http.post<MatchDetailDto>(`${this.baseUrl}/matches/${matchId}/quarters/set`, payload));
  }

  async autoAdvanceQuarter(matchId: number): Promise<MatchDetailDto> {
    return firstValueFrom(this.http.post<MatchDetailDto>(`${this.baseUrl}/matches/${matchId}/quarters/auto-advance`, {}));
  }

  async finish(matchId: number, payload: FinishMatchPayload): Promise<MatchDetailDto> {
    return firstValueFrom(this.http.post<MatchDetailDto>(`${this.baseUrl}/matches/${matchId}/finish`, payload));
  }

  async cancel(matchId: number): Promise<MatchDetailDto> {
    return firstValueFrom(this.http.post<MatchDetailDto>(`${this.baseUrl}/matches/${matchId}/cancel`, {}));
  }

  async suspend(matchId: number): Promise<MatchDetailDto> {
    return firstValueFrom(this.http.post<MatchDetailDto>(`${this.baseUrl}/matches/${matchId}/suspend`, {}));
  }
}
