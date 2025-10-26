import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

// Angular Material
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

// Servicios
import { TeamService } from '@app/services/api/team.service';
import { Team } from '@app/models/team';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-schedule-match',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatCardModule, MatFormFieldModule, MatSelectModule, MatInputModule, MatButtonModule
  ],
  template: `
  <div class="container">
    <mat-card class="glass">
      <h2>📅 Programar partido</h2>

      <form [formGroup]="form" (ngSubmit)="submit()">
        <div class="grid">
          <mat-form-field appearance="fill">
            <mat-label>Equipo local</mat-label>
            <mat-select formControlName="homeTeamId" required>
              <mat-option *ngFor="let t of teams" [value]="t.id">{{ t.name }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="fill">
            <mat-label>Equipo visitante</mat-label>
            <mat-select formControlName="awayTeamId" required>
              <mat-option *ngFor="let t of teams" [value]="t.id">{{ t.name }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="fill">
            <mat-label>Fecha</mat-label>
            <input matInput type="date" formControlName="date" required>
          </mat-form-field>

          <mat-form-field appearance="fill">
            <mat-label>Hora</mat-label>
            <input matInput type="time" formControlName="time" required>
          </mat-form-field>

          <mat-form-field appearance="fill">
            <mat-label>Minutos por cuarto</mat-label>
            <input matInput type="number" formControlName="minutes" min="1" max="30" required>
          </mat-form-field>
        </div>

        <div class="actions">
          <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || loading">
            {{ loading ? 'Guardando...' : 'Programar' }}
          </button>
        </div>
      </form>
    </mat-card>
  </div>
  `,
  styles: [`
    .container { padding: 24px; display: grid; place-items: start; }
    .glass { background: rgba(255,255,255,0.06); backdrop-filter: blur(8px); border-radius: 16px; padding: 16px; }
    h2 { margin: 0 0 12px 0; }
    .grid { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(220px, 1fr)); }
    .actions { margin-top: 12px; display: flex; gap: 8px; }
    @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }
  `]
})
export class ScheduleMatchComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly teamService = inject(TeamService);

  teams: Team[] = [];
  loading = false;

  form = this.fb.group({
    homeTeamId: [null as number | null, Validators.required],
    awayTeamId: [null as number | null, Validators.required],
    date: ['', Validators.required],   // YYYY-MM-DD
    time: ['', Validators.required],   // HH:mm (24h)
    minutes: [10, [Validators.required, Validators.min(1), Validators.max(30)]],
  });

  ngOnInit() {
    this.teamService.getAll().subscribe({
      next: (ts) => this.teams = ts,
      error: () => Swal.fire('Error', 'No se pudieron cargar los equipos', 'error'),
    });
  }

  submit() {
    if (this.form.invalid) return;
    const { homeTeamId, awayTeamId, date, time, minutes } = this.form.value;

    if (homeTeamId === awayTeamId) {
      Swal.fire('Validación', 'El local y el visitante deben ser distintos', 'warning');
      return;
    }

    const localIso = `${date}T${time}:00`; // se envía como fecha/hora local
    const body: any = {
      homeTeamId: Number(homeTeamId),
      awayTeamId: Number(awayTeamId),
      dateMatch: localIso, // backend (C#) espera "DateMatch"
      quarterDurationSeconds: Math.round(Number(minutes) * 60)
    };

    this.loading = true;
    this.http.post<any>('/api/matches/programar', body).subscribe({
      next: (res) => {
        const id = res?.matchId ?? res?.id;
        Swal.fire('Listo', 'Partido programado correctamente', 'success');
        if (id) this.router.navigate(['/control', id]);
        this.loading = false;
      },
      error: (err) => {
        const msg = err?.error?.error ?? 'No se pudo programar el partido';
        Swal.fire('Error', msg, 'error');
        this.loading = false;
      }
    });
  }
}
