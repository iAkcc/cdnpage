import { createHandler, parseBody } from '../_lib/handler.js';
import { json, error } from '../_lib/responses.js';
import { requireRole } from '../_lib/auth.js';
import { listPlugins, rebuildPublicManifest, getPublicManifest } from '../_lib/store.js';

// Endpoints administrativos: stats, rebuild manifest, health
export const handler = createHandler({
  handler: async (event) => {
    await requireRole(event, 'admin');

    if (event.httpMethod === 'GET') {
      const action = event.queryStringParameters?.action || 'stats';
      if (action === 'stats') {
        const plugins = await listPlugins({ includeUnpublished: true });
        const total = plugins.length;
        const published = plugins.filter((p) => p.published).length;
        const totalVersions = plugins.reduce((acc, p) => acc + (p.versions || 0), 0);

        return json({
          totalPlugins: total,
          publishedPlugins: published,
          totalVersions,
          plugins,
        });
      }
      if (action === 'manifest') {
        const manifest = await getPublicManifest();
        return json({ manifest });
      }
      return error('Acción no reconocida', 400);
    }

    if (event.httpMethod === 'POST') {
      const body = parseBody(event);
      if (body.action === 'rebuild-manifest') {
        await rebuildPublicManifest();
        const manifest = await getPublicManifest();
        return json({ ok: true, manifest });
      }
      return error('Acción no soportada', 400);
    }

    return error('Método no soportado', 405);
  },
});
