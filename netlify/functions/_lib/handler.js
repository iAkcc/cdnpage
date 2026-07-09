import { error, json } from './responses.js';
import { getCsrfToken, clearSessionCookie } from './session.js';
import { AuthError } from './auth.js';

// Crea un handler serverless con manejo de errores, CORS y CSRF para mutations
export function createHandler(opts = {}) {
  return async (event, context) => {
    try {
      // CORS restrictivo: mismo origen
      const headers = {
        'Access-Control-Allow-Origin': 'sameorigin',
      };
      const origin = event.headers?.origin || event.headers?.Origin;
      const publicUrl = process.env.PUBLIC_URL || '';
      if (origin && publicUrl && origin === publicUrl) {
        headers['Access-Control-Allow-Origin'] = origin;
        headers['Access-Control-Allow-Credentials'] = 'true';
        headers['Access-Control-Allow-Headers'] = 'Content-Type, X-CSRF-Token';
        headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      }

      if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
      }

      // CSRF: solo para mutations, excepto endpoints marcados como csrfExempt (login)
      const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(event.httpMethod);
      if (isMutation && !opts.csrfExempt) {
        const csrf = getCsrfToken({ headers: event.headers });
        if (!csrf) return error('Token CSRF inválido', 403, { headers });
      }

      const result = await opts.handler(event, context);
      if (result) return { ...result, headers: { ...(result.headers || {}), ...headers } };
      return { statusCode: 204, headers, body: '' };
    } catch (e) {
      if (e instanceof AuthError) {
        const h = {};
        if (e.status === 401) h['Set-Cookie'] = clearSessionCookie();
        return error(e.message, e.status, { headers: h });
      }
      console.error('[handler] error:', e);
      return error(e.message || 'Error interno', e.status || 500);
    }
  };
}

// Parsea body JSON del request
export function parseBody(event) {
  if (!event.body) return {};
  if (event.isBase64Encoded) {
    const raw = Buffer.from(event.body, 'base64').toString('utf8');
    return JSON.parse(raw);
  }
  return JSON.parse(event.body);
}
