import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { requireEnv, env } from './env.js';

// Cliente S3 compatible con Cloudflare R2
let client;
function r2Client() {
  if (client) return client;
  client = new S3Client({
    region: 'auto',
    endpoint: requireEnv('R2_ENDPOINT'),
    credentials: {
      accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
    },
    forcePathStyle: false,
  });
  return client;
}

export const BUCKET_PUBLIC = () => process.env.R2_BUCKET_PUBLIC || 'cdn-public';
export const BUCKET_PRIVATE = () => process.env.R2_BUCKET_PRIVATE || 'cdn-private';

// Genera URL pública (solo para el bucket público)
export function publicUrlFor(key) {
  const base = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/$/, '');
  if (!base) throw new Error('R2_PUBLIC_BASE_URL no configurado');
  return `${base}/${encodeKey(key)}`;
}

// Genera URL firmada (PUT) para subir desde el navegador al bucket privado/público
export async function createUploadUrl({ bucket, key, contentType, expiresIn = 300 }) {
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  return await getSignedUrl(r2Client(), cmd, { expiresIn });
}

// Genera URL firmada (GET) para descargar desde el bucket privado
export async function createDownloadUrl({ bucket, key, expiresIn }) {
  const ttl = expiresIn || Number(process.env.R2_SIGNED_URL_TTL || 900);
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return await getSignedUrl(r2Client(), cmd, { expiresIn: ttl });
}

export async function deleteObject({ bucket, key }) {
  const cmd = new DeleteObjectCommand({ Bucket: bucket, Key: key });
  await r2Client().send(cmd);
}

export async function objectExists({ bucket, key }) {
  try {
    const cmd = new HeadObjectCommand({ Bucket: bucket, Key: key });
    await r2Client().send(cmd);
    return true;
  } catch (e) {
    if (e.name === 'NotFound' || e.$metadata?.httpStatusCode === 404) return false;
    throw e;
  }
}

function encodeKey(key) {
  return key.split('/').map(encodeURIComponent).join('/');
}
