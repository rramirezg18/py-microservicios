import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

function normalizeBase(url: string | null | undefined): string {
  if (!url) {
    return '';
  }
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export interface Player {
  id: number;
  name: string;
  email: string;
  age: number | null;
  team: string | null;
  position?: string | null;
  number?: number | null;
  nationality?: string | null;
  teamName?: string | null;
}

export interface PaginationMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface PaginatedPlayersResponse {
  data: Player[];
  meta?: PaginationMeta;
  links?: Record<string, unknown>;
}

export interface PlayerQuery {
  search?: string;
  team?: string;
  page?: number;
  perPage?: number;
}

@Injectable({ providedIn: 'root' })
export class PlayersApiService {
  private readonly http = inject(HttpClient);
  private readonly env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
  private readonly baseUrl = normalizeBase(
    this.env['NG_APP_PLAYERS_API_URL'] ?? this.env['VITE_PLAYERS_API_URL'] ?? 'http://127.0.0.1:8000/api'
  );

  async listPlayers(query: PlayerQuery = {}): Promise<PaginatedPlayersResponse> {
    const params: Record<string, string> = {};

    if (query.search) {
      params['search'] = query.search;
    }
    if (query.team) {
      params['team'] = query.team;
    }
    if (typeof query.page === 'number' && Number.isFinite(query.page)) {
      params['page'] = String(Math.max(1, query.page));
    }
    if (typeof query.perPage === 'number' && Number.isFinite(query.perPage)) {
      params['per_page'] = String(Math.max(1, Math.min(100, Math.trunc(query.perPage))));
    }

    return firstValueFrom(
      this.http.get<PaginatedPlayersResponse>(`${this.baseUrl}/players`, {
        params,
      })
    );
  }

  async getPlayersByTeam(team: string): Promise<Player[]> {
    const response = await firstValueFrom(
      this.http.get<PaginatedPlayersResponse>(`${this.baseUrl}/players/by-team/${encodeURIComponent(team)}`)
    );

    return response.data ?? [];
  }
}
