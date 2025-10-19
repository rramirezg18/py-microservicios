// src/app/pages/login/login.ts
import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthenticationService } from '../../core/services/authentication.service';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIf],
  templateUrl: './login.html',
  styleUrls: ['./login.css'],
})
export class LoginComponent implements OnInit {
  private auth = inject(AuthenticationService);
  private router = inject(Router);

  username = '';
  password = '';
  errorMessage = '';

  ngOnInit(): void {
    // 👇 si ya hay token, saca al usuario de /login
    const token = this.auth.getToken();
    if (token) {
      if (this.auth.isAdmin()) {
        this.router.navigateByUrl('/admin');
      } else {
        this.router.navigateByUrl('/score/1');
      }
      return;
    }
  }

  onSubmit() {
    this.errorMessage = '';
    this.auth.login(this.username, this.password).subscribe({
      next: (resp) => {
        this.auth.saveUser(resp);
        if (this.auth.isAdmin()) {
          this.router.navigateByUrl('/admin');
        } else {
          this.router.navigateByUrl('/score/1');
        }
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage = err.error?.message || 'Usuario o contraseña inválidos.';
      }
    });
  }

  onLoginWithGitHub() {
    this.auth.githubLoginRedirect();
  }
}
