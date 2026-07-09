import { createHandler } from '../_lib/handler.js';
import { json, error } from '../_lib/responses.js';
import { requireUser } from '../_lib/auth.js';

// Devuelve el usuario actual y un nuevo token CSRF (rotación opcional)
export const handler = createHandler({
  handler: async (event) => {
    const ctx = await requireUser(event);
    return json({ user: ctx.user });
  },
});
