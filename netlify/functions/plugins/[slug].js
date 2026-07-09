import { createHandler } from '../_lib/handler.js';
import { json, error } from '../_lib/responses.js';
import { requireUser } from '../_lib/auth.js';
import { requireRole } from '../_lib/auth.js';
import { getPlugin, putPlugin, deletePlugin, rebuildPublicManifest, listVersions } from '../_lib/store.js';
import { parseBody } from '../_lib/handler.js';

export const handler = createHandler({
  handler: async (event) => {
    await requireUser(event);
    const slug = event.queryStringParameters?.slug || (event.path || '').split('/').pop();

    if (event.httpMethod === 'GET') {
      const plugin = await getPlugin(slug);
      if (!plugin) return error('No encontrado', 404);
      const versions = await listVersions(slug, { includeUnpublished: true });
      return json({ plugin, versions });
    }

    if (event.httpMethod === 'PATCH') {
      const body = parseBody(event);
      const plugin = await getPlugin(slug);
      if (!plugin) return error('Plugin no encontrado', 404);
      if (typeof body.published === 'boolean') {
        await requireRole(event, 'admin');
        plugin.published = body.published;
        plugin.publishedAt = body.published ? new Date().toISOString() : null;
        await putPlugin(plugin);
        await rebuildPublicManifest();
        return json({ plugin });
      }
      for (const field of ['name', 'description', 'author', 'homepage', 'category', 'visibility', 'tags', 'thumbnail']) {
        if (typeof body[field] !== 'undefined') plugin[field] = body[field];
      }
      await putPlugin(plugin);
      return json({ plugin });
    }

    if (event.httpMethod === 'DELETE') {
      await requireRole(event, 'admin');
      await deletePlugin(slug);
      await rebuildPublicManifest();
      return json({ ok: true });
    }

    return error('Método no soportado', 405);
  },
});
