import { Injectable, inject } from '@angular/core';
import {
  HttpClient,
  HttpHeaders,
  HttpParams,
} from '@angular/common/http';
import { Observable } from 'rxjs';

export interface StandingRow {
  rank: number;
  teamId: string;
  team: string;
  played: number;
  wins: number;
  losses: number;
  pf: number;
  pa: number;
  diff: number;
}

export interface StatsSummaryGroup {
  rank: number;
  teamId: string;
  team: string;
  played: number;
  wins: number;
  losses: number;
  pf: number;
  pa: number;
}

export interface StatsSummarySnapshot {
  generatedAtUtc: string;
  topWins: StatsSummaryGroup[];
  topPointsFor: StatsSummaryGroup[];
  lowestPointsFor: StatsSummaryGroup[];
  fewestLosses: StatsSummaryGroup[];
}

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly http = inject(HttpClient);

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') ?? '';
    if (!token) {
      return new HttpHeaders();
    }

    const bearer = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    return new HttpHeaders({
      Authorization: bearer,
      'X-Api-Authorization': bearer,
      'X-Teams-Authorization': bearer,
      'X-Players-Authorization': bearer,
      'X-Matches-Authorization': bearer,
    });
  }

  // ---------- JSON endpoints ----------
  getStandings(): Observable<StandingRow[]> {
    return this.http.get<StandingRow[]>('/api/reports/standings', {
      headers: this.authHeaders(),
    });
  }

  getStatsSummary(): Observable<StatsSummarySnapshot> {
    return this.http.get<StatsSummarySnapshot>('/api/reports/stats/summary', {
      headers: this.authHeaders(),
    });
  }

  // ---------- PDF endpoints ----------
  downloadStandings(): Observable<Blob> {
    return this.http.get('/api/reports/standings.pdf', {
      responseType: 'blob',
      headers: this.authHeaders(),
    });
  }

  downloadTeams(): Observable<Blob> {
    return this.http.get('/api/reports/teams.pdf', {
      responseType: 'blob',
      headers: this.authHeaders(),
    });
  }

  downloadPlayersByTeam(teamId: number): Observable<Blob> {
    return this.http.get(`/api/reports/teams/${teamId}/players.pdf`, {
      responseType: 'blob',
      headers: this.authHeaders(),
    });
  }

  downloadMatchesHistory(params: {
    from?: string;
    to?: string;
  }): Observable<Blob> {
    let httpParams = new HttpParams();
    if (params.from) httpParams = httpParams.set('from', params.from);
    if (params.to) httpParams = httpParams.set('to', params.to);

    return this.http.get('/api/reports/matches/history.pdf', {
      responseType: 'blob',
      params: httpParams,
      headers: this.authHeaders(),
    });
  }

  downloadMatchRoster(matchId: number): Observable<Blob> {
    return this.http.get(`/api/reports/matches/${matchId}/roster.pdf`, {
      responseType: 'blob',
      headers: this.authHeaders(),
    });
  }

  downloadAllPlayers(): Observable<Blob> {
    return this.http.get('/api/reports/players/all.pdf', {
      responseType: 'blob',
      headers: this.authHeaders(),
    });
  }

  downloadStatsSummary(): Observable<Blob> {
    return this.http.get('/api/reports/stats/summary.pdf', {
      responseType: 'blob',
      headers: this.authHeaders(),
    });
  }
}
