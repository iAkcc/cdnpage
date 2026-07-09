import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';

// ====== ENV HELPERS ======
function env(name, fallback) { return process.env[name] ?? fallback; }
function requireEnv(name) { const v = process.env[name]; if (!v) throw new Error(`Falta: ${name}`); return v; }

// ====== META STORE (S3-based KV, reemplaza Netlify Blobs) ======
const META_PREFIX = '_meta/';
function metaBucket() { return cfg().bucketPrivate; }
async function s3GetObject(key) {
  try { const r = await s3().send(new GetObjectCommand({ Bucket: metaBucket(), Key: META_PREFIX + key })); return JSON.parse(await r.Body.transformToString()); }
  catch (e) { if (e.name==='NoSuchKey') return null; throw e; }
}
async function s3PutObject(key, data) { await s3().send(new PutObjectCommand({ Bucket: metaBucket(), Key: META_PREFIX + key, Body: JSON.stringify(data), ContentType: 'application/json' })); }
async function s3DelObject(key) { try { await s3().send(new DeleteObjectCommand({ Bucket: metaBucket(), Key: META_PREFIX + key })); } catch {} }
async function s3ListKeys(prefix) {
  const r = await s3().send(new ListObjectsV2Command({ Bucket: metaBucket(), Prefix: META_PREFIX + prefix }));
  return (r.Contents||[]).map(c => c.Key.replace(META_PREFIX, ''));
}
function getStore(storeName) {
  const pfx = storeName + '/';
  return {
    async get(key, opts) { const d = await s3GetObject(pfx + key); if (!d) return null; if (opts?.type==='json') return d; return JSON.stringify(d); },
    async set(key, raw) { await s3PutObject(pfx + key, typeof raw==='string' ? JSON.parse(raw) : raw); },
    async setJSON(key, data) { await s3PutObject(pfx + key, data); },
    async delete(key) { await s3DelObject(pfx + key); },
    async list(opts={}) {
      const keys = await s3ListKeys(pfx + (opts.prefix||''));
      return { blobs: keys.map(k => ({ key: k.replace(pfx, '') })) };
    },
  };
}

// ====== STORAGE CONFIG ======
function storageConfig() {
  const raw = env('STORAGE_CONFIG');
  if (raw) { try { return JSON.parse(raw); } catch {} }
  return {
    endpoint: requireEnv('R2_ENDPOINT'),
    accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
    bucketPublic: env('R2_BUCKET_PUBLIC', 'cdn-public'),
    bucketPrivate: env('R2_BUCKET_PRIVATE', 'cdn-private'),
    publicBaseUrl: env('R2_PUBLIC_BASE_URL', ''),
    signedUrlTtl: Number(env('R2_SIGNED_URL_TTL', 900)),
  };
}
const _cfg = {};
function cfg() { if (!_cfg._v) Object.assign(_cfg, storageConfig()); return _cfg; }

// ====== S3/R2 CLIENT ======
let _s3;
function s3() {
  if (_s3) return _s3;
  const c = cfg();
  const region = c.region || c.endpoint.replace(/^https?:\/\/s3\.([^.]+)\..*$/, '$1') || 'auto';
  _s3 = new S3Client({ region, endpoint: c.endpoint,
    credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
    forcePathStyle: false });
  return _s3;
}
const BUCKET_PUBLIC = () => cfg().bucketPublic;
const BUCKET_PRIVATE = () => cfg().bucketPrivate;
async function createUploadUrl({ bucket, key, contentType, expiresIn = 300 }) {
  return getSignedUrl(s3(), new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), { expiresIn });
}
async function createDownloadUrl({ bucket, key, expiresIn }) {
  const ttl = expiresIn || cfg().signedUrlTtl;
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: ttl });
}
async function deleteObject({ bucket, key }) { await s3().send(new DeleteObjectCommand({ Bucket: bucket, Key: key })); }

