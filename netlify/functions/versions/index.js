import { createHandler, parseBody } from '../_lib/handler.js';
import { json, error } from '../_lib/responses.js';
import { requireUser, requireRole } from '../_lib/auth.js';
import { getVersion, listVersions, putVersion, deleteVersion, getPlugin, rebuildPublicManifest } from '../_lib/store.js';
import { VersionInput } from '../_lib/schemas.js';
import { createUploadUrl, createDownloadUrl, publicUrlFor, BUCKET_PRIVATE, BUCKET_PUBLIC } from '../_lib/r2.js';

export const handler = createHandler({
  handler: async (event) => {
    await requireUser(event);
    const method = event.httpMethod;
    const slug = event.queryStringParameters?.slug;
    const versionStr = event.queryStringParameters?.version;

    if (!slug) return error('slug requerido', 400);

    // Operación sobre una versión específica
    if (versionStr) {
      if (method === 'GET') {
        const version = await getVersion(slug, versionStr);
        if (!version) return error('Versión no encontrada', 404);
        let downloadUrl = null;
        if (version.storageBucket === 'private') {
          downloadUrl = await createDownloadUrl({ bucket: BUCKET_PRIVATE(), key: version.storageKey, expiresIn: 300 });
        } else {
          downloadUrl = publicUrlFor(version.storageKey);
        }
        return json({ version, downloadUrl });
      }

      if (method === 'PATCH') {
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

      if (method === 'DELETE') {
        await requireRole(event, 'admin');
        await deleteVersion(slug, versionStr);
        await rebuildPublicManifest();
        return json({ ok: true });
      }

      return error('Método no soportado', 405);
    }

    // Operaciones sobre el listado de versiones
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
        storageKey = `${slug}/${parsed.data.version}/${parsed.data.fileName}`;
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
