import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface StandingRow {
  rank?: number;
  teamId?: number;
  team: string;
  played: number;
  wins: number;
  losses: number;
  pf: number;
  pa: number;
  diff: number;
  color?: string;
  name?: string; // compat si viene como 'name'
}

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private http = inject(HttpClient);

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') ?? '';
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  // ===========================
  // Descargas (PDF)
  // ===========================
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

  downloadMatchesHistory(params: { from?: string; to?: string }): Observable<Blob> {
    let httpParams = new HttpParams();
    if (params.from) httpParams = httpParams.set('from', params.from);
    if (params.to)   httpParams = httpParams.set('to', params.to);

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

  // ===========================
  // JSON (para UI)
  // ===========================
  getStandingsJson(): Observable<{ total: number; data: StandingRow[] } | StandingRow[]> {
    return this.http.get<{ total: number; data: StandingRow[] } | StandingRow[]>(
      '/api/reports/standings',
      { headers: this.authHeaders() }
    );
  }

  // Alias para que el componente pueda llamar getStandings()
  getStandings(): Observable<{ total: number; data: StandingRow[] } | StandingRow[]> {
    return this.getStandingsJson();
  }

  getStatsSummaryJson(): Observable<any> {
    return this.http.get('/api/reports/stats/summary', {
      headers: this.authHeaders(),
    });
  }
}
