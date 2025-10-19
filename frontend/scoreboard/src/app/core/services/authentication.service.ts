import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable } from 'rxjs';
import { environment } from '../../../enviroments/enviroments';
import { LoginResponseDto } from '../models/login-response.dto';
import { decodeJwt } from '../utils/jwt';

export interface RoleDto { id?: number; name: string; }

@Injectable({ providedIn: 'root' })
export class AuthenticationService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);

  // Base del API desde environment
  private baseUrl = environment.apiUrl;
  private apiUrl = `${this.baseUrl}/api/auth`;

  private storage(): Storage | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try { return window.localStorage; } catch { return null; }
  }

  // --- Login tradicional ---
  login(username: string, password: string): Observable<LoginResponseDto> {
    return this.http.post<LoginResponseDto>(`${this.apiUrl}/login`, { username, password });
  }

  saveUser(userData: LoginResponseDto) {
    const s = this.storage();
    if (!s) return;
    s.setItem('user', JSON.stringify(userData));
    if (userData.token) s.setItem('token', userData.token);
  }

  // --- Helpers para OAuth ---
  githubLoginRedirect() {
    // Redirige al backend para iniciar el flujo OAuth
    window.location.href = `${this.apiUrl}/github/login`;
  }

  saveFromToken(token: string) {
    const s = this.storage();
    if (!s) return;

    // Construimos un objeto tipo LoginResponseDto a partir del JWT
    const payload: any = decodeJwt(token) || {};
    const nameClaim = payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name']
                   || payload['unique_name'] || payload['name'] || payload['sub'] || '';

    const rawRoles = Array.isArray(payload.roles) ? payload.roles
                    : (payload.role ? [payload.role] : []);
    const roleName = (rawRoles[0] ?? '').toString();
    const userLike: LoginResponseDto = {
      token,
      username: String(nameClaim),
      role: { name: roleName }
    } as any;

    s.setItem('user', JSON.stringify(userLike));
    s.setItem('token', token);
  }

  getUser(): any | null {
    const s = this.storage();
    const raw = s?.getItem('user');
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  getToken(): string | null {
    const s = this.storage();
    return s?.getItem('token') ?? null;
  }

  isAdmin(): boolean {
    const u = this.getUser();
    const roleName = u?.role?.name;
    if (typeof roleName === 'string' && roleName.toLowerCase() === 'admin') return true;

    const token = this.getToken();
    if (!token) return false;

    const payload: any = decodeJwt(token) || {};
    const roles = Array.isArray(payload.roles) ? payload.roles : [payload.role].filter(Boolean);
    return roles.map((r: string) => String(r).toLowerCase()).includes('admin');
  }

  logout() {
    const s = this.storage();
    s?.removeItem('user');
    s?.removeItem('token');
  }
}
