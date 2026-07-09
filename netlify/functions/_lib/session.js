import { jwtVerify, SignJWT } from 'jose';
import { requireEnv } from './env.js';

const ISSUER = 'cdn-admin';
const AUDIENCE = 'cdn-admin-user';
const SESSION_COOKIE = 'cdn_admin_sess';
const CSRF_COOKIE = 'cdn_admin_csrf';

function secretKey() {
  const raw = requireEnv('SESSION_SECRET');
  return new TextEncoder().encode(raw);
}

// Crea un JWT de sesión firmado (HS256)
export async function createSession(user) {
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({
    sub: user.id,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime('now + 7d')
    .sign(secretKey());
  return token;
}

// Verifica un JWT de sesión
export async function verifySession(token) {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    return payload;
  } catch {
    return null;
  }
}

// Parsea cookies del header Cookie
export function parseCookies(cookieHeader = '') {
  const out = {};
  for (const part of cookieHeader.split(/;\s*/)) {
    if (!part) continue;
    const [k, ...rest] = part.split('=');
    out[decodeURIComponent(k)] = decodeURIComponent(rest.join('='));
  }
  return out;
}

// Construye el Set-Cookie para la sesión
export function sessionCookie(token, maxAgeSeconds = 7 * 24 * 3600) {
  const flags = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
  ].join('; ');
  return flags;
}

export function clearSessionCookie() {
  return [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
  ].join('; ');
}

// Cookie CSRF / CSRF token (double-submit cookie)
export function getCsrfToken(req) {
  const cookies = parseCookies(req.headers?.cookie);
  const headerToken = req.headers?.['x-csrf-token'] || req.headers?.['X-CSRF-Token'];
  const cookieToken = cookies[CSRF_COOKIE];
  if (!headerToken || !cookieToken) return null;
  // Verificamos coincidencia con timing-safe
  if (headerToken.length !== cookieToken.length) return null;
  let diff = 0;
  for (let i = 0; i < headerToken.length; i++) {
    diff |= headerToken.charCodeAt(i) ^ cookieToken.charCodeAt(i);
  }
  return diff === 0 ? headerToken : null;
}

export { SESSION_COOKIE, CSRF_COOKIE };
