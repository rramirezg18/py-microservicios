import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { Player } from '../../core/services/players-api.service';
import { Team, TeamsApiService } from '../../core/services/teams-api.service';

@Component({
  selector: 'app-teams',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './teams.component.html',
  styleUrl: './teams.component.css'
})
export class TeamsComponent {
  private readonly teamsApi = inject(TeamsApiService);

  readonly teams = signal<Team[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly selectedTeam = signal<Team | null>(null);
  readonly teamPlayers = signal<Player[]>([]);
  readonly playersLoading = signal(false);
  readonly playersError = signal<string | null>(null);

  readonly isEmpty = computed(() => !this.loading() && !this.error() && this.teams().length === 0);

  searchTerm = '';
  page = 1;
  pageSize = 10;
  totalPages = signal(1);
  totalTeams = signal(0);

  constructor() {
    void this.fetchTeams();
  }

  async fetchTeams(page = 1): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const response = await this.teamsApi.listTeams({
        search: this.searchTerm.trim() || undefined,
        page: page - 1,
        size: this.pageSize,
      });

      this.teams.set(response.content ?? []);
      this.page = (response.number ?? 0) + 1;
      this.pageSize = response.size ?? this.pageSize;
      this.totalPages.set(response.totalPages ?? 1);
      this.totalTeams.set(response.totalElements ?? 0);
    } catch (error) {
      console.error('Failed to load teams', error);
      this.error.set('No se pudieron cargar los equipos. Inténtalo nuevamente.');
    } finally {
      this.loading.set(false);
    }
  }

  async onSubmit(): Promise<void> {
    await this.fetchTeams(1);
  }

  async clearFilters(): Promise<void> {
    this.searchTerm = '';
    await this.fetchTeams(1);
  }

  async goToPrevious(): Promise<void> {
    if (this.page <= 1) {
      return;
    }
    await this.fetchTeams(this.page - 1);
  }

  async goToNext(): Promise<void> {
    if (this.page >= this.totalPages()) {
      return;
    }
    await this.fetchTeams(this.page + 1);
  }

  async viewPlayers(team: Team): Promise<void> {
    this.selectedTeam.set(team);
    this.teamPlayers.set([]);
    this.playersError.set(null);
    this.playersLoading.set(true);

    try {
      const players = await this.teamsApi.getPlayersForTeam(team.id);
      this.teamPlayers.set(players ?? []);
    } catch (error) {
      console.error('Failed to load players for team', error);
      this.playersError.set('No se pudieron obtener los jugadores de este equipo.');
    } finally {
      this.playersLoading.set(false);
    }
  }

  closeDetails(): void {
    this.selectedTeam.set(null);
    this.teamPlayers.set([]);
    this.playersError.set(null);
  }
}
