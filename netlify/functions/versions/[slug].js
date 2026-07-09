import { createHandler } from '../_lib/handler.js';
import { json, error } from '../_lib/responses.js';
import { requireUser, requireRole } from '../_lib/auth.js';
import { getVersion, deleteVersion, putVersion, listVersions, rebuildPublicManifest } from '../_lib/store.js';
import { createDownloadUrl, BUCKET_PRIVATE, BUCKET_PUBLIC, objectExists } from '../_lib/r2.js';
import { parseBody } from '../_lib/handler.js';

export const handler = createHandler({
  handler: async (event) => {
    await requireUser(event);
    const slug = event.queryStringParameters?.slug || (event.path || '').split('/').slice(-2, -1)[0];
    const versionStr = event.queryStringParameters?.version || (event.path || '').split('/').pop();

    if (!slug || !versionStr) return error('slug y version requeridos', 400);

    if (event.httpMethod === 'GET') {
      const version = await getVersion(slug, versionStr);
      if (!version) return error('Versión no encontrada', 404);
      let downloadUrl = null;
      if (version.storageBucket === 'private') {
        downloadUrl = await createDownloadUrl({
          bucket: BUCKET_PRIVATE(),
          key: version.storageKey,
          expiresIn: 300,
        });
      } else {
        const { publicUrlFor } = await import('../_lib/r2.js');
        downloadUrl = publicUrlFor(version.storageKey);
      }
      return json({ version, downloadUrl });
    }

    if (event.httpMethod === 'PATCH') {
      const body = parseBody(event);
      const version = await getVersion(slug, versionStr);
      if (!version) return error('Versión no encontrada', 404);

      if (typeof body.published === 'boolean') {
        await requireRole(event, 'admin');
        version.published = body.published;
      }
      if (body.changelog !== undefined) version.changelog = body.changelog;
      if (body.gameVersion !== undefined) version.gameVersion = body.gameVersion;
      await putVersion(version);
      if (body.published) await rebuildPublicManifest();
      return json({ version });
    }

    if (event.httpMethod === 'DELETE') {
      await requireRole(event, 'admin');
      await deleteVersion(slug, versionStr);
      await rebuildPublicManifest();
      return json({ ok: true });
    }

    return error('Método no soportado', 405);
  },
});
