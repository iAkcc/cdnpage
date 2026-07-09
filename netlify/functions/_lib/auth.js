import { getStore } from '@netlify/blobs';
import { verifySession, parseCookies, SESSION_COOKIE } from './session.js';

const USERS_STORE_NAME = 'users';
const RATE_STORE_NAME = 'auth_rate';

// Store de usuarios (Netlify Blobs)
function usersStore() {
  return getStore(USERS_STORE_NAME);
}

// Store para rate limiting de auth
function rateStore() {
  return getStore(RATE_STORE_NAME);
}

// Inicializa el usuario admin en el primer arranque
export async function ensureBootstrapAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return;
  const store = usersStore();
  const existing = await store.get(`user:${adminEmail}`);
  if (existing) return;
  const admin = {
    id: cryptoId(),
    email: adminEmail,
    role: 'admin',
    createdAt: new Date().toISOString(),
    disabled: false,
  };
  await store.setJSON(`user:${adminEmail}`, admin);
  await store.setJSON(`user:id:${admin.id}`, admin);
}

export async function getUserByEmail(email) {
  if (!email) return null;
  const store = usersStore();
  return await store.get(`user:${normalize(email)}`, { type: 'json' });
}

export async function getUserById(id) {
  const store = usersStore();
  return await store.get(`user:id:${id}`, { type: 'json' });
}

export async function listUsers() {
  const store = usersStore();
  const list = await store.list({ prefix: 'user:' });
  const users = [];
  for (const { key } of list.blobs) {
    if (key.startsWith('user:id:')) continue;
    const u = await store.get(key, { type: 'json' });
    if (u) users.push(u);
  }
  return users;
}

export async function upsertUser(user) {
  const store = usersStore();
  const e = normalize(user.email);
  const u = { ...user, email: e };
  await store.setJSON(`user:${e}`, u);
  await store.setJSON(`user:id:${u.id}`, u);
  return u;
}

export async function deleteUser(email) {
  const store = usersStore();
  const u = await getUserByEmail(email);
  if (!u) return false;
  await store.delete(`user:${normalize(email)}`);
  await store.delete(`user:id:${u.id}`);
  return true;
}

// Rate limiting: máximo N intentos por IP+email en ventana de minutos
export async function checkRate(key, max = 5, windowMinutes = 15) {
  const store = rateStore();
  const now = Date.now();
  const windowMs = windowMinutes * 60 * 1000;
  const data = (await store.get(`rate:${key}`, { type: 'json' })) || {
    attempts: [],
    blockedUntil: 0,
  };
  if (data.blockedUntil > now) {
    return { allowed: false, retryAfterMs: data.blockedUntil - now };
  }
  data.attempts = data.attempts.filter((t) => now - t < windowMs);
  if (data.attempts.length >= max) {
    data.blockedUntil = now + windowMs;
    await store.setJSON(`rate:${key}`, data);
    return { allowed: false, retryAfterMs: windowMs };
  }
  data.attempts.push(now);
  await store.setJSON(`rate:${key}`, data);
  return { allowed: true };
}

export async function resetRate(key) {
  const store = rateStore();
  await store.delete(`rate:${key}`);
}

// Middleware: extrae y valida la sesión del request
export async function requireUser(event) {
  const cookies = parseCookies(event.headers?.cookie || '');
  const token = cookies[SESSION_COOKIE];
  if (!token) throw new AuthError('No autenticado', 401);
  const payload = await verifySession(token);
  if (!payload) throw new AuthError('Sesión inválida', 401);
  const user = await getUserById(payload.sub);
  if (!user || user.disabled) throw new AuthError('Usuario deshabilitado', 403);
  return { user, session: payload };
}

// Requiere un rol específico (admin > editor)
export async function requireRole(event, role) {
  const ctx = await requireUser(event);
  const hierarchy = { viewer: 0, editor: 1, admin: 2 };
  if ((hierarchy[ctx.user.role] || 0) < (hierarchy[role] || 0)) {
    throw new AuthError('Permisos insuficientes', 403);
  }
  return ctx;
}

export class AuthError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function normalize(email) {
  return String(email || '').toLowerCase().trim();
}

function cryptoId() {
  return 'u_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
