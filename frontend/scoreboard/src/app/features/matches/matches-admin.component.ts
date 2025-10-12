import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatchesApiService, MatchListItemDto } from '../../core/services/matches-api.service';
import { TeamsApiService, Team } from '../../core/services/teams-api.service';

interface ScheduleFormValue {
  homeTeamId: number | null;
  awayTeamId: number | null;
  date: string;
  quarterDurationSeconds: number | null;
}

@Component({
  selector: 'app-matches-admin',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './matches-admin.component.html',
  styleUrl: './matches-admin.component.css'
})
export class MatchesAdminComponent implements OnInit {
  private readonly matchesApi = inject(MatchesApiService);
  private readonly teamsApi = inject(TeamsApiService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  protected readonly loadingMatches = signal(true);
  protected readonly loadingTeams = signal(true);
  protected readonly matches = signal<MatchListItemDto[]>([]);
  protected readonly teams = signal<Team[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly form = this.fb.group({
    homeTeamId: [null as number | null, Validators.required],
    awayTeamId: [null as number | null, Validators.required],
    date: [this.defaultDate(), Validators.required],
    quarterDurationSeconds: [600, [Validators.required, Validators.min(60)]]
  });

  protected readonly disableSubmit = computed(() => this.form.invalid || this.loadingMatches());

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadTeams(), this.loadMatches()]);
  }

  async loadMatches(): Promise<void> {
    this.loadingMatches.set(true);
    this.error.set(null);
    try {
      const response = await this.matchesApi.listMatches({ page: 1, pageSize: 20 });
      this.matches.set(response.items);
    } catch (error) {
      console.error('Failed to load matches', error);
      this.error.set('No se pudo cargar la lista de partidos.');
    } finally {
      this.loadingMatches.set(false);
    }
  }

  async loadTeams(): Promise<void> {
    this.loadingTeams.set(true);
    try {
      const response = await this.teamsApi.listTeams({ page: 0, size: 50 });
      this.teams.set(response.content);
    } catch (error) {
      console.error('Failed to load teams', error);
      this.error.set('No se pudo cargar la lista de equipos.');
    } finally {
      this.loadingTeams.set(false);
    }
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.value as ScheduleFormValue;
    if (!value.homeTeamId || !value.awayTeamId) {
      return;
    }

    if (value.homeTeamId === value.awayTeamId) {
      this.error.set('Selecciona equipos distintos.');
      return;
    }

    try {
      this.loadingMatches.set(true);
      this.error.set(null);
      this.success.set(null);
      const date = value.date ? new Date(value.date) : null;
      if (!date || Number.isNaN(date.getTime())) {
        this.error.set('Selecciona una fecha válida.');
        return;
      }

      const detail = await this.matchesApi.program({
        homeTeamId: value.homeTeamId,
        awayTeamId: value.awayTeamId,
        dateMatchUtc: date.toISOString(),
        quarterDurationSeconds: value.quarterDurationSeconds ?? undefined
      });

      const listItem: MatchListItemDto = {
        id: detail.id,
        dateMatchUtc: detail.dateMatchUtc,
        status: detail.status,
        home: detail.home,
        away: detail.away,
        homeScore: detail.homeScore,
        awayScore: detail.awayScore,
        period: detail.period,
        quarterDurationSeconds: detail.quarterDurationSeconds,
        homeFouls: detail.homeFouls,
        awayFouls: detail.awayFouls
      };

      this.matches.update((items) => [listItem, ...items]);
      this.success.set('Partido programado correctamente.');
      this.form.reset({
        homeTeamId: null,
        awayTeamId: null,
        date: this.defaultDate(),
        quarterDurationSeconds: 600
      });
    } catch (error) {
      console.error('Failed to program match', error);
      this.error.set('No se pudo programar el partido.');
    } finally {
      this.loadingMatches.set(false);
    }
  }

  async refresh(): Promise<void> {
    await this.loadMatches();
  }

  goToControl(matchId: number): void {
    void this.router.navigate(['/control', matchId]);
  }

  goToScoreboard(matchId: number): void {
    void this.router.navigate(['/scoreboard', matchId]);
  }

  trackByMatchId(_: number, item: MatchListItemDto): number {
    return item.id;
  }

  trackByTeamId(_: number, team: Team): number {
    return team.id;
  }

  private defaultDate(): string {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);
    now.setSeconds(0, 0);
    const pad = (value: number) => value.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }
}
