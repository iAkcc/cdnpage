import { createHandler, parseBody } from '../_lib/handler.js';
import { json, error } from '../_lib/responses.js';
import { requireUser, requireRole } from '../_lib/auth.js';
import { listVersions, putVersion, deleteVersion, getPlugin, rebuildPublicManifest } from '../_lib/store.js';
import { VersionInput } from '../_lib/schemas.js';
import { createUploadUrl, BUCKET_PRIVATE, BUCKET_PUBLIC } from '../_lib/r2.js';

function versionKey(slug, version) {
  return `${slug}/${version}/`;
}

export const handler = createHandler({
  handler: async (event) => {
    await requireUser(event);
    const method = event.httpMethod;
    const slug = event.queryStringParameters?.slug;

    if (!slug) return error('slug requerido', 400);

    if (method === 'GET') {
      const versions = await listVersions(slug, { includeUnpublished: true });
      return json({ versions });
    }

    if (method === 'POST') {
      const body = parseBody(event);
      const parsed = VersionInput.safeParse(body);
      if (!parsed.success) return error('Datos inválidos', 422, { issues: parsed.error.issues });
      const plugin = await getPlugin(slug);
      if (!plugin) return error('Plugin no encontrado', 404);

      let uploadUrl = body.uploadUrl;
      let storageKey = body.storageKey;
      if (!storageKey) {
        storageKey = `${versionKey(slug, parsed.data.version)}${parsed.data.fileName}`;
        const bucket = parsed.data.storageBucket === 'public' ? BUCKET_PUBLIC() : BUCKET_PRIVATE();
        uploadUrl = await createUploadUrl({ bucket, key: storageKey, contentType: parsed.data.contentType, expiresIn: 3600 });
      }

      const version = { ...parsed.data, slug, storageKey, uploadUrl, createdAt: new Date().toISOString() };
      await putVersion(version);
      return json({ version, uploadUrl });
    }

    return error('Método no soportado', 405);
  },
});
