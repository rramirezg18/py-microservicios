import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly mode = signal<'login' | 'register'>('login');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    name: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  protected readonly isRegister = computed(() => this.mode() === 'register');
  protected readonly submitLabel = computed(() =>
    this.isRegister() ? 'Registrarme' : 'Iniciar sesión'
  );
  protected readonly toggleLabel = computed(() =>
    this.isRegister() ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'
  );

  constructor() {
    effect(() => {
      const register = this.isRegister();
      const nameControl = this.form.controls.name;
      nameControl.setValidators(register ? [Validators.required] : []);
      nameControl.updateValueAndValidity({ emitEvent: false });
      if (!register) {
        nameControl.setValue('', { emitEvent: false });
      }
      this.error.set(null);
    });
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, password, name } = this.form.getRawValue();
    this.loading.set(true);
    this.error.set(null);

    try {
      if (this.isRegister()) {
        await this.auth.register({ email, password, name: name || undefined });
      } else {
        await this.auth.login({ email, password });
      }
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/scoreboard';
      await this.router.navigateByUrl(returnUrl);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo completar la acción');
    } finally {
      this.loading.set(false);
    }
  }

  switchMode(): void {
    this.mode.update((current) => (current === 'login' ? 'register' : 'login'));
  }
}
