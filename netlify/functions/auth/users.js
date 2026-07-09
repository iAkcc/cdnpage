import { createHandler } from '../_lib/handler.js';
import { json, error } from '../_lib/responses.js';
import { requireRole, upsertUser, listUsers, deleteUser, AuthError } from '../_lib/auth.js';

function cryptoId() {
  return 'u_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const handler = createHandler({
  handler: async (event, context) => {
    // Solo admin puede gestionar usuarios
    await requireRole(event, 'admin');
    const method = event.httpMethod;
    const { parseBody } = await import('../_lib/handler.js');

    if (method === 'GET') {
      const users = await listUsers();
      const safe = users.map((u) => ({ id: u.id, email: u.email, role: u.role, disabled: u.disabled, createdAt: u.createdAt }));
      return json({ users: safe });
    }

    if (method === 'POST') {
      const body = parseBody(event);
      const email = String(body.email || '').toLowerCase().trim();
      const role = ['admin', 'editor'].includes(body.role) ? body.role : 'editor';
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return error('Email inválido', 400);
      const created = await upsertUser({
        id: cryptoId(),
        email,
        role,
        disabled: false,
        createdAt: new Date().toISOString(),
      });
      return json({ user: { id: created.id, email: created.email, role: created.role } });
    }

    if (method === 'DELETE') {
      const body = parseBody(event);
      const email = String(body.email || '').toLowerCase().trim();
      if (!email) return error('Email requerido', 400);
      const removed = await deleteUser(email);
      if (!removed) return error('Usuario no encontrado', 404);
      return json({ ok: true });
    }

    if (method === 'PATCH') {
      const body = parseBody(event);
      const { getUserByEmail } = await import('../_lib/auth.js');
      const u = await getUserByEmail(String(body.email).toLowerCase().trim());
      if (!u) return error('Usuario no encontrado', 404);
      if (typeof body.role !== 'undefined') {
        if (!['admin', 'editor'].includes(body.role)) return error('Rol inválido', 400);
        u.role = body.role;
      }
      if (typeof body.disabled === 'boolean') u.disabled = body.disabled;
      await upsertUser(u);
      return json({ ok: true, user: { id: u.id, email: u.email, role: u.role, disabled: u.disabled } });
    }

    return error('Método no soportado', 405);
  },
});
