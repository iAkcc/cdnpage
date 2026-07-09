import { createHandler, parseBody } from '../_lib/handler.js';
import { json, error } from '../_lib/responses.js';
import { requireUser, requireRole, AuthError } from '../_lib/auth.js';
import {
  listPlugins, getPlugin, putPlugin, deletePlugin,
  listVersions, rebuildPublicManifest,
} from '../_lib/store.js';
import { PluginInput } from '../_lib/schemas.js';

export const handler = createHandler({
  handler: async (event) => {
    await requireUser(event);
    const slug = event.queryStringParameters?.slug;

    if (event.httpMethod === 'GET') {
      if (slug) {
        const plugin = await getPlugin(slug);
        if (!plugin) return error('No encontrado', 404);
        const versions = await listVersions(slug, { includeUnpublished: true });
        return json({ plugin, versions });
      }
      const plugins = await listPlugins({ includeUnpublished: true });
      return json({ plugins });
    }

    if (event.httpMethod === 'POST') {
      const body = parseBody(event);
      const parsed = PluginInput.safeParse(body);
      if (!parsed.success) return error('Datos inválidos', 422, { issues: parsed.error.issues });
      const existing = await getPlugin(parsed.data.slug);
      if (existing) return error('Plugin ya existe', 409);
      const plugin = { ...parsed.data, published: false, createdAt: new Date().toISOString(), versions: 0 };
      await putPlugin(plugin);
      return json({ plugin });
    }

    if (event.httpMethod === 'PUT') {
      const body = parseBody(event);
      const parsed = PluginInput.safeParse(body);
      if (!parsed.success) return error('Datos inválidos', 422, { issues: parsed.error.issues });
      const existing = await getPlugin(parsed.data.slug);
      if (!existing) return error('Plugin no encontrado', 404);
      const updated = { ...existing, ...parsed.data };
      await putPlugin(updated);
      return json({ plugin: updated });
    }

    if (event.httpMethod === 'PATCH') {
      if (!slug) return error('slug requerido', 400);
      const body = parseBody(event);
      const plugin = await getPlugin(slug);
      if (!plugin) return error('Plugin no encontrado', 404);
      if (typeof body.published === 'boolean') {
        await requireRole(event, 'admin');
        plugin.published = body.published;
        plugin.publishedAt = body.published ? new Date().toISOString() : null;
      }
      for (const field of ['name', 'description', 'author', 'homepage', 'category', 'visibility', 'tags', 'thumbnail']) {
        if (typeof body[field] !== 'undefined') plugin[field] = body[field];
      }
      await putPlugin(plugin);
      if (typeof body.published === 'boolean') await rebuildPublicManifest();
      return json({ plugin });
    }

    if (event.httpMethod === 'DELETE') {
      if (!slug) return error('slug requerido', 400);
      await requireRole(event, 'admin');
      const existing = await getPlugin(slug);
      if (!existing) return error('Plugin no encontrado', 404);
      await deletePlugin(slug);
      await rebuildPublicManifest();
      return json({ ok: true });
    }

    return error('Método no soportado', 405);
  },
});
