<template>
  <div>
    <div v-if="loading" class="card"><div class="skeleton" style="height:200px"></div></div>
    <div v-else-if="!plugin">
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h3>Plugin no encontrado</h3>
        <router-link to="/plugins" class="btn mt-2">← Volver</router-link>
      </div>
    </div>
    <div v-else>
      <div class="page-header">
        <div class="flex-between flex-wrap gap-2">
          <div>
            <div class="flex gap-2">
              <h1>{{ plugin.name }}</h1>
              <span :class="['badge', plugin.published ? 'badge-green' : 'badge-yellow']">{{ plugin.published ? 'Publicado' : 'Borrador' }}</span>
              <span :class="['badge', plugin.visibility === 'public' ? 'badge-blue' : 'badge-red']">{{ plugin.visibility === 'public' ? 'Público' : 'Privado' }}</span>
            </div>
            <p class="text-muted text-sm mt-1">{{ plugin.slug }} · {{ plugin.category || 'Sin categoría' }} · v{{ plugin.latestVersion || '-' }}</p>
          </div>
          <div class="flex gap-1">
            <router-link :to="'/plugins/'+plugin.slug+'/edit'" class="btn btn-sm">✏️ Editar</router-link>
            <button class="btn btn-sm" :class="plugin.published ? 'btn-ghost' : 'btn-primary'" @click="togglePublish">
              {{ plugin.published ? '📥 Retirar' : '📦 Publicar' }}
            </button>
          </div>
        </div>
      </div>

      <div class="grid-2 mb-3">
        <div class="card">
          <p>{{ plugin.description || 'Sin descripción' }}</p>
          <div class="flex gap-2 mt-2 text-sm text-muted">
            <span v-if="plugin.author">✍️ {{ plugin.author }}</span>
            <span v-if="plugin.homepage"><a :href="plugin.homepage" target="_blank">🔗 Web</a></span>
          </div>
          <div class="flex gap-1 mt-2 flex-wrap" v-if="plugin.tags?.length">
            <span v-for="t in plugin.tags" :key="t" class="badge badge-purple">{{ t }}</span>
          </div>
        </div>
        <div class="card">
          <h3 class="mb-2">⚡ Acción rápida</h3>
          <div class="mb-2">
            <label>Última versión — Copiar link CDN</label>
            <div class="url-input-group">
              <input :value="latestUrl || 'Selecciona una versión'" readonly />
              <button class="btn btn-sm btn-primary" @click="copyLatestUrl">📋</button>
            </div>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-sm btn-ghost" @click="copyAllVersions">📋 Copiar todos los links</button>
          </div>
        </div>
      </div>

      <div class="flex-between mb-2">
        <h2>📋 Versiones ({{ versions.length }})</h2>
        <button class="btn btn-sm btn-primary" @click="showNewVersion = !showNewVersion">➕ Nueva versión</button>
      </div>

      <div v-if="showNewVersion" class="card card-accent mb-3">
        <h3 class="mb-2">➕ Nueva versión</h3>
        <div class="grid-2 mb-2">
          <div><label>Versión</label><input v-model="newVer.version" placeholder="1.0.0" /></div>
          <div><label>Game version</label><input v-model="newVer.gameVersion" placeholder="1.20" /></div>
        </div>
        <div class="mb-2">
          <label>Archivo</label>
          <div class="drop-zone" @drop.prevent="onDrop" @dragover.prevent @click="$refs.fileInput.click()" style="padding:1rem">
            <p v-if="!selectedFile">📁 Arrastra o selecciona archivo</p>
            <p v-else><strong>{{ selectedFile.name }}</strong> ({{ formatSize(selectedFile.size) }})</p>
          </div>
          <input ref="fileInput" type="file" style="display:none" @change="onFileChange" accept=".jar,.zip,.yml,.json,.png,.jpg" />
        </div>
        <div class="mb-2"><label>Changelog</label><textarea v-model="newVer.changelog" rows="2"></textarea></div>
        <div class="grid-2 mb-2">
          <div><label>Bucket</label>
            <select v-model="newVer.storageBucket">
              <option value="private">🔒 Privado</option>
              <option value="public">🌍 Público</option>
            </select>
          </div>
          <div><label>Publicar al subir</label>
            <select v-model="newVer.published">
              <option :value="true">Sí</option>
              <option :value="false">No (borrador)</option>
            </select>
          </div>
        </div>
        <button class="btn btn-primary w-full" @click="uploadVersion" :disabled="uploading">
          {{ uploading ? '⏳ Subiendo...' : '⬆️ Subir versión' }}
        </button>
      </div>

      <div v-if="!versions.length" class="card">
        <div class="empty-state"><div class="empty-icon">📋</div><h3>Sin versiones</h3><p>Agrega la primera versión</p></div>
      </div>

      <div v-else class="card" style="padding:0;overflow:hidden">
        <table>
          <thead>
            <tr><th>Versión</th><th>Game</th><th>Tamaño</th><th>Bucket</th><th>Estado</th><th>DL</th><th>Link</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            <tr v-for="v in versions" :key="v.version">
              <td><strong>{{ v.version }}</strong></td>
              <td class="text-muted">{{ v.gameVersion || '-' }}</td>
              <td class="text-muted">{{ formatSize(v.fileSize) }}</td>
              <td>
                <span :class="['badge', v.storageBucket === 'public' ? 'badge-blue' : 'badge-red']">
                  {{ v.storageBucket === 'public' ? '🌍' : '🔒' }}
                </span>
              </td>
              <td>
                <span :class="['badge', v.published ? 'badge-green' : 'badge-yellow']">{{ v.published ? '✅' : '⏳' }}</span>
              </td>
              <td>{{ v.downloadCount || 0 }}</td>
              <td>
                <button class="btn btn-xs btn-ghost" @click="copyCDNUrl(v)" title="Copiar link">📋</button>
              </td>
              <td>
                <div class="flex gap-1">
                  <button class="btn btn-xs" @click="toggleVersionPublish(v)" :title="v.published ? 'Retirar' : 'Publicar'">
                    {{ v.published ? '📥' : '📦' }}
                  </button>
                  <button class="btn btn-xs btn-danger" @click="removeVersion(v)" title="Eliminar">🗑️</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { usePluginsStore } from '@/stores/plugins';
