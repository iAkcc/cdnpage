import { createHandler } from '../_lib/handler.js';
import { json } from '../_lib/responses.js';
import { clearSessionCookie } from '../_lib/session.js';

export const handler = createHandler({
  csrfExempt: true,
  handler: async () => {
    return json(
      { ok: true },
      { headers: { 'Set-Cookie': [clearSessionCookie(), 'cdn_admin_csrf=; Path=/; Max-Age=0'].join(', ') } }
    );
  },
});