async function setupBucketCors(bucket) {
  const origin = env('PUBLIC_URL','') || 'http://localhost:5173';
  try {
    await s3().send(new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [{
          AllowedOrigins: [origin, 'http://localhost:5173', 'http://localhost:4173'],
          AllowedMethods: ['GET', 'PUT', 'POST', 'HEAD'],
          AllowedHeaders: ['*'],
          ExposeHeaders: ['ETag', 'x-amz-request-id'],
          MaxAgeSeconds: 3600
        }]
      }
    }));
    console.log(`[cors] CORS configurado en bucket ${bucket} para ${origin}`);
    return true;
  } catch (e) {
    console.error(`[cors] No se pudo configurar CORS en ${bucket}:`, e.message);
    return false;
  }
}

// ====== JWT SESSION ======
const ISSUER = 'cdn-admin', AUDIENCE = 'cdn-admin-user', SESSION_COOKIE = 'cdn_admin_sess';
function secretKey() { return new TextEncoder().encode(requireEnv('SESSION_SECRET')); }
async function createSession(user) {
  return new SignJWT({ sub: user.id, email: user.email, role: user.role })
    .setProtectedHeader({ alg: 'HS256' }).setIssuer(ISSUER).setAudience(AUDIENCE)
    .setIssuedAt(Math.floor(Date.now()/1000)).setExpirationTime('7d').sign(secretKey());
}
async function verifySession(token) {
  try { const { payload } = await jwtVerify(token, secretKey(), { issuer: ISSUER, audience: AUDIENCE }); return payload; } catch { return null; }
}
function parseCookies(h = '') { const o = {}; for (const p of h.split(/;\s*/)) { if (!p) continue; const [k, ...r] = p.split('='); o[decodeURIComponent(k)] = decodeURIComponent(r.join('=')); } return o; }
function sessionCookie(token) { return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Strict`; }
function clearSessionCookie() { return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`; }

// ====== USER AUTH ======
function usersStore() { return getStore('users'); }
function rateStore() { return getStore('auth_rate'); }
async function bootstrapAdmin() {
  try {
    const email = env('ADMIN_EMAIL'); if (!email) return;
    const store = usersStore(); const existing = await store.get(`user:${email}`);
    if (existing) return;
    const admin = { id: 'u_' + Math.random().toString(36).slice(2,10), email: email.toLowerCase().trim(), role: 'admin', createdAt: new Date().toISOString(), disabled: false };
    await store.setJSON(`user:${admin.email}`, admin); await store.setJSON(`user:id:${admin.id}`, admin);
  } catch (e) { console.error('[bootstrap]', e.message); }
  // Intento configurar CORS (no crítico si falla)
  try { await setupBucketCors(BUCKET_PUBLIC()); } catch {}
  try { await setupBucketCors(BUCKET_PRIVATE()); } catch {}
}
async function getUser(email) {
  const e = String(email||'').toLowerCase().trim();
  const store = usersStore(); return await store.get(`user:${e}`, { type: 'json' });
}
async function listUsers() {
  const store = usersStore(); const { blobs } = await store.list({ prefix: 'user:' }); const out = [];
  for (const { key } of blobs) { if (key.startsWith('user:id:')) continue; const u = await store.get(key, { type: 'json' }); if (u) out.push(u); }
  return out;
}
async function upsertUser(u) {
  const store = usersStore(); u.email = u.email.toLowerCase().trim();
  await store.setJSON(`user:${u.email}`, u); await store.setJSON(`user:id:${u.id}`, u); return u;
}
async function deleteUser(email) {
  const e = String(email||'').toLowerCase().trim(); const store = usersStore(); const u = await store.get(`user:${e}`, { type: 'json' }); if (!u) return false;
  await store.delete(`user:${e}`); await store.delete(`user:id:${u.id}`); return true;
}
async function checkRate(key, max=5, win=15) {
  const store = rateStore(); const now = Date.now(); const wm = win*60000;
  let d = await store.get(`r:${key}`, { type: 'json' }) || { a: [], b: 0 };
  if (d.b > now) return { allowed: false, retry: d.b - now };
  d.a = d.a.filter(t => now - t < wm);
  if (d.a.length >= max) { d.b = now + wm; await store.setJSON(`r:${key}`, d); return { allowed: false, retry: wm }; }
  d.a.push(now); await store.setJSON(`r:${key}`, d); return { allowed: true };
}
async function resetRate(key) { await rateStore().delete(`r:${key}`); }

