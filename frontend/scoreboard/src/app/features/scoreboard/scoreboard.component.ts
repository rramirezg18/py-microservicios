import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ScoreboardService } from '../../core/services/scoreboard.service';
import { HudBarComponent } from '../../shared/components/hud-bar/hud-bar.component';
import { FoulsPanelComponent } from '../../shared/components/scoreboard/fouls-panel/fouls-panel.component';
import { TeamPanelComponent } from '../../shared/components/scoreboard/team-panel/team-panel.component';
import { QuarterIndicatorComponent } from '../../shared/components/scoreboard/quarter-indicator/quarter-indicator.component';
import { TimerDisplayComponent } from '../../shared/components/scoreboard/timer-display/timer-display.component';

@Component({
  selector: 'app-scoreboard',
  standalone: true,
  imports: [
    CommonModule,
    HudBarComponent,
    FoulsPanelComponent,
    TeamPanelComponent,
    QuarterIndicatorComponent,
    TimerDisplayComponent
  ],
  templateUrl: './scoreboard.component.html',
  styleUrl: './scoreboard.component.css'
})
export class ScoreboardComponent {
  private readonly auth = inject(AuthService);
  private readonly scoreboard = inject(ScoreboardService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly matchId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('matchId'))),
    { initialValue: null }
  );
  protected readonly home = this.scoreboard.home;
  protected readonly away = this.scoreboard.away;
  protected readonly quarter = this.scoreboard.quarter;
  protected readonly possession = this.scoreboard.possession;
  protected readonly timer = this.scoreboard.timer;
  protected readonly loading = this.scoreboard.loading;
  protected readonly error = this.scoreboard.error;
  protected readonly timerSeconds = computed(() => {
    const timer = this.timer();
    return timer.mode === 'timeout' ? timer.timeoutRemaining : timer.periodRemaining;
  });
  protected readonly timerMode = computed(() => this.timer().mode);
  protected readonly isAdmin = computed(() => this.auth.hasRole('admin'));

  constructor() {
    effect(() => {
      void this.scoreboard.loadMatch(this.matchId());
    });
  }

  onLogout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
