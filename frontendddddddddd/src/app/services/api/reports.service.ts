import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private http = inject(HttpClient);

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') ?? '';
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  // --------- Descargas PDF ---------
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

  // --------- Endpoints JSON (para mostrar en UI) ---------
  getStandingsJson(): Observable<{ total: number; data: Array<{ team: string; wins: number }> }> {
    return this.http.get<{ total: number; data: Array<{ team: string; wins: number }> }>(
      '/api/reports/standings',
      { headers: this.authHeaders() }
    );
  }

  getStatsSummaryJson(): Observable<any> {
    return this.http.get<any>('/api/reports/stats/summary', {
      headers: this.authHeaders(),
    });
  }
}
