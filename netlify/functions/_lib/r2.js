import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { requireEnv, env } from './env.js';

// Cliente S3 compatible (Backblaze B2, Cloudflare R2, etc.)
let client;
function r2Client() {
  if (client) return client;
  const endpoint = requireEnv('R2_ENDPOINT');
  const region = process.env.R2_REGION || endpoint.replace(/^https?:\/\/s3\.([^.]+)\..*$/, '$1') || 'auto';
  client = new S3Client({
    region,
    endpoint,
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

// Genera URL pública (solo si hay base URL configurada)
export function publicUrlFor(key) {
  const base = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/$/, '');
  if (!base) return null;
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
