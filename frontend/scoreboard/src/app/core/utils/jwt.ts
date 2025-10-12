export interface DecodedToken {
  [key: string]: unknown;
  sub?: string;
  exp?: number;
  email?: string;
  name?: string;
}

const ROLE_CLAIM_KEYS = [
  'role',
  'roles',
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/roles'
];

export function decodeJwt(token: string | null | undefined): DecodedToken | null {
  if (!token) {
    return null;
  }

  const segments = token.split('.');
  if (segments.length < 2) {
    return null;
  }

  try {
    const payload = segments[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, '=');
    const json = atob(padded);
    return JSON.parse(json) as DecodedToken;
  } catch (error) {
    console.warn('Failed to decode JWT payload', error);
    return null;
  }
}

function normalizeRoleName(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const lower = trimmed.toLowerCase();
  const cleaned = lower.replace(/^roles?[:/_-]/, '').replace(/^role[:/_-]/, '');
  return cleaned || lower;
}

function parseRoleValue(value: unknown): string[] {
  if (typeof value === 'string') {
    return value
      .split(/[,;]/)
      .flatMap((segment) => segment.split(/\s+/))
      .map((segment) => normalizeRoleName(segment))
      .filter((segment): segment is string => Boolean(segment));
  }

  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => parseRoleValue(entry))
      .filter((segment, index, all) => all.indexOf(segment) === index);
  }

  return [];
}

export function extractRoles(decoded: DecodedToken | null | undefined): string[] {
  if (!decoded) {
    return [];
  }

  for (const key of ROLE_CLAIM_KEYS) {
    if (key in decoded) {
      const roles = parseRoleValue((decoded as Record<string, unknown>)[key]);
      if (roles.length > 0) {
        return roles;
      }
    }
  }

  return [];
}