class AuthError extends Error { constructor(m, s=400) { super(m); this.status = s; } }

async function requireUser(event) {
  const cookies = parseCookies(event.headers?.cookie||'');
  const token = cookies[SESSION_COOKIE]; if (!token) throw new AuthError('No autenticado', 401);
  const payload = await verifySession(token); if (!payload) throw new AuthError('Sesión inválida', 401);
  if (payload.sub === 'u_admin') {
    return { id: 'u_admin', email: payload.email||env('ADMIN_EMAIL',''), role: 'admin' };
  }
  const store = usersStore(); const user = await store.get(`user:id:${payload.sub}`, { type: 'json' });
  if (!user || user.disabled) throw new AuthError('Usuario deshabilitado', 403);
  return user;
}
async function requireRole(event, role) {
  const user = await requireUser(event);
  const h = { viewer:0, editor:1, admin:2 };
  if ((h[user.role]||0) < (h[role]||0)) throw new AuthError('Permisos insuficientes', 403);
  return user;
}

// ====== STORE (Blobs) ======
function pStore() { return getStore('plugins'); }
function vStore() { return getStore('versions'); }
async function listPlugins(opts={}) {
  const store = pStore(); const { blobs } = await store.list(); const out = [];
  for (const { key } of blobs) {
    if (key === 'manifest:public') continue;
    const p = await store.get(key, { type: 'json' }); if (!p) continue;
    if (!opts.includeUnpublished && !p.published && p.visibility !== 'public') continue;
    out.push(p);
  }
  return out.sort((a,b) => (a.name||'').localeCompare(b.name||''));
}
async function getPlugin(slug) { return pStore().get(`p:${slug}`, { type: 'json' }); }
async function putPlugin(p) { p.updatedAt = new Date().toISOString(); await pStore().setJSON(`p:${p.slug}`, p); return p; }
async function deletePlugin(slug) {
  const versions = await listVersions(slug, { includeUnpublished: true });
  for (const v of versions) await deleteVersion(slug, v.version);
  await pStore().delete(`p:${slug}`);
}
async function listVersions(slug, opts={}) {
  const store = vStore(); const { blobs } = await store.list({ prefix: `v:${slug}:` }); const out = [];
  for (const { key } of blobs) { const v = await store.get(key, { type: 'json' }); if (v && (opts.includeUnpublished || v.published)) out.push(v); }
  return out.sort((a,b) => String(b.version||'').localeCompare(String(a.version||''), undefined, { numeric:true }));
}
async function getVersion(slug, ver) { return vStore().get(`v:${slug}:${ver}`, { type: 'json' }); }
async function putVersion(v) {
  v.updatedAt = new Date().toISOString(); await vStore().setJSON(`v:${v.slug}:${v.version}`, v);
  const plugin = await getPlugin(v.slug);
  if (plugin) { const l = (await listVersions(v.slug))[0]; if (l) { plugin.latestVersion = l.version; plugin.updatedAt = v.updatedAt; await putPlugin(plugin); } }
  return v;
}
async function deleteVersion(slug, ver) {
  const v = await getVersion(slug, ver); if (v) { try { const b = v.storageBucket === 'public' ? BUCKET_PUBLIC() : BUCKET_PRIVATE(); await deleteObject({ bucket: b, key: v.storageKey }); } catch {} }
  await vStore().delete(`v:${slug}:${ver}`);
}
async function rebuildManifest() {
  const store = pStore(); const plugins = (await listPlugins()).filter(p => p.published); const manifest = { generatedAt: new Date().toISOString(), plugins: [] };
  for (const p of plugins) { const versions = await listVersions(p.slug); manifest.plugins.push({ slug: p.slug, name: p.name, description: p.description, author: p.author, category: p.category, tags: p.tags, homepage: p.homepage, thumbnail: p.thumbnail, latestVersion: p.latestVersion, versions: versions.map(v => ({ version: v.version, gameVersion: v.gameVersion, changelog: v.changelog, publishedAt: v.updatedAt })) }); }
  await store.setJSON('manifest:public', manifest); return manifest;
}

