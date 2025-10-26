import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

// Servicios propios
import { TeamService } from '../../services/api/team.service';
import { MatchesService } from '../../services/api/matches.service';

type Team = { id: number; name: string };

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss'],
})
export class AdminDashboardComponent implements OnInit {
  // Inyección
  private readonly router = inject(Router);
  private readonly teamService = inject(TeamService);
  private readonly matchesService = inject(MatchesService);

  // UI
  isAdmin = true;           // usa tu lógica real si aplica
  logoutOpen = false;
  scheduleOpen = false;

  // Navegación
  matchId: number | null = null;

  // Datos para Programar partido
  teams: Team[] = [];
  homeTeamId?: number;
  awayTeamId?: number;
  date = '';          // YYYY-MM-DD
  time = '';          // HH:mm
  minutes = 10;       // duración por cuarto
  isScheduling = false;

  ngOnInit(): void {
    this.teamService.getAll().subscribe({
      next: (res: any) => this.teams = (res?.items ?? res ?? []) as Team[],
      error: () => console.error('No se pudieron cargar los equipos'),
    });
  }

  // Cerrar menú de logout al hacer click fuera
  @HostListener('document:click')
  closeLogoutOnOutsideClick(): void {
    if (this.logoutOpen) this.logoutOpen = false;
  }

  toggleLogout(ev: Event): void {
    ev.stopPropagation();
    this.logoutOpen = !this.logoutOpen;
  }

  logout(): void {
    this.logoutOpen = false;
    this.router.navigate(['/login']);
  }

  schedule(ev?: Event): void {
    ev?.preventDefault();

    if (!this.homeTeamId || !this.awayTeamId || !this.date || !this.time) {
      alert('Completa todos los campos');
      return;
    }
    if (this.homeTeamId === this.awayTeamId) {
      alert('El local y el visitante deben ser distintos');
      return;
    }

    // Construye ISO local y UTC (enviamos ambos por compatibilidad)
    const localIso = `${this.date}T${this.time}:00`;
    const isoUtc = new Date(localIso).toISOString();

    const dto: any = {
      homeTeamId: this.homeTeamId,
      awayTeamId: this.awayTeamId,
      dateMatch: localIso,             // si tu API espera DateMatch local
      dateMatchUtc: isoUtc,            // si tu API espera UTC
      quarterDurationSeconds: Math.round(this.minutes * 60),
    };

    this.isScheduling = true;
    this.matchesService.programar(dto).subscribe({
      next: (res: any) => {
        this.isScheduling = false;
        this.scheduleOpen = false;

        const id = res?.matchId ?? res?.id;
        if (id) {
          this.matchId = id;
          this.router.navigate(['/control', id]);
        } else {
          alert('Partido programado, pero no se recibió ID.');
        }
      },
      error: (err) => {
        this.isScheduling = false;
        const msg = err?.error?.error ?? 'No se pudo programar el partido';
        alert(msg);
      },
    });
  }
}
