import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import {
  PaginatedPlayersResponse,
  PaginationMeta,
  Player,
  PlayersApiService,
} from '../../core/services/players-api.service';

@Component({
  selector: 'app-players',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './players.component.html',
  styleUrl: './players.component.css'
})
export class PlayersComponent {
  private readonly playersApi = inject(PlayersApiService);

  readonly players = signal<Player[]>([]);
  readonly meta = signal<PaginationMeta | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly isEmpty = computed(() => !this.loading() && !this.error() && this.players().length === 0);

  searchTerm = '';
  teamFilter = '';
  perPage = 10;
  page = 1;

  constructor() {
    void this.fetchPlayers();
  }

  async fetchPlayers(page = 1): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const response = await this.playersApi.listPlayers({
        search: this.searchTerm.trim() || undefined,
        team: this.teamFilter.trim() || undefined,
        page,
        perPage: this.perPage,
      });

      this.applyResponse(response);
    } catch (error) {
      console.error('Failed to load players', error);
      this.error.set('No se pudieron cargar los jugadores. Inténtalo nuevamente.');
    } finally {
      this.loading.set(false);
    }
  }

  private applyResponse(response: PaginatedPlayersResponse): void {
    this.players.set(response.data ?? []);
    if (response.meta) {
      this.meta.set(response.meta);
      this.page = response.meta.current_page ?? this.page;
      this.perPage = response.meta.per_page ?? this.perPage;
    } else {
      this.meta.set(null);
      this.page = 1;
    }
  }

  async onSubmit(): Promise<void> {
    await this.fetchPlayers(1);
  }

  async clearFilters(): Promise<void> {
    this.searchTerm = '';
    this.teamFilter = '';
    await this.fetchPlayers(1);
  }

  async goToPrevious(): Promise<void> {
    if (this.page <= 1) {
      return;
    }
    await this.fetchPlayers(this.page - 1);
  }

  async goToNext(): Promise<void> {
    const meta = this.meta();
    if (!meta || this.page >= meta.last_page) {
      return;
    }
    await this.fetchPlayers(this.page + 1);
  }
}
