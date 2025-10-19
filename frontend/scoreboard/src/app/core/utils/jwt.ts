function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = str.length % 4;
  if (pad) str += '='.repeat(4 - pad);
  return atob(str);
}

export function decodeJwt<T = any>(token: string): T | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const json = base64UrlDecode(parts[1]);
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/**
 * Devuelve true si el token está expirado.
 * - Si NO hay token -> true (expirado)
 * - Si NO parece JWT (no tiene 3 partes) -> false (NO lo tratamos como vencido)
 * - Si SÍ es JWT pero NO tiene 'exp' -> false (NO vencido)
 * - Si tiene 'exp', aplicamos margen (skew) para evitar desfases de reloj
 */
export function isJwtExpired(token: string | null, skewSeconds = 60): boolean {
  if (!token) return true;

  const parts = token.split('.');
  if (parts.length !== 3) {
    // 👉 Muchos backends devuelven un token opaco (no-JWT). No lo invalidamos.
    return false;
  }

  const payload = decodeJwt<any>(token);
  const expSec = payload?.exp;
  if (typeof expSec !== 'number') return false;

  const nowMs = Date.now();
  const expMs = (expSec - skewSeconds) * 1000;
  return nowMs >= expMs;
}