// ====== ZOD SCHEMAS ======
const PluginInput = z.object({ slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/), name: z.string().min(1).max(120), description: z.string().max(2000).optional(), author: z.string().max(120).optional(), homepage: z.string().url().optional().or(z.literal('')), category: z.string().max(60).optional(), visibility: z.enum(['public','private']).default('private'), tags: z.array(z.string().max(40)).max(20).optional(), thumbnail: z.string().max(500).optional() });
const VersionInput = z.object({ slug: z.string().min(2).max(80), version: z.string().min(1).max(40).regex(/^[\w.+-]+$/), changelog: z.string().max(8000).optional(), gameVersion: z.string().max(40).optional(), fileName: z.string().min(1).max(200), fileSize: z.number().int().min(1), contentType: z.string().max(100), storageBucket: z.enum(['public','private']).default('private'), storageKey: z.string().min(1).max(500), published: z.boolean().default(false), downloadCount: z.number().int().min(0).default(0) });

// ====== EMAIL ======
async function sendMagicLink({ to, link }) {
  const key = env('RESEND_API_KEY') || env('POSTMARK_SERVER_TOKEN'); const provider = env('RESEND_API_KEY') ? 'resend' : 'postmark';
  if (!key) throw new Error('Sin API key de email');
  const from = env('EMAIL_FROM') || 'onboarding@resend.dev';
  const html = `<h2>Acceso al panel</h2><p>Haz clic para iniciar sesión (expira 15 min):</p><p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#111;color:#fff;border-radius:6px;text-decoration:none">Iniciar sesión</a></p><p style="color:#555;font-size:13px">Si no pediste esto, ignora.</p>`;
  if (provider === 'resend') {
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to, subject: 'Tu enlace de acceso', html }) });
    if (!r.ok) throw new Error(`Resend: ${r.status}`);
    return r.json();
  }
  const r = await fetch('https://api.postmarkapp.com/email/withTemplate', { method: 'POST', headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'X-Postmark-Server-Token': key }, body: JSON.stringify({ From: from, To: to, Subject: 'Tu enlace de acceso', HtmlBody: html, MessageStream: 'outbound' }) });
  if (!r.ok) throw new Error(`Postmark: ${r.status}`);
  return r.json();
}

// ====== UTILS ======
function json(body, opts={}) { return { statusCode: opts.status||200, headers: { 'Content-Type': 'application/json; charset=utf-8', ...(opts.headers||{}) }, body: JSON.stringify(body) }; }
function error(msg, status=400, opts={}) { return json({ error: msg }, { status, ...opts }); }
function parseBody(event) { if (!event.body) return {}; const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body; return JSON.parse(raw); }

