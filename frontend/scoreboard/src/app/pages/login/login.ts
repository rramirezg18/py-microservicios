// src/app/pages/login/login.ts
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthenticationService } from '../../core/services/authentication.service';
import { CommonModule } from '@angular/common';
import { LoginResponseDto } from '../../core/models/login-response.dto';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent {
  username = '';
  password = '';
  errorMessage = '';

  constructor(
    private authService: AuthenticationService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  onSubmit() {
    this.authService.login(this.username, this.password).subscribe({
      next: (res: LoginResponseDto) => {
        this.authService.saveUser(res);
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        if (returnUrl) {
          this.router.navigateByUrl(returnUrl);
          return;
        }
        const role = res.role?.name?.toLowerCase();
        this.router.navigate([role === 'admin' ? '/admin' : '/score/1']);
      },
      error: () => { this.errorMessage = 'Usuario o contraseña incorrectos'; }
    });
  }
}
