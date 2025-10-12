import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

interface AdminCard {
  title: string;
  desc: string;
  to: string;
  accent: string;
}

const CARDS: AdminCard[] = [
  { title: 'Jugadores', desc: 'Gestiona plantillas y altas.', to: '/players', accent: 'linear-gradient(135deg, #38bdf8, #2563eb)' },
  { title: 'Equipos', desc: 'Configura colores, identidades y roster.', to: '/teams', accent: 'linear-gradient(135deg, #f97316, #ef4444)' },
  { title: 'Torneos', desc: 'Organiza llaves y clasificaciones.', to: '/tournaments', accent: 'linear-gradient(135deg, #22c55e, #16a34a)' },
  { title: 'Partidos', desc: 'Programa y controla partidos recientes.', to: '/matches', accent: 'linear-gradient(135deg, #a855f7, #6366f1)' }
];

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css'
})
export class AdminDashboardComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly user = this.auth.user;
  protected readonly cards = CARDS;
  protected readonly menuOpen = signal(false);
  protected readonly userName = computed(() => this.user()?.name ?? '');

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  logout(): void {
    this.menuOpen.set(false);
    this.auth.logout();
    void this.router.navigate(['/login']);
  }
}
