import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { DecodedToken, decodeJwt, extractRoles } from '../utils/jwt';

export type Role = string;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload extends LoginPayload {
  name?: string;
}

export interface AuthUser {
  id?: string;
  email?: string;
  name?: string;
  role: Role;
  roles: Role[];
  exp?: number;
  raw?: DecodedToken | null;
}

function normalizeBase(url: string | null | undefined): string {
  if (!url) {
    return '';
  }
  return url.endsWith('/') ? url.slice(0, url.length - 1) : url;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly storageKey = 'scoreboard.auth';
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly isDev = typeof ngDevMode !== 'undefined' && !!ngDevMode;

  private readonly env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
  private readonly baseUrl = normalizeBase(
    this.env['NG_APP_API_BASE_URL'] ?? this.env['VITE_API_BASE_URL'] ?? '/api'
  );
  private readonly devFallback = normalizeBase(
    this.env['NG_APP_DEV_API_FALLBACK'] ?? this.env['VITE_DEV_API_FALLBACK'] ?? 'http://localhost:5000/api'
  );

  private readonly tokensSignal = signal<AuthTokens | null>(null);
  private readonly userSignal = signal<AuthUser | null>(null);
  private readonly initializingSignal = signal(true);

  readonly tokens = this.tokensSignal.asReadonly();
  readonly user = this.userSignal.asReadonly();
  readonly initializing = this.initializingSignal.asReadonly();
  readonly isAuthenticated = computed(
    () => Boolean(this.tokensSignal()?.accessToken && this.userSignal())
  );

  constructor() {
    if (this.isBrowser) {
      try {
        const stored = window.localStorage.getItem(this.storageKey);
        if (stored) {
          const parsed: AuthTokens = JSON.parse(stored);
          this.tokensSignal.set(parsed);
          this.userSignal.set(this.extractUser(parsed));
        }
      } catch (error) {
        console.warn('Failed to restore auth session', error);
        window.localStorage.removeItem(this.storageKey);
      }
    }

    this.initializingSignal.set(false);

    if (this.isBrowser) {
      effect(() => {
        if (this.initializingSignal()) {
          return;
        }
        const tokens = this.tokensSignal();
        if (tokens) {
          window.localStorage.setItem(this.storageKey, JSON.stringify(tokens));
        } else {
          window.localStorage.removeItem(this.storageKey);
        }
      });
    }
  }

  accessToken(): string | null {
    return this.tokensSignal()?.accessToken ?? null;
  }

  async login(payload: LoginPayload): Promise<void> {
    const tokens = await this.request<AuthTokens>('/auth/login', payload);
    this.applyTokens(tokens);
  }

  async register(payload: RegisterPayload): Promise<void> {
    const tokens = await this.request<AuthTokens>('/auth/register', payload);
    this.applyTokens(tokens);
  }

  async refresh(): Promise<void> {
    const refreshToken = this.tokensSignal()?.refreshToken;
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    const tokens = await this.request<AuthTokens>('/auth/refresh', { refreshToken });
    this.applyTokens(tokens);
  }

  logout(): void {
    this.applyTokens(null);
  }

  hasRole(roles: Role | Role[]): boolean {
    const user = this.userSignal();
    if (!user) {
      return false;
    }
    const desired = Array.isArray(roles) ? roles : [roles];
    const userRoles = user.roles?.length ? user.roles : [user.role];
    return desired.some((role) => userRoles.includes(role));
  }

  private applyTokens(tokens: AuthTokens | null): void {
    this.tokensSignal.set(tokens);
    this.userSignal.set(this.extractUser(tokens));
  }

  private extractUser(tokens: AuthTokens | null): AuthUser | null {
    if (!tokens?.accessToken) {
      return null;
    }

    const decoded = decodeJwt(tokens.accessToken);
    if (!decoded) {
      return null;
    }

    const roles = extractRoles(decoded);
    const primary = (roles[0] ?? 'user') as Role;
    const uniqueRoles = roles.length > 0 ? roles : [primary];

    return {
      id: typeof decoded.sub === 'string' ? decoded.sub : undefined,
      email: typeof decoded.email === 'string' ? decoded.email : undefined,
      name: typeof decoded.name === 'string' ? decoded.name : undefined,
      role: primary,
      roles: uniqueRoles,
      exp: typeof decoded.exp === 'number' ? decoded.exp : undefined,
      raw: decoded
    };
  }

  private async request<T>(path: string, body: unknown): Promise<T> {
    const bases = this.getBases();
    let lastError: Error | null = null;

    for (const base of bases) {
      try {
        return await firstValueFrom(
          this.http.post<T>(`${base}${path}`, body, {
            headers: { 'Content-Type': 'application/json' }
          })
        );
      } catch (error) {
        lastError = this.normalizeError(error);
      }
    }

    throw lastError ?? new Error('No se pudo completar la solicitud');
  }

  private getBases(): string[] {
    const bases = [this.baseUrl || ''];
    if (
      this.isBrowser &&
      this.isDev &&
      (this.baseUrl.startsWith('/') || this.baseUrl === '') &&
      this.devFallback &&
      !bases.includes(this.devFallback)
    ) {
      bases.push(this.devFallback);
    }
    return bases;
  }

  private normalizeError(error: unknown): Error {
    if (error instanceof Error && !(error instanceof HttpErrorResponse)) {
      return error;
    }

    if (error instanceof HttpErrorResponse) {
      const detail = this.extractMessage(error);
      return new Error(detail ?? 'No se pudo completar la solicitud');
    }

    return new Error(String(error ?? 'No se pudo completar la solicitud'));
  }

  private extractMessage(response: HttpErrorResponse): string | null {
    const data = response.error;
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === 'object' && 'message' in parsed) {
          return String((parsed as { message?: unknown }).message ?? '');
        }
      } catch {
        if (data.trim()) {
          return data.trim();
        }
      }
      return null;
    }

    if (data && typeof data === 'object' && 'message' in data) {
      return String((data as { message?: unknown }).message ?? '');
    }

    return null;
  }
}
