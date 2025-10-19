// src/app/pages/login/oauth-callback.ts
import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthenticationService } from '../../core/services/authentication.service';

@Component({
  standalone: true,
  selector: 'app-oauth-callback',
  template: `<p>Procesando login con GitHub...</p>`,
})
export class OAuthCallbackComponent implements OnInit {
  private router = inject(Router);
  private auth = inject(AuthenticationService);

  ngOnInit(): void {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
      this.auth.saveFromToken(token);

      // 👇 Si es Admin, a /admin; si no, a /score/1 (ambas están protegidas por tus guards)
      if (this.auth.isAdmin()) {
        this.router.navigateByUrl('/admin');
      } else {
        this.router.navigateByUrl('/score/1');
      }
    } else {
      console.error('No token in query');
      this.router.navigateByUrl('/login');
    }
  }
}
