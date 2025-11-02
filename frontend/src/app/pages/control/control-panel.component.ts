import { CommonModule } from '@angular/common';
import { Component, OnDestroy, computed, inject, signal, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import * as signalR from '@microsoft/signalr';

import { MatchesService, MatchModel, TeamSide } from '@app/services/api/matches.service';
import { TournamentsStore } from '@app/pages/tournaments/tournaments.store';
import { PickMatchDialogComponent } from './match-dialog.component';

@Component({
  selector: 'app-control-panel',
  standalone: true,
  imports: [CommonModule, RouterLink, MatDialogModule, MatIconModule, FormsModule],
  templateUrl: './control-panel.component.html',
  styleUrls: ['./control-panel.component.scss']
})
export class ControlPanelComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly matchesService = inject(MatchesService);
  private readonly dialog = inject(MatDialog);
  private readonly tournamentsStore = inject(TournamentsStore);
  private readonly cdr = inject(ChangeDetectorRef);

  private hub?: signalR.HubConnection;

  match = signal<MatchModel | null>(null);
  loading = signal<boolean>(false);
  pendingAction = signal<boolean>(false);
  private countdownTimer?: ReturnType<typeof setInterval>;
  private countdownEndsAt?: number;

  timerDisplay = computed(() => {
    const seconds = this.match()?.timeRemaining ?? 0;
    const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = Math.max(0, seconds % 60).toString().padStart(2, '0');
    return `${minutes}:${secs}`;
  });

  statusLabel = computed(() => {
    const status = (this.match()?.status ?? '').toLowerCase();
    switch (status) {
      case 'scheduled': return 'Programado';
      case 'live': return 'En juego';
      case 'finished': return 'Finalizado';
      default: return this.match()?.status ?? '—';
    }
  });

  constructor() {
    this.route.paramMap.subscribe(params => {
      const rawId = params.get('id');
      const id = rawId ? Number(rawId) : 1; // 👈 fallback por defecto
      console.log('[ControlPanel] Cargando partido con ID', id);
      if (Number.isFinite(id) && id > 0) this.loadMatch(id);
    });
  }

  ngOnDestroy(): void {
    this.clearCountdown();
    this.disconnectHub();
  }

  get hasMatchSelected(): boolean { return !!this.match(); }
  get matchId(): number | null { return this.match()?.id ?? null; }
  get homeName(): string { return this.match()?.homeTeamName || 'Local'; }
  get awayName(): string { return this.match()?.awayTeamName || 'Visita'; }
  get quarter(): number { return this.match()?.quarter ?? 1; }
  get isFinished(): boolean { return (this.match()?.status ?? '').toLowerCase() === 'finished'; }

  // ===========================
  //  SELECCIÓN / RECARGA
  // ===========================
  chooseMatch(): void {
    const dialogRef = this.dialog.open(PickMatchDialogComponent, { width: '700px' });
    dialogRef.afterClosed().subscribe(result => {
      if (!result?.id) return;
      this.router.navigate(['/control', result.id]);
    });
  }

  refresh(): void {
    const id = this.matchId;
    if (id) this.loadMatch(id);
  }

  // ===========================
  //  MARCADOR Y FALTAS
  // ===========================
  addPoints(team: TeamSide, points: number): void {
    if (!this.matchId || this.isFinished) return;
    this.pendingAction.set(true);
    this.matchesService.addScore(this.matchId, team, points).subscribe({
      next: updated => {
        this.mergeMatch({
          homeScore: updated.homeScore,
          awayScore: updated.awayScore,
          status: updated.status
        });
        this.pendingAction.set(false);
        this.cdr.detectChanges();
      },
      error: error => this.handleError('No se pudo actualizar el marcador', error)
    });
  }

  adjustFoul(team: TeamSide, amount: number): void {
    if (!this.matchId || this.isFinished) return;
    this.pendingAction.set(true);
    this.matchesService.addFoul(this.matchId, team, amount).subscribe({
      next: updated => {
        this.mergeMatch({
          foulsHome: updated.foulsHome,
          foulsAway: updated.foulsAway
        });
        this.pendingAction.set(false);
        this.cdr.detectChanges();
      },
      error: error => this.handleError('No se pudo registrar la falta', error)
    });
  }

  // ===========================
  //  TEMPORIZADOR
  // ===========================
  controlTimer(action: 'start' | 'pause' | 'resume' | 'reset'): void {
    if (!this.matchId || this.isFinished) return;
    this.pendingAction.set(true);
    const currentSeconds = this.match()?.timeRemaining ?? 0;
    this.matchesService.updateTimer(this.matchId, action, currentSeconds).subscribe({
      next: updated => {
        this.mergeMatch(updated);
        this.configureCountdown(updated.timerRunning, updated.timeRemaining);
        this.pendingAction.set(false);
        this.cdr.detectChanges();
      },
      error: error => this.handleError('No se pudo actualizar el temporizador', error)
    });
  }

  nextQuarter(): void {
    if (!this.matchId || this.isFinished) return;
    this.pendingAction.set(true);
    this.matchesService.nextQuarter(this.matchId).subscribe({
      next: updated => {
        this.mergeMatch(updated);
        this.configureCountdown(updated.timerRunning, updated.timeRemaining);
        this.pendingAction.set(false);
        this.cdr.detectChanges();

        const q = updated.quarter ?? 1;
        const doneThisQuarter = (updated.timeRemaining ?? 0) <= 0 && !updated.timerRunning;
        if (!this.isFinished && (q >= 4 && doneThisQuarter)) {
          this.finalizeWithCurrentScore(true);
        }
      },
      error: error => this.handleError('No se pudo avanzar de cuarto', error)
    });
  }

  // ===========================
  //  FINALIZAR PARTIDO
  // ===========================
  finishMatch(): void {
    if (!this.matchId || this.isFinished) return;
    Swal.fire({
      title: 'Finalizar partido',
      text: '¿Deseas marcar el partido como finalizado?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, finalizar',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (!result.isConfirmed) return;
      this.finalizeWithCurrentScore(false);
    });
  }

  private finalizeWithCurrentScore(silent: boolean): void {
    if (!this.matchId) return;
    const current = this.match();
    const payload = {
      homeScore: current?.homeScore ?? 0,
      awayScore: current?.awayScore ?? 0
    };

    this.pendingAction.set(true);
    this.matchesService.finishMatch(this.matchId, payload).subscribe({
      next: updated => {
        this.mergeMatch({
          ...updated,
          status: 'finished',
          timerRunning: false,
          timeRemaining: 0
        });
        this.configureCountdown(false, 0);
        this.syncTournamentBracket(updated);
        this.pendingAction.set(false);
        this.cdr.detectChanges();

        if (!silent) {
          Swal.fire({
            title: 'Partido finalizado',
            text: `Marcador final ${payload.homeScore} - ${payload.awayScore}`,
            icon: 'success',
            timer: 1800,
            showConfirmButton: false
          });
        }
      },
      error: error => this.handleError('No se pudo finalizar el partido', error)
    });
  }

  // ===========================
  //  HUB / CARGA / ESTADO LOCAL
  // ===========================
  private loadMatch(id: number): void {
    this.loading.set(true);
    this.matchesService.getMatch(id).subscribe({
      next: match => {
        this.loading.set(false);
        this.match.set(match);
        this.configureCountdown(match.timerRunning, match.timeRemaining);
        this.connectToHub(match.id);
        this.cdr.detectChanges();
      },
      error: error => {
        this.loading.set(false);
        this.match.set(null);
        this.handleError('No se pudo cargar el partido', error);
      }
    });
  }

  private async connectToHub(matchId: number): Promise<void> {
    // 🧩 Validar matchId
    if (!matchId || matchId <= 0 || Number.isNaN(matchId)) {
      console.warn('[SignalR] matchId inválido, usando valor 1 por defecto');
      matchId = 1;
    }

    await this.disconnectHub();

    const getToken = () =>
      localStorage.getItem('token') ||
      sessionStorage.getItem('token') ||
      '';

    this.hub = new signalR.HubConnectionBuilder()
      .withUrl(`/hub/matches?matchId=${matchId}`, {
        accessTokenFactory: getToken,
        transport: signalR.HttpTransportType.WebSockets,
        skipNegotiation: false
      })
      .withAutomaticReconnect()
      .build();

    // 🏀 Marcador
    this.hub.on('scoreUpdated', (p: any) => {
      console.log('[SignalR] scoreUpdated', p);
      this.mergeMatch({
        homeScore: p.homeScore ?? p.HomeScore ?? 0,
        awayScore: p.awayScore ?? p.AwayScore ?? 0
      });
      this.cdr.detectChanges();
    });

    // 🚨 Faltas
    this.hub.on('foulsUpdated', (p: any) => {
      console.log('[SignalR] foulsUpdated', p);
      const foulsHome = p.foulsHome ?? p.homeFouls ?? 0;
      const foulsAway = p.foulsAway ?? p.awayFouls ?? 0;
      this.mergeMatch({ foulsHome, foulsAway });
      this.cdr.detectChanges();
    });

    // 🕐 Cambio de cuarto
    this.hub.on('quarterChanged', (p: { quarter: number }) => {
      console.log('[SignalR] quarterChanged', p);
      if (typeof p?.quarter === 'number') {
        this.mergeMatch({ quarter: p.quarter });
        this.cdr.detectChanges();
      }
    });

    try {
      await this.hub.start();
      console.log(`✅ [SignalR] Conectado correctamente al grupo match-${matchId}`);
    } catch (error) {
      console.error('❌ No se pudo conectar al hub de partidos:', error);
    }
  }

  private async disconnectHub(): Promise<void> {
    if (this.hub) {
      try { await this.hub.stop(); } catch {}
      this.hub = undefined;
    }
  }

  private mergeMatch(partial: Partial<MatchModel>): void {
    const current = this.match();
    if (!current) return;
    this.match.set({ ...current, ...partial });
  }

  // ===========================
  //  TEMPORIZADOR LOCAL
  // ===========================
  private configureCountdown(running: boolean, seconds: number): void {
    this.clearCountdown();
    this.match.update(current =>
      current ? { ...current, timerRunning: running, timeRemaining: seconds } : current
    );

    if (!running || seconds <= 0) return;

    this.countdownEndsAt = Date.now() + seconds * 1000;
    this.countdownTimer = setInterval(() => {
      if (this.countdownEndsAt === undefined) return;
      const remaining = Math.max(0, Math.floor((this.countdownEndsAt - Date.now()) / 1000));
      this.match.update(current => (current ? { ...current, timeRemaining: remaining } : current));
      if (remaining <= 0) {
        this.clearCountdown();
        this.match.update(current => (current ? { ...current, timerRunning: false } : current));
      }
    }, 250);
  }

  private clearCountdown(): void {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    this.countdownTimer = undefined;
    this.countdownEndsAt = undefined;
  }

  private syncTournamentBracket(updated: MatchModel): void {
    void this.tournamentsStore
      .updateMatchResult('cup-current', String(updated.id), updated.homeScore, updated.awayScore)
      .catch(() => {});
  }

  private handleError(message: string, error: any): void {
    this.pendingAction.set(false);
    console.error(message, error);
    Swal.fire({
      title: message,
      text: error?.error?.error ?? error?.message ?? 'Error desconocido',
      icon: 'error'
    });
  }
}
