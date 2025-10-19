import { Component, computed, effect, inject, OnDestroy, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser, NgIf } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import Swal from 'sweetalert2';

import { StandingsDialogComponent } from '../../standings/standings-dialog';

import { ApiService } from '../../../core/api';
import { RealtimeService } from '../../../core/realtime';
import { AuthenticationService } from '../../../core/services/authentication.service';

// Diálogos
import { NewGameDialogComponent } from '../../matches/new-game-dialog';
import { RegisterTeamDialogComponent } from '../../teams/register-team-dialog';
import { PickMatchDialogComponent } from './match.dialog'; // Elegir partido

type Possession = 'none' | 'home' | 'away';

@Component({
  selector: 'app-control-panel',
  standalone: true,
  imports: [RouterLink, MatDialogModule, NgIf],
  templateUrl: './control-panel.html',
  styleUrls: ['./control-panel.css']
})
export class ControlPanelComponent implements OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  public rt = inject(RealtimeService);
  private api = inject(ApiService);
  private platformId = inject(PLATFORM_ID);
  private dialog = inject(MatDialog);
  private auth = inject(AuthenticationService);

  // Id partido desde ruta
  matchId = toSignal(this.route.paramMap.pipe(map(p => Number(p.get('id') ?? '1'))), { initialValue: 1 });

  // Datos del partido
  homeTeamId?: number;
  awayTeamId?: number;
  homeName = 'HOME';
  awayName = 'AWAY';

  // Estado del partido y modo solo-lectura
  status = signal<string>('Scheduled');
  readOnly = computed(() => {
    const s = (this.status() || '').toLowerCase();
    return s === 'finished' || s === 'canceled' || s === 'suspended';
  });

  // Cuarto real desde RealtimeService
  period = computed(() => this.rt.quarter());

  // UI local
  possession = signal<Possession>('none');
  homeScore = signal(0);
  awayScore = signal(0);

  // Faltas desde RealtimeService
  homeFouls = computed(() => this.rt.fouls().home);
  awayFouls = computed(() => this.rt.fouls().away);

  // Sólo se puede anotar cuando corre el timer y no está bloqueado
  canScore = computed(() => this.rt.timerRunning() && !this.readOnly());

  // Reloj mm:ss desde timeLeft()
  clock = computed(() => {
    const tl = this.rt.timeoutRunning() ? this.rt.timeoutLeft() : this.rt.timeLeft();
    const m = Math.floor(tl / 60), s = tl % 60;
    return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  });

  // Auto-advance helpers
  private prevSecs = -1;
  private armed = true;
  private zeroGuardUntil = 0;
  private prevRunning = false;

  constructor() {
    // Sincroniza marcador local
    effect(() => {
      const s = this.rt.score();
      this.homeScore.set(s.home);
      this.awayScore.set(s.away);
    });

    // Fin de partido → SweetAlert con resultado
    effect(() => {
      const over = this.rt.gameOver?.();
      if (!over) return;
      this.showGameEndAlert(over.home, over.away, over.winner);
    });

    // AUTO-AVANCE con guardia para Stop/Reset
    effect(() => {
      const secs = this.rt.timeLeft();
      const running = this.rt.timerRunning();
      const guardActive = Date.now() < this.zeroGuardUntil;

      if (!guardActive && this.prevSecs > 0 && secs === 0 && this.prevRunning) {
        this.tryAutoAdvance();
      }
      if (secs > 0) this.armed = true;

      this.prevSecs = secs;
      this.prevRunning = running;
    });

    // Carga inicial + conexión realtime
    effect((onCleanup) => {
      const id = this.matchId();
      if (!id) return;

      this.api.getMatch(id).subscribe({
        next: (m: any) => {
          this.homeTeamId = m.homeTeamId;
          this.awayTeamId = m.awayTeamId;
          this.homeName = m.homeTeam ?? 'HOME';
          this.awayName = m.awayTeam ?? 'AWAY';
          this.homeScore.set(m.homeScore ?? 0);
          this.awayScore.set(m.awayScore ?? 0);
          this.status.set(m.status ?? 'Scheduled');

          if (typeof m.quarter === 'number') this.rt.quarter.set(m.quarter);
          if (m.timer) this.rt.hydrateTimerFromSnapshot({ ...m.timer, quarter: m.quarter });

          if (m.fouls) this.rt.hydrateFoulsFromSnapshot(m.fouls);
        },
        error: (e) => console.error('getMatch error', e)
      });

      let disposed = false;
      if (isPlatformBrowser(this.platformId)) {
        (async () => {
          try {
            await this.rt.disconnect();
            if (!disposed) await this.rt.connect(id);
          } catch (err) {
            console.error('SignalR connect error', err);
          }
        })();
      }

      onCleanup(() => { disposed = true; this.rt.disconnect(); });
    });
  }

  ngOnDestroy(): void { this.rt.disconnect(); }

  // Rol
  get isAdmin(): boolean {
    try {
      if (typeof this.auth.isAdmin === 'function') return this.auth.isAdmin();
      const saved = localStorage.getItem('user');
      const user = saved ? JSON.parse(saved) : null;
      return user?.role?.name?.toLowerCase() === 'admin';
    } catch { return false; }
  }

  // Navegación
  goBack() {
    if (this.isAdmin) this.router.navigate(['/admin']);
    else this.router.navigate(['/score', this.matchId()]);
  }
  goScoreboard() { this.router.navigate(['/score', this.matchId()]); }

  logout() {
    if (typeof this.auth.logout === 'function') this.auth.logout();
    else { localStorage.removeItem('token'); localStorage.removeItem('user'); }
    this.router.navigate(['/login']);
  }

  // Elegir partido
  openPickMatch() {
    const ref = this.dialog.open(PickMatchDialogComponent, {
      width: '720px',
      disableClose: false
    });
    ref.afterClosed().subscribe((row?: { id: number }) => {
      if (!row) return;
      this.router.navigate(['/control', row.id]);
    });
  }

  // Compat: alias
  newGame() { this.newGameFromRegistered(); }

  // Guard genérico
  private denyIfLocked(): boolean {
    if (!this.readOnly()) return false;
    Swal.fire({
      icon: 'info',
      title: 'Partido bloqueado',
      text: 'Este partido ya finalizó o no admite cambios.',
      timer: 1600,
      showConfirmButton: false,
      position: 'top'
    });
    return true;
  }

  // Auto-advance
  private tryAutoAdvance(retry = 0) {
    const id = this.matchId();
    const prevQuarter = this.rt.quarter();

    this.api.autoAdvanceQuarter(id).subscribe({
      next: (res: any) => {
        const q = res?.quarter ?? prevQuarter;
        const ended = q > prevQuarter ? q - 1 : q;
        if (ended < 4) this.showQuarterEndAlert(ended);
      },
      error: (e) => {
        if (retry < 8) setTimeout(() => this.tryAutoAdvance(retry + 1), 300);
        else console.warn('autoAdvanceQuarter no confirmó el fin del cuarto', e);
      }
    });
  }

  // Puntos
  add(teamId: number | undefined, points: 1 | 2 | 3) {
    if (!teamId || !this.canScore()) return;
    this.api.createScore(this.matchId(), { teamId, points }).subscribe();
  }
  minus1(teamId: number | undefined) {
    if (!teamId || !this.canScore()) return;
    this.api.adjustScore(this.matchId(), { teamId, delta: -1 }).subscribe();
  }

  // Faltas
  foul(teamId: number | undefined, delta: 1 | -1) {
    if (this.denyIfLocked()) return;
    if (!teamId) return;
    this.api.adjustFoul(this.matchId(), { teamId, delta }).subscribe();
  }

  // Timer
  start() {
    if (this.denyIfLocked()) return;
    this.api.startTimer(this.matchId()).subscribe({
      next: async () => {
        if (!isPlatformBrowser(this.platformId)) return;
        const q = this.rt.quarter();
        const names = ['', 'Primer', 'Segundo', 'Tercer', 'Cuarto'];
        await Swal.fire({
          title: `Inicio del ${names[q] ?? q + 'º'} cuarto`,
          icon: 'success',
          position: 'top',
          timer: 1200,
          showConfirmButton: false
        });
      },
      error: async (e) => {
        const status = e?.status;
        if (status === 403) {
          await Swal.fire({
            icon: 'error',
            title: 'Start timer',
            text: 'Necesitas rol Admin para iniciar el reloj.',
            confirmButtonText: 'OK'
          });
        } else if (status === 401) {
          await Swal.fire({
            icon: 'warning',
            title: 'Sesión requerida',
            text: 'Vuelve a iniciar sesión para continuar.',
            confirmButtonText: 'Ir a login'
          });
          this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
        } else {
          await Swal.fire({
            icon: 'error',
            title: 'Error al iniciar',
            text: e?.error ?? e?.message ?? 'Error desconocido'
          });
        }
      }
    });
  }

  stop() {
    if (this.denyIfLocked()) return;
    this.armed = false;
    this.prevSecs = 0;
    this.zeroGuardUntil = Date.now() + 1500;
    this.api.pauseTimer(this.matchId()).subscribe();
  }

  resume() {
    if (this.denyIfLocked()) return;
    this.api.resumeTimer(this.matchId()).subscribe();
  }

  reset() {
    if (this.denyIfLocked()) return;
    this.armed = false;
    this.prevSecs = 0;
    this.zeroGuardUntil = Date.now() + 1500;
    this.api.resetTimer(this.matchId()).subscribe();
  }

  timeout(sec: number) {
    if (this.denyIfLocked()) return;
    if (this.rt.timeoutRunning()) return;
    this.stop();
    this.rt.startTimeout(sec, () => this.resume());
  }

  // Periodo
  periodMinus() { /* no retroceder */ }
  periodPlus()  {
    if (this.denyIfLocked()) return;
    const ended = this.rt.quarter();
    this.api.advanceQuarter(this.matchId()).subscribe({
      next: async () => { await this.showQuarterEndAlert(ended); }
    });
  }

  // Posesión (visual local)
  posLeft()  { this.possession.set('home'); }
  posNone()  { this.possession.set('none'); }
  posRight() { this.possession.set('away'); }

  // Registrar equipo — SOLO ADMIN
  registerTeam() {
    if (!this.isAdmin) return;
    const ref = this.dialog.open(RegisterTeamDialogComponent, {
      width: '520px',
      disableClose: true
    });
    ref.afterClosed().subscribe(result => {
      if (!result) return;
      this.api.createTeam(result).subscribe({
        next: async (res: any) => {
          await Swal.fire({
            icon: 'success',
            title: `Team "${res?.name ?? result.name}" created`,
            timer: 1200, showConfirmButton: false, position: 'top'
          });
        },
        error: async (e) => {
          await Swal.fire({ icon: 'error', title: 'Error creating team', text: e?.error ?? e?.message ?? 'Unknown error' });
        }
      });
    });
  }

  // Nuevo partido con equipos registrados — SOLO ADMIN
  newGameFromRegistered() {
    if (!this.isAdmin) return;
    const ref = this.dialog.open(NewGameDialogComponent, {
      width: '520px',
      disableClose: true
    });
    ref.afterClosed().subscribe(result => {
      if (!result) return;
      this.api.newGameByTeams(result).subscribe({
        next: (res: any) => this.router.navigate(['/control', res.matchId]),
        error: async (e) => {
          await Swal.fire({ icon: 'error', title: 'Error creating match', text: e?.error ?? e?.message ?? 'Unknown error' });
        }
      });
    });
  }

  // Alerts
  private async showQuarterEndAlert(endedQuarter: number) {
    if (!isPlatformBrowser(this.platformId)) return;
    const names = ['', 'Primer', 'Segundo', 'Tercer', 'Cuarto'];
    const title = endedQuarter >= 1 && endedQuarter <= 4 ? `Fin del ${names[endedQuarter]} cuarto` : 'Fin de cuarto';
    await Swal.fire({
      title, icon: 'info', position: 'top', timer: 1600, timerProgressBar: true,
      showConfirmButton: false, backdrop: true, background: '#ffffff', color: '#111'
    });
  }

  private async showGameEndAlert(home: number, away: number, winner: 'home'|'away'|'draw') {
    if (!isPlatformBrowser(this.platformId)) return;

    let text = winner === 'draw' ? `Empate ${home} - ${away}` :
              winner === 'home' ? `¡Ganó ${this.homeName}! ${home} - ${away}` :
                                  `¡Ganó ${this.awayName}! ${away} - ${home}`;

    await Swal.fire({
      title: 'Fin del partido',
      text,
      icon: 'success',
      position: 'top',
      timer: 3000,
      timerProgressBar: true,
      showConfirmButton: false,
      backdrop: true,
      background: '#ffffff',
      color: '#111'
    });
  }

  showStandings() {
    this.api.getStandings().subscribe({
      next: (rows) => {
        this.dialog.open(StandingsDialogComponent, {
          width: '520px',
          data: { rows }
        });
      },
      error: (e) => console.error('getStandings error', e)
    });
  }
}
