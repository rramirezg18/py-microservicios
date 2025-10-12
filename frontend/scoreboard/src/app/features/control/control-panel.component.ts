import { CommonModule } from '@angular/common';
import { Location } from '@angular/common';
import { Component, computed, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ScoreboardService } from '../../core/services/scoreboard.service';
import { formatSeconds } from '../../core/utils/time';

@Component({
  selector: 'app-control-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './control-panel.component.html',
  styleUrl: './control-panel.component.css'
})
export class ControlPanelComponent {
  private readonly scoreboard = inject(ScoreboardService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);

  protected readonly matchId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('matchId'))),
    { initialValue: null }
  );

  protected readonly home = this.scoreboard.home;
  protected readonly away = this.scoreboard.away;
  protected readonly quarter = this.scoreboard.quarter;
  protected readonly possession = this.scoreboard.possession;
  protected readonly timer = this.scoreboard.timer;
  protected readonly gameOver = this.scoreboard.gameOver;
  protected readonly loading = this.scoreboard.loading;
  protected readonly error = this.scoreboard.error;
  protected readonly timerSeconds = computed(() => {
    const timer = this.timer();
    return timer.mode === 'timeout' ? timer.timeoutRemaining : timer.periodRemaining;
  });
  protected readonly formattedTimer = computed(() => formatSeconds(this.timerSeconds()));
  protected readonly clockLabel = computed(() =>
    this.timer().mode === 'timeout' ? 'Timeout' : 'Period Time'
  );
  protected readonly isTimeout = computed(() => {
    const timer = this.timer();
    return timer.mode === 'timeout' && timer.timeoutRemaining > 0;
  });
  protected readonly timerRunning = computed(() => {
    const timer = this.timer();
    return timer.running && timer.mode === 'period';
  });
  protected readonly status = computed(() => {
    if (this.loading()) {
      return 'Cargando';
    }
    if (this.gameOver()) {
      return 'Finalizado';
    }
    if (this.isTimeout()) {
      return 'Timeout';
    }
    return this.timerRunning() ? 'Running' : 'Paused';
  });
  protected readonly canScore = computed(() => !this.isTimeout());

  constructor() {
    effect(() => {
      void this.scoreboard.loadMatch(this.matchId());
    });
  }

  startPeriod(): void {
    void this.scoreboard.startPeriod();
  }

  resumeTimer(): void {
    void this.scoreboard.resumeTimer();
  }

  stopTimer(): void {
    void this.scoreboard.stopTimer();
  }

  resetTimer(): void {
    void this.scoreboard.resetTimer();
  }

  startTimeout(seconds: number): void {
    this.scoreboard.startTimeout(seconds);
  }

  changeQuarter(delta: number): void {
    void this.scoreboard.changeQuarter(delta);
  }

  setPossession(possession: 'home' | 'away' | 'none'): void {
    this.scoreboard.setPossession(possession);
  }

  adjustScore(team: 'home' | 'away', delta: number): void {
    void this.scoreboard.adjustScore(team, delta);
  }

  adjustFouls(team: 'home' | 'away', delta: number): void {
    void this.scoreboard.adjustFouls(team, delta);
  }

  goScoreboard(): void {
    const matchId = this.matchId();
    void this.router.navigate(matchId ? ['/scoreboard', matchId] : ['/scoreboard']);
  }

  goBack(): void {
    this.location.back();
  }

  chooseMatch(): void {
    void this.router.navigate(['/matches']);
  }

  goAdmin(): void {
    void this.router.navigate(['/admin']);
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
