import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { ReportsService, StandingRow } from '@app/services/api/reports.service';
import { StandingsDialogComponent } from '../standings/standings-dialog.component';

type Team = { id: number; name: string };
type StatItem = {
  teamId: number; team: string;
  played: number; wins: number; losses: number; pf: number; pa: number; diff: number;
};
type StatsSummary = {
  topWins: StatItem[]; topPF: StatItem[]; minPF: StatItem[]; minLosses: StatItem[];
};

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

  // === Datos para combos ===
  teams = signal<Team[]>([]);
  loadingTeams = signal<boolean>(true);

  // === Filtros/inputs ===
  teamId = signal<number | null>(null);
  from = signal<string>('');  // yyyy-mm-dd
  to = signal<string>('');
  matchId = signal<number | null>(null);

  // === Estado/UI ===
  errorMsg = signal<string>('');
  loadingStandings = signal<boolean>(false);
  loadingStats = signal<boolean>(false);

  // === Datos mostrados en la página ===
  standingsRows = signal<StandingRow[]>([]);
  stats = signal<StatsSummary | null>(null);

  constructor() {
    this.loadTeams();
    this.loadStandings();     // ⬅️ Carga automática
    this.loadStatsSummary();  // ⬅️ Carga automática
  }

  // ---------------------------
  // Carga de combos
  // ---------------------------
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

  // ---------------------------
  // Carga de datos mostrados
  // ---------------------------
  loadStandings() {
    this.loadingStandings.set(true);
    this.errorMsg.set('');

    this.reports.getStandingsJson().subscribe({
      next: (payload) => {
        // Puede venir como {total, data} o como arreglo plano
        const raw = Array.isArray(payload) ? payload : payload?.data ?? [];
        const rows: StandingRow[] = (raw as any[]).map((r, i) => ({
          rank: Number(r.rank ?? i + 1),
          teamId: Number(r.teamId ?? r.id ?? 0),
          team: String(r.team ?? r.name ?? ''),
          played: Number(r.played ?? r.PJ ?? 0),
          wins: Number(r.wins ?? r.PG ?? r.victories ?? 0),
          losses: Number(r.losses ?? r.PP ?? r.derrotas ?? 0),
          pf: Number(r.pf ?? r.PF ?? 0),
          pa: Number(r.pa ?? r.PC ?? 0),
          diff: Number(r.diff ?? (Number(r.pf ?? 0) - Number(r.pa ?? 0))),
        }));
        this.standingsRows.set(rows);
        this.loadingStandings.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.loadingStandings.set(false);
        this.errorMsg.set(this.humanError(e));
      },
    });
  }

  loadStatsSummary() {
    this.loadingStats.set(true);
    this.errorMsg.set('');

    this.reports.getStatsSummaryJson().subscribe({
      next: (data: any) => {
        const normList = (arr: any[]) => (arr ?? []).map((s: any) => ({
          teamId: Number(s.teamId ?? 0),
          team: String(s.team ?? ''),
          played: Number(s.played ?? 0),
          wins: Number(s.wins ?? 0),
          losses: Number(s.losses ?? 0),
          pf: Number(s.pf ?? 0),
          pa: Number(s.pa ?? 0),
          diff: Number(s.diff ?? (Number(s.pf ?? 0) - Number(s.pa ?? 0))),
        }));

        const value: StatsSummary = {
          topWins: normList(data?.topWins),
          topPF: normList(data?.topPF),
          minPF: normList(data?.minPF),
          minLosses: normList(data?.minLosses),
        };
        this.stats.set(value);
        this.loadingStats.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.loadingStats.set(false);
        this.errorMsg.set(this.humanError(e));
      },
    });
  }

  // ---------------------------
  // Acciones (PDF / diálogo)
  // ---------------------------
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
    if (!tid) { this.errorMsg.set('Selecciona un equipo.'); return; }
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
    if (!mid) { this.errorMsg.set('Ingresa un Match ID.'); return; }
    this.reports.downloadMatchRoster(mid).subscribe({
      next: (blob) => this.saveBlob(blob, `roster_${mid}.pdf`),
      error: (e: HttpErrorResponse) => this.errorMsg.set(this.humanError(e)),
    });
  }

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

  viewStandings() {
    this.dialog.open(StandingsDialogComponent, {
      width: '720px',
      data: { rows: this.standingsRows() },
      panelClass: 'glass-dialog'
    });
  }

  // ---------------------------
  // Utilidades
  // ---------------------------
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