import { useToast } from '@/stores/toast';

const route = useRoute();
const store = usePluginsStore();
const toast = useToast();

const plugin = ref(null);
const versions = ref([]);
const loading = ref(true);
const showNewVersion = ref(false);
const uploading = ref(false);
const selectedFile = ref(null);
const latestUrl = ref('');

const newVer = ref({
  version: '', gameVersion: '', changelog: '',
  storageBucket: 'private', fileName: '',
  fileSize: 0, contentType: 'application/java-archive',
  published: false,
});

onMounted(load);

async function load() {
  loading.value = true;
  try {
    const data = await store.getBySlug(route.params.slug);
    plugin.value = data.plugin;
    versions.value = data.versions || [];
    if (versions.value.length) {
      const cdn = await store.getCDNUrl(plugin.value.slug, versions.value[0].version);
      latestUrl.value = cdn.url;
    }
  } catch (e) {
    toast.show(e.message, 'error');
  } finally {
    loading.value = false;
  }
}

function onFileChange(e) {
  const f = e.target.files?.[0];
  if (!f) return;
  selectedFile.value = f;
  newVer.value.fileName = f.name;
  newVer.value.fileSize = f.size;
  newVer.value.contentType = f.type || 'application/java-archive';
}

function onDrop(e) {
  const f = e.dataTransfer?.files?.[0];
  if (f) { selectedFile.value = f; newVer.value.fileName = f.name; newVer.value.fileSize = f.size; newVer.value.contentType = f.type || 'application/java-archive'; }
}

async function uploadVersion() {
  if (!newVer.value.version || !selectedFile.value) {
    toast.show('Versión y archivo requeridos', 'error'); return;
  }
  uploading.value = true;
  try {
    const upload = await store.requestUploadUrl({
      fileName: newVer.value.fileName, contentType: newVer.value.contentType,
      size: newVer.value.fileSize, bucket: newVer.value.storageBucket,
      context: 'plugin-jar', pluginSlug: plugin.value.slug, version: newVer.value.version,
    });
    await fetch(upload.uploadUrl, { method: 'PUT', body: selectedFile.value, headers: { 'Content-Type': newVer.value.contentType } });
    await store.createVersion({
      slug: plugin.value.slug, version: newVer.value.version, changelog: newVer.value.changelog || '',
      gameVersion: newVer.value.gameVersion || '', fileName: newVer.value.fileName,
      fileSize: newVer.value.fileSize, contentType: newVer.value.contentType,
      storageBucket: newVer.value.storageBucket, storageKey: upload.storageKey,
      published: newVer.value.published,
    });
    toast.show('✅ Versión subida', 'success');
    showNewVersion.value = false;
    selectedFile.value = null;
    newVer.value = { version: '', gameVersion: '', changelog: '', storageBucket: 'private', fileName: '', fileSize: 0, contentType: 'application/java-archive', published: false };
    const data = await store.getBySlug(route.params.slug);
    plugin.value = data.plugin;
    versions.value = data.versions || [];
  } catch (e) { toast.show(e.message || 'Error', 'error'); } finally { uploading.value = false; }
}

async function togglePublish() {
  try {
    await store.patch(plugin.value.slug, { published: !plugin.value.published });
    plugin.value.published = !plugin.value.published;
    toast.show(plugin.value.published ? '✅ Publicado' : '⏳ Retirado', 'success');
  } catch (e) { toast.show(e.message, 'error'); }
}

async function toggleVersionPublish(v) {
  try {
    const u = await store.patchVersion(plugin.value.slug, v.version, { published: !v.published });
    v.published = u.published;
    toast.show(v.published ? '✅ Publicado' : '⏳ Retirado', 'success');
  } catch (e) { toast.show(e.message, 'error'); }
}

async function removeVersion(v) {
  if (!confirm(`Eliminar versión ${v.version}?`)) return;
  try {
    await store.deleteVersion(plugin.value.slug, v.version);
    versions.value = versions.value.filter(x => x.version !== v.version);
    toast.show('🗑️ Eliminada', 'success');
  } catch (e) { toast.show(e.message, 'error'); }
}

async function copyCDNUrl(v) {
  try {
    const data = await store.getCDNUrl(plugin.value.slug, v.version);
    await navigator.clipboard.writeText(data.url);
    toast.show('✅ Link copiado', 'success');
  } catch (e) { toast.show(e.message, 'error'); }
}

async function copyLatestUrl() {
  if (latestUrl.value) {
    try { await navigator.clipboard.writeText(latestUrl.value); toast.show('✅ Link copiado', 'success'); } catch { toast.show('Error', 'error'); }
  }
}

async function copyAllVersions() {
  try {
    const urls = [];
    for (const v of versions.value) {
      const data = await store.getCDNUrl(plugin.value.slug, v.version);
      urls.push(`${v.version}: ${data.url}`);
    }
    await navigator.clipboard.writeText(urls.join('\n'));
    toast.show(`✅ ${urls.length} links copiados`, 'success');
  } catch (e) { toast.show(e.message, 'error'); }
}

function formatSize(bytes) {
  if (!bytes) return '-';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const sizes = ['B','KB','MB','GB'];
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
}
</script>
