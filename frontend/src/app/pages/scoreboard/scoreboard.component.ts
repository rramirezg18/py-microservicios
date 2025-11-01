import { Component, computed, effect, inject, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import Swal from 'sweetalert2';

// Servicios API
import { ApiService } from '../../services/api/api.service';
import { RealtimeService } from '@app/services/realtime.service';
import { AuthenticationService } from '@app/services/api/authentication.service';

// Componentes compartidos
import { TeamPanelComponent } from '../../shared/components/team-panel/team-panel.component';
import { TimerComponent } from '../../shared/components/timer/timer.component';
import { QuarterIndicatorComponent } from '../../shared/components/quarter-indicator/quarter-indicator.component';
import { FoulsPanelComponent } from '../../shared/components/fouls-panel/fouls-panel.component';

@Component({
  selector: 'app-scoreboard',
  standalone: true,
  templateUrl: './scoreboard.component.html',
  styleUrls: ['./scoreboard.component.scss'],
  imports: [
    CommonModule,
    RouterModule,
    TeamPanelComponent,
    TimerComponent,
    QuarterIndicatorComponent,
    FoulsPanelComponent
  ]
})
export class ScoreboardComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  auth = inject(AuthenticationService);
  realtime = inject(RealtimeService);

  matchId = computed(() => Number(this.route.snapshot.paramMap.get('id') ?? '1'));

  homeName = 'HOME';
  awayName = 'AWAY';

  constructor() {
    effect(() => {
      const over = this.realtime.gameOver?.();
      if (!over || !isPlatformBrowser(this.platformId)) return;

      const text =
        over.winner === 'draw'
          ? `Empate ${over.home} - ${over.away}`
          : over.winner === 'home'
          ? `¡Ganó ${this.homeName}! ${over.home} - ${over.away}`
          : `¡Ganó ${this.awayName}! ${over.away} - ${over.home}`;

      Swal.fire({
        title: 'Fin del partido',
        text,
        icon: 'info',
        position: 'top',
        timer: 3000,
        timerProgressBar: true,
        showConfirmButton: false
      });
    });
  }

  private hydrateOnce(id: number) {
    this.api.getMatch(id).subscribe({
      next: (m: any) => {
        // Nombres
        this.homeName = m?.homeTeam?.name ?? m?.homeTeamName ?? 'HOME';
        this.awayName = m?.awayTeam?.name ?? m?.awayTeamName ?? 'AWAY';

        // Marcador y periodo
        if (typeof m.homeScore === 'number' && typeof m.awayScore === 'number') {
          this.realtime.score.set({ home: m.homeScore, away: m.awayScore });
        }
        if (typeof m.period === 'number') this.realtime.quarter.set(m.period);
        if (typeof m.quarter === 'number') this.realtime.quarter.set(m.quarter);

        // Timer snapshot (evita carrera del 1er cuarto)
        if (m?.timer) this.realtime.hydrateTimerFromSnapshot(m.timer);

        // Faltas
        const fouls = m?.fouls ?? {
          home: m?.homeFouls ?? 0,
          away: m?.awayFouls ?? 0
        };
        if (typeof fouls?.home === 'number' && typeof fouls?.away === 'number') {
          this.realtime.hydrateFoulsFromSnapshot(fouls);
        }
      },
      error: (err) => console.error('Error cargando match', err)
    });
  }

  ngOnInit(): void {
    const id = this.matchId();

    // 1) Primer hidratado (por si el hub tarda)
    this.hydrateOnce(id);

    // 2) Conexión al Hub y rehidratado inmediatamente después
    if (isPlatformBrowser(this.platformId)) {
      this.realtime
        .connect(id)
        .then(() => this.hydrateOnce(id)) // <<--- REHIDRATA tras unirte al grupo
        .catch((err) => console.error('Error al conectar realtime', err));
    }
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) this.realtime.disconnect();
  }

  get isAdmin(): boolean {
    try {
      if (typeof this.auth.isAdmin === 'function') return this.auth.isAdmin();
      const saved = localStorage.getItem('user');
      const user = saved ? JSON.parse(saved) : null;
      return user?.role?.name?.toLowerCase() === 'admin';
    } catch {
      return false;
    }
  }

  logout(): void {
    try {
      if (typeof this.auth.logout === 'function') this.auth.logout();
      else {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    } finally {
      this.router.navigate(['/login']);
    }
  }
}
