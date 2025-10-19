import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { AuthenticationService } from '../../core/services/authentication.service';

@Component({
  selector: 'app-admin-menu',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  templateUrl: './admin-menu.html',
  styleUrls: ['./admin-menu.css']
})
export class AdminMenuComponent {
  constructor(private auth: AuthenticationService, private router: Router) {}

  // ✅ el menú solo aparece si es admin
  isAdmin(): boolean {
    return this.auth.isAdmin();
  }

  goTo(path: string) {
    this.router.navigate([path]);
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
