import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Subscription } from 'rxjs';

import { Team } from '../../models/team';
import { Player } from '../../models/player';
import { TeamService } from '../../services/team.service';
import { PlayerService } from '../../services/player.service';
import {
  MatchesService,
  MatchListItem,
  ScheduleMatchDto,
  FinishMatchDto,
  FoulItem,
  ScoreEventItem
} from '../../services/matches.service';

@Component({
  selector: 'app-tournaments',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    // Material
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatSnackBarModule,
    MatTableModule,
    MatPaginatorModule,
    MatIconModule,
    MatCardModule
  ],
  templateUrl: './tournaments.html',
  styleUrls: ['./tournaments.css']
})
export class TournamentsComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  private readonly teamsSvc = inject(TeamService);
  private readonly playersSvc = inject(PlayerService);
  private readonly matchesSvc = inject(MatchesService);
  private readonly snack = inject(MatSnackBar);
  private readonly router = inject(Router);

  // ===== Form de programación =====
  form: FormGroup<{
    homeTeamId: FormControl<number | null>;
    awayTeamId: FormControl<number | null>;
    dateMatch: FormControl<Date | null>;
    quarterDurationSeconds: FormControl<number | null>;
    status: FormControl<string | null>;
    homeRoster: FormControl<number[]>;
    awayRoster: FormControl<number[]>;
  }> = this.fb.nonNullable.group({
    homeTeamId: this.fb.control<number | null>(null, { validators: [Validators.required], nonNullable: false }),
    awayTeamId: this.fb.control<number | null>(null, { validators: [Validators.required], nonNullable: false }),
    dateMatch: this.fb.control<Date | null>(new Date(), { validators: [Validators.required], nonNullable: false }),
    quarterDurationSeconds: this.fb.control<number | null>(600, { validators: [Validators.required, Validators.min(10)], nonNullable: false }),
    status: this.fb.control<string | null>('Scheduled', { validators: [Validators.required], nonNullable: false }),
    homeRoster: this.fb.control<number[]>([], { nonNullable: true }),
    awayRoster: this.fb.control<number[]>([], { nonNullable: true }),
  });

  // ===== Datos maestros =====
  teams = signal<Team[]>([]);
  homePlayers = signal<Player[]>([]);
  awayPlayers = signal<Player[]>([]);

  // ===== Listado / búsqueda / paginación =====
  loading = signal<boolean>(true);
  matches = signal<MatchListItem[]>([]);
  totalRaw = signal<number>(0);

  search = new FormControl<string>('', { nonNullable: true });
  pageIndex = signal<number>(0);
  pageSize  = signal<number>(10);

  // término normalizado (desde el control con debounce)
  private term = signal<string>('');

  // Filtrado local (home/away/status)
  private filtered = computed<MatchListItem[]>(() => {
    const t = this.term().trim().toLowerCase();
    if (!t) return this.matches();
    return this.matches().filter(r => {
      const a = (r.homeTeam ?? '').toLowerCase();
      const b = (r.awayTeam ?? '').toLowerCase();
      const s = (r.status ?? '').toLowerCase();
      return a.includes(t) || b.includes(t) || s.includes(t);
    });
  });

  // Filas visibles para la tabla (aplica slice de paginación)
  rows = computed<MatchListItem[]>(() => {
    const start = this.pageIndex() * this.pageSize();
    const end = start + this.pageSize();
    const arr = this.filtered();
    return arr.slice(start, end);
  });

  // Longitud que muestra el paginator (si hay filtro, usa total filtrado)
  paginatorLength = computed<number>(() => this.filtered().length);

  displayedColumns: string[] = ['dateMatch', 'status', 'home', 'away', 'score', 'fouls', 'actions'];

  // Base del API para detalle RAW del match
  private readonly base = '/api/matches';

  private subs = new Subscription();

  ngOnInit(): void {
    this.loadTeams();
    this.loadMatches();

    // Buscador con debounce + reset de página
    this.subs.add(
      this.search.valueChanges
        .pipe(debounceTime(250), distinctUntilChanged())
        .subscribe(v => {
          this.term.set((v ?? '').toString());
          this.pageIndex.set(0);
        })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  // Enfoca la caja de búsqueda (para el botón “Filtrar” del toolbar)
  focusSearch(input: HTMLInputElement) {
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => { input.focus(); input.select(); }, 120);
  }

  /* ================== carga de datos ================== */

  private loadTeams(): void {
    this.teamsSvc.getTeams(1, 1000).subscribe({
      next: (res) => this.teams.set(res.items ?? []),
      error: () => this.snack.open('No se pudieron cargar los equipos', 'Cerrar', { duration: 2500 })
    });
  }

  private loadMatches(): void {
    this.loading.set(true);
    // Traemos “muchos” para que el filtro local sea útil
    this.matchesSvc.list({ page: 1, pageSize: 1000 }).subscribe({
      next: (resp) => {
        this.matches.set(resp.items ?? []);
        const total = (resp as any).total ?? (resp as any).totalCount ?? (resp.items?.length ?? 0);
        this.totalRaw.set(total);
        this.loading.set(false);
        this.pageIndex.set(0);
      },
      error: () => {
        this.loading.set(false);
        this.snack.open('No se pudieron cargar los partidos', 'Cerrar', { duration: 2500 });
      }
    });
  }

  /* ================== selects roster ================== */

  onHomeTeamChange(): void {
    const id = this.form.value.homeTeamId;
    this.form.patchValue({ homeRoster: [] }, { emitEvent: false });
    if (!id) { this.homePlayers.set([]); return; }
    this.playersSvc.getByTeam(id).subscribe({
      next: p => this.homePlayers.set(p),
      error: () => this.snack.open('Error cargando jugadores del local', 'Cerrar', { duration: 2500 })
    });
  }

  onAwayTeamChange(): void {
    const id = this.form.value.awayTeamId;
    this.form.patchValue({ awayRoster: [] }, { emitEvent: false });
    if (!id) { this.awayPlayers.set([]); return; }
    this.playersSvc.getByTeam(id).subscribe({
      next: p => this.awayPlayers.set(p),
      error: () => this.snack.open('Error cargando jugadores de la visita', 'Cerrar', { duration: 2500 })
    });
  }

  /* ================== acciones ================== */

  programMatch(): void {
    const v = this.form.value;
    if (!v.homeTeamId || !v.awayTeamId || !v.dateMatch || !v.quarterDurationSeconds) {
      this.snack.open('Completa el formulario', 'Cerrar', { duration: 2500 });
      return;
    }

    const dto: ScheduleMatchDto = {
      homeTeamId: v.homeTeamId!,
      awayTeamId: v.awayTeamId!,
      dateMatchUtc: (v.dateMatch as Date).toISOString(),
      quarterDurationSeconds: v.quarterDurationSeconds!,
      homeRosterPlayerIds: v.homeRoster ?? [],
      awayRosterPlayerIds: v.awayRoster ?? []
      // (status lo puede decidir el backend; si aceptara, aquí enviarías v.status!)
    };

    this.matchesSvc.programar(dto).subscribe({
      next: () => {
        this.snack.open('Partido programado', 'OK', { duration: 2000 });
        this.form.reset({
          dateMatch: new Date(),
          quarterDurationSeconds: 600,
          homeRoster: [],
          awayRoster: [],
          status: 'Scheduled'
        }, { emitEvent: false });
        this.homePlayers.set([]); this.awayPlayers.set([]);
        this.loadMatches();
      },
      error: (err) => {
        console.error('Programar error:', err);
        this.snack.open(err?.error ?? 'Error al programar el partido', 'Cerrar', { duration: 3000 });
      }
    });
  }

  pageChange(evt: PageEvent): void {
    this.pageIndex.set(evt.pageIndex);
    this.pageSize.set(evt.pageSize);
  }

  /* ================== Acciones por fila ================== */

  goToControl(row: MatchListItem): void {
    this.router.navigate(['/control', row.id]);
  }

  finishSim(row: MatchListItem): void {
    this.http.get<any>(`${this.base}/${row.id}`).subscribe({
      next: (detail) => {
        const homeTeamId: number = detail.homeTeamId;
        const awayTeamId: number = detail.awayTeamId;

        const homeScore = 60 + Math.floor(Math.random() * 41);
        const awayScore = 55 + Math.floor(Math.random() * 41);
        const homeFoulsCount = 8 + Math.floor(Math.random() * 9);
        const awayFoulsCount = 8 + Math.floor(Math.random() * 9);

        const makeScoreEvents = (teamId: number, total: number): ScoreEventItem[] => {
          const events: ScoreEventItem[] = [];
          let sum = 0;
          while (sum < total) {
            const shot = Math.random() < 0.3 ? 3 : 2;
            if (sum + shot > total) break;
            events.push({ teamId, points: shot });
            sum += shot;
          }
          if (sum < total) events.push({ teamId, points: 1 });
          return events;
        };

        const scoreEvents: ScoreEventItem[] = [
          ...makeScoreEvents(homeTeamId, homeScore),
          ...makeScoreEvents(awayTeamId, awayScore),
        ];

        const nowIso = new Date().toISOString();
        const fouls: FoulItem[] = [
          ...Array.from({ length: homeFoulsCount }, () => ({ teamId: homeTeamId, dateRegister: nowIso })),
          ...Array.from({ length: awayFoulsCount }, () => ({ teamId: awayTeamId, dateRegister: nowIso })),
        ];

        const dto: FinishMatchDto = {
          homeScore, awayScore,
          homeFouls: homeFoulsCount, awayFouls: awayFoulsCount,
          scoreEvents, fouls
        };

        this.matchesSvc.finish(row.id, dto).subscribe({
          next: () => { this.snack.open('Partido simulado y finalizado', 'OK', { duration: 2000 }); this.loadMatches(); },
          error: () => this.snack.open('No se pudo finalizar el partido', 'Cerrar', { duration: 2500 })
        });
      },
      error: () => this.snack.open('No se pudo obtener el detalle del partido', 'Cerrar', { duration: 2500 })
    });
  }
}
