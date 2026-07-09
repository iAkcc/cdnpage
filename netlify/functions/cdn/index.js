import { createHandler } from '../_lib/handler.js';
import { json, error } from '../_lib/responses.js';
import { requireUser } from '../_lib/auth.js';
import { getPlugin, listVersions, getVersion } from '../_lib/store.js';
import { publicUrlFor, createDownloadUrl, BUCKET_PRIVATE, BUCKET_PUBLIC } from '../_lib/r2.js';

// Genera URLs de descarga (públicas o firmadas para privadas)
export const handler = createHandler({
  handler: async (event) => {
    await requireUser(event);

    const slug = event.queryStringParameters?.slug;
    const versionStr = event.queryStringParameters?.version;
    const action = event.queryStringParameters?.action || 'url';

    if (action === 'manifest') {
      const { getPublicManifest } = await import('../_lib/store.js');
      const manifest = await getPublicManifest();
      return json({ manifest });
    }

    if (!slug) return error('slug requerido', 400);

    const plugin = await getPlugin(slug);
    if (!plugin) return error('Plugin no encontrado', 404);

    if (versionStr) {
      const version = await getVersion(slug, versionStr);
      if (!version) return error('Versión no encontrada', 404);

      let url;
      if (version.storageBucket === 'private') {
        url = await createDownloadUrl({
          bucket: BUCKET_PRIVATE(),
          key: version.storageKey,
          expiresIn: 300,
        });
      } else {
        url = publicUrlFor(version.storageKey);
      }
      return json({ url, fileName: version.fileName, version: version.version });
    }

    // Sin versión específica: devolver la última versión publicada
    // o todas las URLs disponibles
    const versions = await listVersions(slug);
    if (versions.length === 0) return error('Sin versiones publicadas', 404);
    const latest = versions[0];
    let url;
    if (latest.storageBucket === 'private') {
      url = await createDownloadUrl({
        bucket: BUCKET_PRIVATE(),
        key: latest.storageKey,
        expiresIn: 300,
      });
    } else {
      url = publicUrlFor(latest.storageKey);
    }
    return json({ url, fileName: latest.fileName, version: latest.version });
  },
});
