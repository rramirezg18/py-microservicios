// frontend/src/app/services/authentication.service.ts
import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable } from 'rxjs';

// 👉 Usa el environment que definimos para microservicios
//    (ruta relativa desde /src/app/services hacia /src/app/shared/services/api)
import { environment } from '@app/services/api/enviroments';

// Tipos mínimos usados por el servicio
export interface RoleDto { id?: number; name: string; }
export interface LoginResponseDto {
  token: string;
  username: string;
  role: RoleDto;
}

/** Decodificador JWT local (sin verificación de firma).
 *  Devuelve el payload o null si falla.
 */
function decodeJwt(token: string): any | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    // base64url -> base64
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(b64.padEnd(b64.length + (4 - (b64.length % 4)) % 4, '='));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthenticationService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);

  // Base del API de Auth (microservicio)
  // En el environment pusimos: apiAuth: 'http://localhost:5000/api'
  private apiUrl = `${environment.apiBaseUrl}/auth`;

  /** Acceso seguro a localStorage (evita SSR y errores de sandbox) */
  private storage(): Storage | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try { return window.localStorage; } catch { return null; }
  }

  // --- Login tradicional ---
  login(username: string, password: string): Observable<LoginResponseDto> {
    return this.http.post<LoginResponseDto>(`${this.apiUrl}/login`, { username, password });
  }

  /** Guarda usuario + token tras login clásico */
  saveUser(userData: LoginResponseDto): void {
    const s = this.storage();
    if (!s) return;
    s.setItem('user', JSON.stringify(userData));
    if (userData.token) s.setItem('token', userData.token);
  }

  // --- OAuth (GitHub) ---
  /** Redirige al backend de Auth para iniciar OAuth con GitHub */
  githubLoginRedirect(): void {
    // Ajusta si tu backend expone otra ruta (p.ej. /oauth/github/login)
    window.location.href = `${this.apiUrl}/github/login`;
  }

  /** Guarda usuario a partir de un JWT crudo recibido en el callback OAuth */
  saveFromToken(token: string): void {
    const s = this.storage();
    if (!s) return;

    const payload: any = decodeJwt(token) || {};
    const nameClaim =
      payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] ||
      payload['unique_name'] ||
      payload['name'] ||
      payload['sub'] ||
      '';

    const rawRoles = Array.isArray(payload.roles)
      ? payload.roles
      : (payload.role ? [payload.role] : []);

    const roleName = (rawRoles[0] ?? '').toString();

    const userLike: LoginResponseDto = {
      token,
      username: String(nameClaim),
      role: { name: roleName }
    };

    s.setItem('user', JSON.stringify(userLike));
    s.setItem('token', token);
  }

  // --- Helpers de sesión ---
  getUser(): LoginResponseDto | null {
    const s = this.storage();
    const raw = s?.getItem('user');
    if (!raw) return null;
    try { return JSON.parse(raw) as LoginResponseDto; } catch { return null; }
  }

  getToken(): string | null {
    const s = this.storage();
    return s?.getItem('token') ?? null;
  }

  isAdmin(): boolean {
    // 1) Intenta por el objeto user guardado
    const u = this.getUser();
    const roleName = u?.role?.name;
    if (typeof roleName === 'string' && roleName.toLowerCase() === 'admin') return true;

    // 2) Fallback: inspecciona el JWT por si vino solo con saveFromToken
    const token = this.getToken();
    if (!token) return false;

    const payload: any = decodeJwt(token) || {};
    const roles = Array.isArray(payload.roles) ? payload.roles : [payload.role].filter(Boolean);
    return roles.map((r: string) => String(r).toLowerCase()).includes('admin');
  }

  logout(): void {
    const s = this.storage();
    s?.removeItem('user');
    s?.removeItem('token');
  }
}
