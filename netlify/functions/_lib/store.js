import { getStore } from '@netlify/blobs';

// Acceso centralizado a Netlify Blobs para plugins y versiones
export function pluginsStore() {
  return getStore('plugins');
}

export function versionsStore() {
  return getStore('versions');
}

// ---------- Plugins ----------
export async function listPlugins({ includeUnpublished = false } = {}) {
  const store = pluginsStore();
  const res = await store.list();
  const out = [];
  for (const { key } of res.blobs) {
    const p = await store.get(key, { type: 'json' });
    if (!p) continue;
    if (!includeUnpublished && p.visibility === 'private' && !p.published) continue;
    out.push(p);
  }
  return out.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

export async function getPlugin(slug) {
  const store = pluginsStore();
  return await store.get(`plugin:${slug}`, { type: 'json' });
}

export async function putPlugin(plugin) {
  const store = pluginsStore();
  const p = { ...plugin, updatedAt: new Date().toISOString() };
  await store.setJSON(`plugin:${p.slug}`, p);
  return p;
}

export async function deletePlugin(slug) {
  const store = pluginsStore();
  // Borrar versiones asociadas
  const versions = await listVersions(slug);
  for (const v of versions) {
    await deleteVersion(slug, v.version);
  }
  await store.delete(`plugin:${slug}`);
}

// ---------- Versiones ----------
export async function listVersions(slug, { includeUnpublished = false } = {}) {
  const store = versionsStore();
  const res = await store.list({ prefix: `version:${slug}:` });
  const out = [];
  for (const { key } of res.blobs) {
    const v = await store.get(key, { type: 'json' });
    if (!v) continue;
    if (!includeUnpublished && !v.published) continue;
    out.push(v);
  }
  return out.sort((a, b) => compareVersions(b.version, a.version));
}

export async function getVersion(slug, version) {
  const store = versionsStore();
  return await store.get(`version:${slug}:${version}`, { type: 'json' });
}

export async function putVersion(version) {
  const store = versionsStore();
  const v = { ...version, updatedAt: new Date().toISOString() };
  await store.setJSON(`version:${v.slug}:${v.version}`, v);
  // Asegura que el plugin tenga referencia a su última versión
  const plugin = await getPlugin(v.slug);
  if (plugin) {
    const latest = (await listVersions(v.slug, { includeUnpublished: false }))[0];
    if (latest) {
      plugin.latestVersion = latest.version;
      plugin.updatedAt = new Date().toISOString();
      await putPlugin(plugin);
    }
  }
  return v;
}

export async function deleteVersion(slug, version) {
  const store = versionsStore();
  let v = await getVersion(slug, version);
  if (v) {
    // Borrar objeto en R2 asociado
    const { deleteObject, BUCKET_PUBLIC, BUCKET_PRIVATE } = await import('./r2.js');
    try {
      const bucket = v.storageBucket === 'public' ? BUCKET_PUBLIC() : BUCKET_PRIVATE();
      await deleteObject({ bucket, key: v.storageKey });
    } catch (e) {}
  }
  await store.delete(`version:${slug}:${version}`);
}

// Genera y escribe manifest público (lista de plugins publicados)
export async function rebuildPublicManifest() {
  const store = pluginsStore();
  const plugins = (await listPlugins({ includeUnpublished: false })).filter((p) => p.published);
  // Manifest incluye resúmenes y metadatos públicos
  const manifest = { generatedAt: new Date().toISOString(), plugins: [] };
  for (const p of plugins) {
    const versions = await listVersions(p.slug);
    manifest.plugins.push({
      slug: p.slug,
      name: p.name,
      description: p.description,
      author: p.author,
      category: p.category,
      tags: p.tags,
      homepage: p.homepage,
      thumbnail: p.thumbnail,
      latestVersion: p.latestVersion,
      versions: versions.map((v) => ({
        version: v.version,
        gameVersion: v.gameVersion,
        changelog: v.changelog,
        publishedAt: v.updatedAt,
      })),
    });
  }
  await store.setJSON('manifest:public', manifest);
  return manifest;
}

export async function getPublicManifest() {
  const store = pluginsStore();
  return await store.get('manifest:public', { type: 'json' });
}

function compareVersions(a, b) {
  if (!a || !b) return a ? 1 : b ? -1 : 0;
  const pa = String(a).split(/[\.\-\s+]+/);
  const pb = String(b).split(/[\.\-\s+]+/);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = parseInt(pa[i] || '0', 10);
    const y = parseInt(pb[i] || '0', 10);
    if (x !== y) return x - y;
    const sx = (pa[i] || '').replace(/[0-9]/g, '');
    const sy = (pb[i] || '').replace(/[0-9]/g, '');
    if (sx !== sy) return sx.localeCompare(sy);
  }
  return 0;
}
