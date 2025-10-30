import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import {
  ReportsService,
  StandingRow,
  StatsSummarySnapshot,
} from '@app/services/api/reports.service';
import { StandingsDialogComponent } from '@app/pages/standings/standings-dialog.component';

interface TeamOption {
  id: number;
  name: string;
}

@Component({
  standalone: true,
  selector: 'app-reports-page',
  imports: [CommonModule, FormsModule, MatDialogModule],
  templateUrl: './reports-page.component.html',
  styleUrls: ['./reports-page.component.scss'],
})
export class ReportsPage {
  private readonly http = inject(HttpClient);
  private readonly reports = inject(ReportsService);
  private readonly dialog = inject(MatDialog);

  readonly teams = signal<TeamOption[]>([]);
  readonly loadingTeams = signal<boolean>(true);
  readonly teamId = signal<number | null>(null);

  readonly from = signal<string>('');
  readonly to = signal<string>('');
  readonly matchId = signal<number | null>(null);

  readonly standings = signal<StandingRow[]>([]);
  readonly standingsLoading = signal<boolean>(true);
  readonly standingsError = signal<string>('');

  readonly statsSummary = signal<StatsSummarySnapshot | null>(null);
  readonly statsLoading = signal<boolean>(true);
  readonly statsError = signal<string>('');

  readonly downloadError = signal<string>('');

  constructor() {
    this.loadTeams();
    this.loadStandings();
    this.loadStatsSummary();
  }

  private loadTeams(): void {
    this.loadingTeams.set(true);
    this.http.get<any>('/api/teams').subscribe({
      next: (res) => {
        const items: TeamOption[] = Array.isArray(res?.items)
          ? res.items
          : Array.isArray(res)
          ? res
          : [];
        this.teams.set(items);
        this.loadingTeams.set(false);
      },
      error: () => {
        this.loadingTeams.set(false);
      },
    });
  }

  private loadStandings(): void {
    this.standingsLoading.set(true);
    this.standingsError.set('');
    this.reports.getStandings().subscribe({
      next: (rows) => {
        this.standings.set(rows ?? []);
        this.standingsLoading.set(false);
      },
      error: () => {
        this.standings.set([]);
        this.standingsLoading.set(false);
        this.standingsError.set('No se pudo cargar la tabla de posiciones.');
      },
    });
  }

  private loadStatsSummary(): void {
    this.statsLoading.set(true);
    this.statsError.set('');
    this.reports.getStatsSummary().subscribe({
      next: (snapshot) => {
        this.statsSummary.set(snapshot);
        this.statsLoading.set(false);
      },
      error: () => {
        this.statsSummary.set(null);
        this.statsLoading.set(false);
        this.statsError.set('No se pudo cargar el resumen estadistico.');
      },
    });
  }

  private saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    URL.revokeObjectURL(url);
    anchor.remove();
  }

  // ---------- Descargas PDF ----------
  downloadTeamsPdf(): void {
    this.handleDownload(this.reports.downloadTeams(), 'equipos.pdf');
  }

  downloadPlayersByTeamPdf(): void {
    this.downloadError.set('');
    if (!this.teamId()) {
      this.downloadError.set('Selecciona un equipo.');
      return;
    }
    this.handleDownload(
      this.reports.downloadPlayersByTeam(this.teamId()!),
      `jugadores_${this.teamId()}.pdf`
    );
  }

  downloadMatchesHistoryPdf(): void {
    const params = {
      from: this.from() || undefined,
      to: this.to() || undefined,
    };
    this.handleDownload(
      this.reports.downloadMatchesHistory(params),
      'historial_partidos.pdf'
    );
  }

  downloadMatchRosterPdf(): void {
    this.downloadError.set('');
    if (!this.matchId()) {
      this.downloadError.set('Ingresa un Match ID.');
      return;
    }
    this.handleDownload(
      this.reports.downloadMatchRoster(this.matchId()!),
      `roster_${this.matchId()}.pdf`
    );
  }

  downloadStandingsPdf(): void {
    this.handleDownload(this.reports.downloadStandings(), 'standings.pdf');
  }

  downloadAllPlayersPdf(): void {
    this.handleDownload(this.reports.downloadAllPlayers(), 'players_all.pdf');
  }

  downloadStatsSummaryPdf(): void {
    this.handleDownload(
      this.reports.downloadStatsSummary(),
      'stats_summary.pdf'
    );
  }

  private handleDownload(observable: Observable<Blob>, filename: string): void {
    this.downloadError.set('');
    observable.subscribe({
      next: (blob) => this.saveBlob(blob, filename),
      error: (error: HttpErrorResponse) =>
        this.downloadError.set(this.describeError(error)),
    });
  }

  openStandingsDialog(): void {
    if (!this.standings().length) {
      return;
    }
    this.dialog.open(StandingsDialogComponent, {
      width: '520px',
      data: { rows: this.standings() },
    });
  }

  private describeError(error: HttpErrorResponse): string {
    if (error.status === 0) return 'Sin conexion con el servidor de reportes.';
    if (error.status === 401) return 'No autorizado (revisa sesion / token).';
    if (error.status === 502) return 'Gateway error (revisa report-service).';
    if (error.status === 500) return 'Error interno del servicio de reportes.';
    return `Error ${error.status}`;
  }
}
