import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, ViewChild, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthenticationService } from '@app/services/api/authentication.service';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss'],
})
export class AdminDashboardComponent {
  private readonly auth = inject(AuthenticationService);
  private readonly router = inject(Router);

  matchId = 1;
  logoutOpen = false;

  @ViewChild('logoutWrap') logoutWrap?: ElementRef<HTMLElement>;

  toggleLogout(event?: MouseEvent): void {
    event?.stopPropagation();
    this.logoutOpen = !this.logoutOpen;
  }

  @HostListener('document:click', ['$event'])
  closeIfClickOutside(event: MouseEvent): void {
    if (!this.logoutOpen || !this.logoutWrap) return;
    if (!this.logoutWrap.nativeElement.contains(event.target as Node)) {
      this.logoutOpen = false;
    }
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  get isAdmin(): boolean {
    try {
      return this.auth.isAdmin();
    } catch {
      return false;
    }
  }
}
