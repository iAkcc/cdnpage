import { createHandler, parseBody } from '../_lib/handler.js';
import { json, error } from '../_lib/responses.js';
import { checkRate, resetRate, ensureBootstrapAdmin, getUserByEmail, AuthError } from '../_lib/auth.js';
import { sendMagicLink } from '../_lib/email.js';
import { getStore } from '@netlify/blobs';

// Tokens de magic link: expiran en 15 minutos, un solo uso
const TOKEN_TTL_MS = 15 * 60 * 1000;

async function tokensStore() {
  return getStore('magic_tokens');
}

export const handler = createHandler({
  csrfExempt: true,
  handler: async (event) => {
    await ensureBootstrapAdmin();
    const body = parseBody(event);
    const email = String(body.email || '').toLowerCase().trim();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return error('Email inválido', 400);
    }

    const clientIp = event.headers?.['x-nf-client-connection-ip'] || event.headers?.['client-ip'] || 'unknown';
    const rateKey = `${clientIp}:${email}`;
    const rl = await checkRate(rateKey, 5, 15);
    if (!rl.allowed) {
      return error('Demasiados intentos. Intenta más tarde.', 429, {
        headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
      });
    }

    // Generar token
    const token = 'ml_' + Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
    const store = await tokensStore();
    await store.setJSON(`token:${token}`, {
      email,
      issuedAt: Date.now(),
      expiresAt: Date.now() + TOKEN_TTL_MS,
      used: false,
    });

    // Construir magic link
    const base = process.env.PUBLIC_URL || '';
    if (!base) throw new Error('PUBLIC_URL no configurada');
    const link = `${base.replace(/\/$/, '')}/login?token=${token}`;

    try {
      await sendMagicLink({ to: email, link });
    } catch (e) {
      console.error('[login] sendMagicLink falló:', e);
      // No revelar si el usuario existe o no
    }

    await resetRate(rateKey);
    // Respuesta siempre genérica (evita enumeración de usuarios)
    return json({ ok: true, message: 'Si el email existe, recibirás un enlace.' });
  },
});
