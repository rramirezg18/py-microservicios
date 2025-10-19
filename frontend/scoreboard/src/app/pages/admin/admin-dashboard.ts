import { Component, ElementRef, HostListener, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { AuthenticationService } from '../../core/services/authentication.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-dashboard.html',
  styleUrls: ['./admin-dashboard.css']
})
export class AdminDashboardComponent {
  auth = inject(AuthenticationService);
  private router = inject(Router);

  // id de partido por defecto para los enlaces de Score / Control
  matchId = 1;

  // dropdown de logout
  logoutOpen = false;
  @ViewChild('logoutWrap') logoutWrap?: ElementRef<HTMLElement>;

  toggleLogout(ev?: MouseEvent) {
    ev?.stopPropagation();
    this.logoutOpen = !this.logoutOpen;
  }

  @HostListener('document:click', ['$event'])
  closeIfClickOutside(ev: MouseEvent) {
    if (!this.logoutOpen || !this.logoutWrap) return;
    if (!this.logoutWrap.nativeElement.contains(ev.target as Node)) {
      this.logoutOpen = false;
    }
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
