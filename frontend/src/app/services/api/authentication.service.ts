import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

import { environment } from '@app/services/api/enviroments';
import { tap } from 'rxjs/operators';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthenticationService {
  private baseUrl = environment.apiBaseUrl + '/auth';
  private currentUserSubject = new BehaviorSubject<any>(this.getUser());
  currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {}

  /** LOGIN normal (usuario/contraseña) */
  login(username: string, password: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/login`, { username, password }).pipe(
      tap((resp: any) => {
        // Soporta accessToken | token | access_token
        const token: string | undefined =
          resp?.accessToken ?? resp?.token ?? resp?.access_token;

        if (token) {
          localStorage.setItem('token', token);

          // Si la API no devuelve user, lo derivamos del JWT
          const user =
            resp?.user ??
            (() => {
              try {
                const payload = JSON.parse(atob(token.split('.')[1] || ''));
                return payload;
              } catch {
                return null;
              }
            })();

          if (user) localStorage.setItem('user', JSON.stringify(user));
          this.currentUserSubject.next(user ?? null);
        }
      })
    );
  }

  /** Inicia login con GitHub OAuth */
  githubLoginRedirect() {
    window.location.href = `${this.baseUrl}/github/login`;
  }

  /** Guardar usuario manualmente (ya lo hace el tap) */
  saveUser(resp: any) {
    const token: string | undefined =
      resp?.accessToken ?? resp?.token ?? resp?.access_token;
    if (token) {
      localStorage.setItem('token', token);
      const user =
        resp?.user ??
        (() => {
          try {
            const payload = JSON.parse(atob(token.split('.')[1] || ''));
            return payload;
          } catch {
            return null;
          }
        })();
      if (user) localStorage.setItem('user', JSON.stringify(user));
      this.currentUserSubject.next(user ?? null);
    }
  }

  /** Guarda usuario desde un token JWT OAuth */
  saveFromToken(token: string) {
    try {
      localStorage.setItem('token', token);
      const payload = JSON.parse(atob(token.split('.')[1] || ''));
      localStorage.setItem('user', JSON.stringify(payload));
      this.currentUserSubject.next(payload);
    } catch (err) {
      console.error('Error procesando token OAuth:', err);
      localStorage.clear();
    }
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  getUser(): any {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  }

  isAdmin(): boolean {
    const user = this.getUser();
    if (!user) return false;

    const collectRoles = (value: unknown): string[] => {
      if (!value) return [];
      if (Array.isArray(value)) return value.flatMap(collectRoles);
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return [];
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) return parsed.flatMap(collectRoles);
        } catch {}
        return [trimmed.toLowerCase()];
      }
      if (typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        const maybeName =
          typeof obj.name === 'string'
            ? obj.name
            : typeof obj.Name === 'string'
            ? obj.Name
            : undefined;
        return maybeName ? [maybeName.trim().toLowerCase()] : [];
      }
      return [];
    };

    const roleCandidates: string[] = [
      ...collectRoles((user as any).role),
      ...collectRoles((user as any).Role),
      ...collectRoles((user as any).roleName),
      ...collectRoles((user as any).roles),
      ...collectRoles((user as any).Roles),
    ];

    const hasAdminRole = roleCandidates.some((r) => r === 'admin');

    const username: unknown = (user as any).username ?? (user as any).Username;
    const githubAdmin =
      typeof username === 'string' && username.toLowerCase().startsWith('github:');

    return hasAdminRole || githubAdmin;
  }

  logout() {
    localStorage.clear();
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }
}
