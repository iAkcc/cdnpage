import { createHandler, parseBody } from '../_lib/handler.js';
import { json, error } from '../_lib/responses.js';
import { requireUser } from '../_lib/auth.js';
import { RequestUploadInput } from '../_lib/schemas.js';
import { createUploadUrl, BUCKET_PRIVATE, BUCKET_PUBLIC } from '../_lib/r2.js';

// Endpoint que genera URLs de subida firmadas (presigned PUT) para archivos
export const handler = createHandler({
  handler: async (event) => {
    await requireUser(event);

    if (event.httpMethod !== 'POST') return error('Método no soportado', 405);

    const body = parseBody(event);
    const parsed = RequestUploadInput.safeParse(body);
    if (!parsed.success) return error('Datos inválidos', 422, { issues: parsed.error.issues });

    const data = parsed.data;
    // Construir key de almacenamiento con estructura jerárquica
    const parts = [];
    if (data.pluginSlug) parts.push(data.pluginSlug);
    if (data.version) parts.push(data.version);
    parts.push(data.fileName);
    const key = parts.join('/');

    const bucket = data.bucket === 'public' ? BUCKET_PUBLIC() : BUCKET_PRIVATE();
    const isPrivate = data.bucket === 'private';

    const uploadUrl = await createUploadUrl({
      bucket,
      key,
      contentType: data.contentType,
      expiresIn: 3600,
    });

    return json({
      uploadUrl,
      storageKey: key,
      storageBucket: data.bucket,
      downloadUrl: isPrivate ? null : `${process.env.R2_PUBLIC_BASE_URL || ''}/${key}`,
    });
  },
});