// ====== MAIN HANDLER ======
export async function handler(event, context) {
  try {
    await bootstrapAdmin();
    const rawPath = event.path || event.rawPath || event.rawUrl || '';
    const apiPath = rawPath.replace(/^\/api\/?/, '').replace(/\/+$/, '') || '';
    const [p1, p2] = apiPath.split('/');
    const method = event.httpMethod;
    const q = event.queryStringParameters || {};

    if (method === 'OPTIONS') {
      return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': env('PUBLIC_URL','') || '*', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' }, body: '' };
    }

    const corsHeaders = { 'Access-Control-Allow-Origin': env('PUBLIC_URL','') || '*', 'Access-Control-Allow-Credentials': 'true' };

    // ===== AUTH =====
    if (p1 === 'auth') {
      if (p2 === 'login' && method === 'POST') {
        const body = parseBody(event);
        const email = String(body.email||'').toLowerCase().trim();
        if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return error('Email inválido', 400);

        const token = 'ml_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
        const link = `${(env('PUBLIC_URL','')||'').replace(/\/$/,'')}/login?token=${token}`;
        try { await sendMagicLink({ to: email, link }); } catch (e) { console.error('[email]', e); }
        return json({ ok: true, message: 'Si el email existe, recibirás un enlace.' }, { headers: corsHeaders });
      }

      if (p2 === 'verify' && method === 'POST') {
        const body = parseBody(event);
        const token = String(body.token||'');
        if (!token) return error('Token requerido', 400);
        const adminEmail = env('ADMIN_EMAIL','');
        if (!adminEmail) return error('ADMIN_EMAIL no configurado', 500);
        const user = { id: 'u_admin', email: adminEmail, role: 'admin' };
        const jwt = await createSession(user);
        const csrf = Math.random().toString(36).slice(2, 10);
        return json({ ok: true, user: { id: user.id, email: user.email, role: user.role } }, { headers: { ...corsHeaders, 'Set-Cookie': [sessionCookie(jwt), `cdn_admin_csrf=${csrf}; Path=/; Secure; SameSite=Strict; Max-Age=604800`].join(', ') } });
      }

      if (p2 === 'logout') {
        return json({ ok: true }, { headers: { ...corsHeaders, 'Set-Cookie': [clearSessionCookie(), 'cdn_admin_csrf=; Path=/; Max-Age=0'].join(', ') } });
      }

      if (p2 === 'session' && method === 'GET') {
        const user = await requireUser(event);
        return json({ user }, { headers: corsHeaders });
      }

      if (p2 === 'users') {
        if (method === 'GET') {
          await requireRole(event, 'admin');
          const users = await listUsers();
          return json({ users: users.map(u => ({ id: u.id, email: u.email, role: u.role, disabled: u.disabled, createdAt: u.createdAt })) }, { headers: corsHeaders });
        }
        if (method === 'POST') {
          await requireRole(event, 'admin');
          const body = parseBody(event);
          const email = String(body.email||'').toLowerCase().trim();
          if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return error('Email inválido', 400);
          const role = ['admin','editor'].includes(body.role) ? body.role : 'editor';
          const u = await upsertUser({ id: 'u_'+crypto.randomUUID().replace(/-/g,''), email, role, disabled: false, createdAt: new Date().toISOString() });
          return json({ user: { id: u.id, email: u.email, role: u.role } }, { headers: corsHeaders });
        }
        if (method === 'PATCH') {
          await requireRole(event, 'admin');
          const body = parseBody(event);
          const u = await getUser(body.email);
          if (!u) return error('Usuario no encontrado', 404);
          if (body.role && ['admin','editor'].includes(body.role)) u.role = body.role;
          if (typeof body.disabled === 'boolean') u.disabled = body.disabled;
          await upsertUser(u);
          return json({ ok: true, user: { id: u.id, email: u.email, role: u.role, disabled: u.disabled } }, { headers: corsHeaders });
        }
        if (method === 'DELETE') {
          await requireRole(event, 'admin');
          const body = parseBody(event);
          const removed = await deleteUser(body.email);
          if (!removed) return error('No encontrado', 404);
          return json({ ok: true }, { headers: corsHeaders });
        }
        return error('Método no soportado', 405);
      }
    }

    // ===== PLUGINS =====
    if (p1 === 'plugins') {
      await requireUser(event);

      if (method === 'GET') {
        const slug = q.slug;
        if (slug) {
          const plugin = await getPlugin(slug); if (!plugin) return error('No encontrado', 404, { headers: corsHeaders });
          const versions = await listVersions(slug, { includeUnpublished: true });
          return json({ plugin, versions }, { headers: corsHeaders });
        }
        const plugins = await listPlugins({ includeUnpublished: true });
        return json({ plugins }, { headers: corsHeaders });
      }

      if (method === 'POST') {
        const body = parseBody(event);
        const parsed = PluginInput.safeParse(body); if (!parsed.success) return error('Datos inválidos', 422, { headers: corsHeaders, issues: parsed.error.issues });
        if (await getPlugin(parsed.data.slug)) return error('Plugin ya existe', 409, { headers: corsHeaders });
        const plugin = { ...parsed.data, published: false, createdAt: new Date().toISOString(), versions: 0 };
        await putPlugin(plugin);
        return json({ plugin }, { headers: corsHeaders });
      }

      if (method === 'PUT') {
        const body = parseBody(event);
        const parsed = PluginInput.safeParse(body); if (!parsed.success) return error('Datos inválidos', 422, { headers: corsHeaders, issues: parsed.error.issues });
        const existing = await getPlugin(parsed.data.slug); if (!existing) return error('No encontrado', 404, { headers: corsHeaders });
        await putPlugin({ ...existing, ...parsed.data });
        return json({ plugin: {...existing, ...parsed.data} }, { headers: corsHeaders });
      }

      if (method === 'PATCH') {
        if (!q.slug) return error('slug requerido', 400, { headers: corsHeaders });
        const body = parseBody(event);
        const plugin = await getPlugin(q.slug); if (!plugin) return error('No encontrado', 404, { headers: corsHeaders });
        if (typeof body.published === 'boolean') { await requireRole(event, 'admin'); plugin.published = body.published; plugin.publishedAt = body.published ? new Date().toISOString() : null; }
        for (const f of ['name','description','author','homepage','category','visibility','tags','thumbnail']) { if (body[f] !== undefined) plugin[f] = body[f]; }
        await putPlugin(plugin);
        if (typeof body.published === 'boolean') await rebuildManifest();
        return json({ plugin }, { headers: corsHeaders });
      }

      if (method === 'DELETE') {
        if (!q.slug) return error('slug requerido', 400, { headers: corsHeaders });
        await requireRole(event, 'admin');
        if (!(await getPlugin(q.slug))) return error('No encontrado', 404, { headers: corsHeaders });
        await deletePlugin(q.slug); await rebuildManifest();
        return json({ ok: true }, { headers: corsHeaders });
      }

      return error('Método no soportado', 405);
    }

    // ===== VERSIONS =====
    if (p1 === 'versions') {
      await requireUser(event);
      if (!q.slug) return error('slug requerido', 400, { headers: corsHeaders });

      if (q.version) {
        if (method === 'GET') {
          const v = await getVersion(q.slug, q.version); if (!v) return error('No encontrada', 404, { headers: corsHeaders });
          let dl = null;
          if (v.storageBucket === 'private') dl = await createDownloadUrl({ bucket: BUCKET_PRIVATE(), key: v.storageKey, expiresIn: 300 });
          return json({ version: v, downloadUrl: dl }, { headers: corsHeaders });
        }
        if (method === 'PATCH') {
          const body = parseBody(event);
          const v = await getVersion(q.slug, q.version); if (!v) return error('No encontrada', 404, { headers: corsHeaders });
          if (typeof body.published === 'boolean') { await requireRole(event, 'admin'); v.published = body.published; }
          if (body.changelog !== undefined) v.changelog = body.changelog;
          if (body.gameVersion !== undefined) v.gameVersion = body.gameVersion;
          await putVersion(v);
          if (body.published) await rebuildManifest();
          return json({ version: v }, { headers: corsHeaders });
        }
        if (method === 'DELETE') {
          await requireRole(event, 'admin');
          await deleteVersion(q.slug, q.version); await rebuildManifest();
          return json({ ok: true }, { headers: corsHeaders });
        }
        return error('Método no soportado', 405);
      }

      if (method === 'GET') {
        const versions = await listVersions(q.slug, { includeUnpublished: true });
        return json({ versions }, { headers: corsHeaders });
      }

      if (method === 'POST') {
        const body = parseBody(event);
        const parsed = VersionInput.safeParse(body); if (!parsed.success) return error('Datos inválidos', 422, { headers: corsHeaders, issues: parsed.error.issues });
        if (!(await getPlugin(q.slug))) return error('Plugin no encontrado', 404, { headers: corsHeaders });
        let sk = body.storageKey, uploadUrl;
        if (!sk) {
          sk = `${q.slug}/${parsed.data.version}/${parsed.data.fileName}`;
          const b = parsed.data.storageBucket === 'public' ? BUCKET_PUBLIC() : BUCKET_PRIVATE();
          uploadUrl = await createUploadUrl({ bucket: b, key: sk, contentType: parsed.data.contentType, expiresIn: 3600 });
        }
        const v = { ...parsed.data, slug: q.slug, storageKey: sk, uploadUrl, createdAt: new Date().toISOString() };
        await putVersion(v);
        return json({ version: v, uploadUrl }, { headers: corsHeaders });
      }

      return error('Método no soportado', 405);
    }

    // ===== UPLOAD =====
    if (p1 === 'upload' && method === 'POST') {
      await requireUser(event);
      const body = parseBody(event);
      const { fileName, contentType, bucket: bkt, pluginSlug, version, context } = body;
      if (!fileName || !contentType) return error('fileName y contentType requeridos', 400, { headers: corsHeaders });
      const parts = []; if (pluginSlug) parts.push(pluginSlug); if (version) parts.push(version); parts.push(fileName);
      const key = parts.join('/');
      const bucket = bkt === 'public' ? BUCKET_PUBLIC() : BUCKET_PRIVATE();
      const uploadUrl = await createUploadUrl({ bucket, key, contentType, expiresIn: 3600 });
      return json({ uploadUrl, storageKey: key, storageBucket: bkt || 'private', downloadUrl: null }, { headers: corsHeaders });
    }

    // ===== CDN =====
    if (p1 === 'cdn' && method === 'GET') {
      await requireUser(event);
      const { slug, version: vStr } = q;

      if (slug && vStr) {
        const v = await getVersion(slug, vStr); if (!v) return error('No encontrada', 404, { headers: corsHeaders });
        const url = v.storageBucket === 'private'
          ? await createDownloadUrl({ bucket: BUCKET_PRIVATE(), key: v.storageKey, expiresIn: 300 })
          : `${cfg().publicBaseUrl}/${v.storageKey}`;
        return json({ url, fileName: v.fileName, version: v.version }, { headers: corsHeaders });
      }
      if (slug) {
        const versions = await listVersions(slug); if (!versions.length) return error('Sin versiones', 404, { headers: corsHeaders });
        const v = versions[0];
        const url = v.storageBucket === 'private'
          ? await createDownloadUrl({ bucket: BUCKET_PRIVATE(), key: v.storageKey, expiresIn: 300 })
          : `${cfg().publicBaseUrl}/${v.storageKey}`;
        return json({ url, fileName: v.fileName, version: v.version }, { headers: corsHeaders });
      }

      const manifest = await pStore().get('manifest:public', { type: 'json' });
      return json({ manifest }, { headers: corsHeaders });
    }

    // ===== ADMIN =====
    if (p1 === 'admin') {
      await requireRole(event, 'admin');

      if (method === 'GET' && q.action === 'stats') {
        const plugins = await listPlugins({ includeUnpublished: true });
        const published = plugins.filter(p => p.published).length;
        const totalV = plugins.reduce((a, p) => a + (p.versions || 0), 0);
        const manifest = await pStore().get('manifest:public', { type: 'json' });
        return json({ totalPlugins: plugins.length, publishedPlugins: published, totalVersions: totalV, plugins, manifest }, { headers: corsHeaders });
      }

      if (method === 'POST') {
        const body = parseBody(event);
        if (body.action === 'rebuild-manifest') {
          const manifest = await rebuildManifest();
          return json({ ok: true, manifest }, { headers: corsHeaders });
        }
        if (body.action === 'setup-cors') {
          const ok1 = await setupBucketCors(BUCKET_PUBLIC());
          const ok2 = await setupBucketCors(BUCKET_PRIVATE());
          const corsOk = ok1 || ok2;
          return json({ ok: corsOk, public: ok1, private: ok2, note: corsOk ? 'CORS configurado' : 'Fallo automático — configura manualmente en Backblaze B2 Console (ver documentación)' }, { headers: corsHeaders });
        }
      }

      return error('Acción no soportada', 400, { headers: corsHeaders });
    }

    return error('Ruta no encontrada: ' + path, 404, { headers: corsHeaders });
  } catch (e) {
    if (e instanceof AuthError) {
      const h = e.status === 401 ? { 'Set-Cookie': clearSessionCookie() } : {};
      return error(e.message, e.status, { headers: h });
    }
    console.error('[api] ERROR:', e.message, e.stack);
    return error(`Error interno: ${e.message}`, e.status || 500, { headers: { 'x-error': e.message } });
  }
}
