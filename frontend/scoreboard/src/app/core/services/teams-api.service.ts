import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type { Player } from './players-api.service';

function normalizeBase(url: string | null | undefined): string {
  if (!url) {
    return '';
  }
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export interface Team {
  id: number;
  name: string;
  coach?: string | null;
  city?: string | null;
}

export interface PageResponse<T> {
  content: T[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

export interface TeamQuery {
  page?: number;
  size?: number;
  search?: string;
}

@Injectable({ providedIn: 'root' })
export class TeamsApiService {
  private readonly http = inject(HttpClient);
  private readonly env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
  private readonly baseUrl = normalizeBase(
    this.env['NG_APP_TEAMS_API_URL'] ?? this.env['VITE_TEAMS_API_URL'] ?? 'http://127.0.0.1:8082/api'
  );

  async listTeams(query: TeamQuery = {}): Promise<PageResponse<Team>> {
    const params: Record<string, string> = {};

    const page = typeof query.page === 'number' && Number.isFinite(query.page) ? query.page : 0;
    const size = typeof query.size === 'number' && Number.isFinite(query.size) ? query.size : 10;

    params['page'] = String(Math.max(0, page));
    params['size'] = String(Math.max(1, Math.min(50, Math.trunc(size))));

    if (query.search) {
      params['search'] = query.search;
    }

    return firstValueFrom(
      this.http.get<PageResponse<Team>>(`${this.baseUrl}/teams`, {
        params,
      })
    );
  }

  async getPlayersForTeam(teamId: number): Promise<Player[]> {
    return firstValueFrom(this.http.get<Player[]>(`${this.baseUrl}/teams/${teamId}/players`));
  }
}
