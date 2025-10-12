import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { TournamentSummary, TournamentViewModel, UpdateMatchRequest } from '../../features/tournaments/tournaments.models';

function normalizeBase(url: string | null | undefined): string {
  if (!url) {
    return '';
  }

  return url.endsWith('/') ? url.slice(0, -1) : url;
}

@Injectable({ providedIn: 'root' })
export class TournamentsApiService {
  private readonly http = inject(HttpClient);
  private readonly env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
  private readonly baseUrl = normalizeBase(
    this.env['NG_APP_TOURNAMENTS_API_URL'] ?? this.env['VITE_TOURNAMENTS_API_URL'] ?? 'http://127.0.0.1:8083/api'
  );

  async listTournaments(): Promise<TournamentSummary[]> {
    return firstValueFrom(this.http.get<TournamentSummary[]>(`${this.baseUrl}/tournaments`));
  }

  async getTournament(id: string): Promise<TournamentViewModel> {
    return firstValueFrom(this.http.get<TournamentViewModel>(`${this.baseUrl}/tournaments/${encodeURIComponent(id)}`));
  }

  async updateMatch(
    tournamentId: string,
    matchId: string,
    payload: UpdateMatchRequest
  ): Promise<TournamentViewModel> {
    return firstValueFrom(
      this.http.put<TournamentViewModel>(
        `${this.baseUrl}/tournaments/${encodeURIComponent(tournamentId)}/matches/${encodeURIComponent(matchId)}`,
        payload
      )
    );
  }
}
