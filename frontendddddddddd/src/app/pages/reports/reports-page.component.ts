import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { ReportsService } from '@app/services/api/reports.service';
import { StandingsDialogComponent, StandingRow } from '../standings/standings-dialog.component';

type Team = { id: number; name: string };

@Component({
  standalone: true,
  selector: 'app-reports-page',
  imports: [CommonModule, FormsModule, MatDialogModule],
  templateUrl: './reports-page.component.html',
  styleUrls: ['./reports-page.component.scss'],
})
export class ReportsPage {
  private http = inject(HttpClient);
  private reports = inject(ReportsService);
  private dialog = inject(MatDialog);

  teams = signal<Team[]>([]);
  loadingTeams = signal<boolean>(true);
  teamId = signal<number | null>(null);

  from = signal<string>('');   // yyyy-mm-dd
  to = signal<string>('');
  matchId = signal<number | null>(null);

  errorMsg = signal<string>('');

  constructor() {
    this.loadTeams();
  }

  private loadTeams() {
    this.loadingTeams.set(true);

    const params = new HttpParams().set('page', 0).set('size', 100);
    this.http.get<any>('/api/teams', { params }).subscribe({
      next: (res) => {
        let items: any[] = [];
        if (Array.isArray(res?.content)) items = res.content;
        else if (Array.isArray(res?.items)) items = res.items;
        else if (Array.isArray(res?.results)) items = res.results;
        else if (Array.isArray(res)) items = res;

        const mapped: Team[] = items.map((t) => ({
          id: Number(t.id ?? t.Id ?? t.teamId ?? t.TeamId ?? 0),
          name: String(t.name ?? t.Name ?? t.teamName ?? t.TeamName ?? ''),
        }));

        this.teams.set(mapped);
        this.loadingTeams.set(false);
      },
      error: () => {
        this.loadingTeams.set(false);
        this.errorMsg.set('No se pudo cargar la lista de equipos.');
      },
    });
  }

  private saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = filename;
    a.href = url;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
  }

  // ===== Botones (PDF existentes) =====
  downloadTeams() {
    this.errorMsg.set('');
    this.reports.downloadTeams().subscribe({
      next: (blob) => this.saveBlob(blob, 'equipos.pdf'),
      error: (e: HttpErrorResponse) => this.errorMsg.set(this.humanError(e)),
    });
  }

  downloadPlayersByTeam() {
    this.errorMsg.set('');
    const tid = this.teamId();
    if (!tid) {
      this.errorMsg.set('Selecciona un equipo.');
      return;
    }
    this.reports.downloadPlayersByTeam(tid).subscribe({
      next: (blob) => this.saveBlob(blob, `jugadores_${tid}.pdf`),
      error: (e: HttpErrorResponse) => this.errorMsg.set(this.humanError(e)),
    });
  }

  downloadMatchesHistory() {
    this.errorMsg.set('');
    const params = { from: this.from() || undefined, to: this.to() || undefined };
    this.reports.downloadMatchesHistory(params).subscribe({
      next: (blob) => this.saveBlob(blob, 'historial_partidos.pdf'),
      error: (e: HttpErrorResponse) => this.errorMsg.set(this.humanError(e)),
    });
  }

  downloadMatchRoster() {
    this.errorMsg.set('');
    const mid = this.matchId();
    if (!mid) {
      this.errorMsg.set('Ingresa un Match ID.');
      return;
    }
    this.reports.downloadMatchRoster(mid).subscribe({
      next: (blob) => this.saveBlob(blob, `roster_${mid}.pdf`),
      error: (e: HttpErrorResponse) => this.errorMsg.set(this.humanError(e)),
    });
  }

  // ===== Nuevos PDF =====
  downloadStandings() {
    this.errorMsg.set('');
    this.reports.downloadStandings().subscribe({
      next: (blob) => this.saveBlob(blob, 'standings.pdf'),
      error: (e: HttpErrorResponse) => this.errorMsg.set(this.humanError(e)),
    });
  }

  downloadAllPlayers() {
    this.errorMsg.set('');
    this.reports.downloadAllPlayers().subscribe({
      next: (blob) => this.saveBlob(blob, 'players_all.pdf'),
      error: (e: HttpErrorResponse) => this.errorMsg.set(this.humanError(e)),
    });
  }

  downloadStatsSummary() {
    this.errorMsg.set('');
    this.reports.downloadStatsSummary().subscribe({
      next: (blob) => this.saveBlob(blob, 'stats_summary.pdf'),
      error: (e: HttpErrorResponse) => this.errorMsg.set(this.humanError(e)),
    });
  }

  // ===== Vistas JSON en UI =====
  viewStandings() {
    this.errorMsg.set('');
    this.reports.getStandingsJson().subscribe({
      next: (res) => {
        const rows: StandingRow[] = (res?.data ?? []).map((s: any) => ({
          name: String(s.team ?? s.name ?? ''),
          wins: Number(s.wins ?? 0),
        }));
        this.dialog.open(StandingsDialogComponent, {
          data: { rows },
          width: '520px',
        });
      },
      error: (e: HttpErrorResponse) => this.errorMsg.set(this.humanError(e)),
    });
  }

  private humanError(e: HttpErrorResponse): string {
    if (e.status === 401) return 'No autorizado (revisa sesión / token).';
    if (e.status === 502) return 'Gateway error (¿Nginx inyecta el RS_TOKEN?).';
    if (e.status === 500) return 'Error del servidor de reportes.';
    return `Error ${e.status || ''}`.trim();
  }

  onMatchIdChange(value: any) {
    if (value === null || value === undefined || String(value).trim() === '') {
      this.matchId.set(null);
    } else {
      this.matchId.set(+value);
    }
  }
}
