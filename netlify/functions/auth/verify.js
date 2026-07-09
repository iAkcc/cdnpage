import { createHandler, parseBody } from '../_lib/handler.js';
import { json, error } from '../_lib/responses.js';
import { createSession, sessionCookie, getCsrfToken } from '../_lib/session.js';
import { getUserByEmail, ensureBootstrapAdmin } from '../_lib/auth.js';
import { getStore } from '@netlify/blobs';

function cryptoRandom(len = 32) {
  const a = new Uint8Array(len);
  // crypto disponible en runtime serverless
  (globalThis.crypto || require('node:crypto').webcrypto).getRandomValues(a);
  return Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function tokensStore() {
  return getStore('magic_tokens');
}

export const handler = createHandler({
  csrfExempt: true,
  handler: async (event) => {
    await ensureBootstrapAdmin();
    const body = parseBody(event);
    const token = String(body.token || '');
    if (!token) return error('Token requerido', 400);

    const store = await tokensStore();
    const data = await store.get(`token:${token}`, { type: 'json' });
    if (!data) return error('Token inválido o expirado', 400);
    if (data.used) return error('Token ya utilizado', 400);
    if (data.expiresAt < Date.now()) {
      await store.delete(`token:${token}`);
      return error('Token expirado', 400);
    }

    // Marcar como usado
    data.used = true;
    await store.delete(`token:${token}`);

    const user = await getUserByEmail(data.email);
    if (!user) return error('Cuenta no autorizada', 403);
    if (user.disabled) return error('Cuenta deshabilitada', 403);

    const jwt = await createSession(user);
    const csrf = cryptoRandom(24);
    // Guardamos el token CSRF asociado al usuario (rotación)
    const csrfStore = getStore('csrf');
    await csrfStore.setJSON(`csrf:${user.id}`, { value: csrf, issuedAt: Date.now() });

    return json(
      { ok: true, user: { id: user.id, email: user.email, role: user.role } },
      {
        headers: {
          'Set-Cookie': [
            sessionCookie(jwt),
            `cdn_admin_csrf=${csrf}; Path=/; Secure; SameSite=Strict; Max-Age=604800`,
          ].join(', '),
        },
      }
    );
  },
});
