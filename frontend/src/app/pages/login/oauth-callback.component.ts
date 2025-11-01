import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthenticationService } from '@app/services/api/authentication.service';

@Component({
  selector: 'app-oauth-callback',
  standalone: true,
  imports: [CommonModule],
  template: `<p>Procesando inicio de sesión...</p>`
})
export class OAuthCallbackComponent implements OnInit {
  private router = inject(Router);
  private auth = inject(AuthenticationService);

  ngOnInit(): void {
    const url = new URL(window.location.href);

    // 1) token por query (?token= o ?access_token=)
    const qToken =
      url.searchParams.get('token') ||
      url.searchParams.get('access_token');

    // 2) token por hash (#token= o #access_token=)
    const hashParams = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash);
    const hToken =
      hashParams.get('token') ||
      hashParams.get('access_token');

    const token = qToken || hToken || undefined;

    // Si venía returnUrl desde el login guard, úsalo tras guardar sesión
    const returnUrl = url.searchParams.get('returnUrl') || undefined;

    if (token) {
      try {
        this.auth.saveFromToken(token);
        if (returnUrl) {
          this.router.navigateByUrl(returnUrl);
        } else if (this.auth.isAdmin()) {
          this.router.navigateByUrl('/admin');
        } else {
          // OJO: tu app.routes.ts usa 'score/:id' (no 'scoreboard')
          this.router.navigate(['/score', 1]);
        }
        return;
      } catch {
        // si algo sale mal, cae al login
      }
    }

    // Si no viene token válido, al login
    this.router.navigate(['/login'], { queryParams: { error: 'oauth_callback_missing_token' } });
  }
}
