<template>
  <div v-if="loading">Cargando...</div>
  <div v-else-if="!plugin">
    <p style="color: var(--text-muted);">Plugin no encontrado.</p>
    <router-link to="/plugins" class="btn">Volver</router-link>
  </div>
  <div v-else>
    <div class="flex-between mb-2">
      <div>
        <h1>{{ plugin.name }}</h1>
        <p style="color: var(--text-muted); font-size: .85rem;">{{ plugin.slug }} · {{ plugin.category || 'Sin categoría' }}</p>
      </div>
      <div class="flex gap-1">
        <span v-if="plugin.published" class="badge badge-green">Publicado</span>
        <span v-else class="badge badge-yellow">Borrador</span>
        <router-link :to="'/plugins/'+plugin.slug+'/edit'" class="btn btn-sm">Editar</router-link>
        <button class="btn btn-sm btn-danger" @click="togglePublish">
          {{ plugin.published ? 'Retirar' : 'Publicar' }}
        </button>
      </div>
    </div>

    <div class="card mb-2">
      <p>{{ plugin.description || 'Sin descripción' }}</p>
      <div class="flex gap-2 mt-2" style="font-size: .85rem; color: var(--text-muted);">
        <span v-if="plugin.author">Autor: {{ plugin.author }}</span>
        <span v-if="plugin.homepage"><a :href="plugin.homepage" target="_blank">Web</a></span>
        <span>Visibilidad: {{ plugin.visibility }}</span>
      </div>
      <div class="mt-1 flex gap-1" v-if="plugin.tags?.length">
        <span v-for="t in plugin.tags" :key="t" class="badge badge-blue">{{ t }}</span>
      </div>
    </div>

    <div class="flex-between mb-1">
      <h2>Versiones ({{ versions.length }})</h2>
      <button class="btn btn-sm btn-primary" @click="showNewVersion = !showNewVersion">
        + Nueva versión
      </button>
    </div>

    <div v-if="showNewVersion" class="card mb-2">
      <h3 class="mb-1">Agregar versión</h3>
      <div class="grid-2 mb-2">
        <div>
          <label>Versión</label>
          <input v-model="newVer.version" placeholder="1.0.0" />
        </div>
        <div>
          <label>Game version</label>
          <input v-model="newVer.gameVersion" placeholder="1.20" />
        </div>
      </div>
      <div class="mb-2">
        <label>Archivo (JAR)</label>
        <input type="file" @change="onFileChange" accept=".jar,.zip,.yml,.json" />
        <p v-if="selectedFile" style="color: var(--text-muted); font-size: .85rem; margin-top: .25rem;">
          {{ selectedFile.name }} ({{ formatSize(selectedFile.size) }})
        </p>
      </div>
      <div class="mb-2">
        <label>Changelog</label>
        <textarea v-model="newVer.changelog" rows="3"></textarea>
      </div>
      <div class="mb-2">
        <label>Bucket</label>
        <select v-model="newVer.storageBucket">
          <option value="private">Privado (JAR, configs)</option>
          <option value="public">Público (imágenes, docs)</option>
        </select>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-primary" @click="uploadVersion" :disabled="uploading">
          {{ uploading ? 'Subiendo...' : 'Subir versión' }}
        </button>
        <button class="btn" @click="showNewVersion = false">Cancelar</button>
      </div>
    </div>

    <table v-if="versions.length">
      <thead>
        <tr><th>Versión</th><th>Game</th><th>Tamaño</th><th>Bucket</th><th>Estado</th><th>DL</th><th>Acciones</th></tr>
      </thead>
      <tbody>
        <tr v-for="v in versions" :key="v.version">
          <td><strong>{{ v.version }}</strong></td>
          <td>{{ v.gameVersion || '-' }}</td>
          <td>{{ formatSize(v.fileSize) }}</td>
          <td>
            <span v-if="v.storageBucket === 'private'" class="badge badge-red">Privado</span>
            <span v-else class="badge badge-blue">Público</span>
          </td>
          <td>
            <span v-if="v.published" class="badge badge-green">Publicado</span>
            <span v-else class="badge badge-yellow">Borrador</span>
          </td>
          <td>{{ v.downloadCount || 0 }}</td>
          <td>
            <div class="flex gap-1">
              <button class="btn btn-sm" @click="toggleVersionPublish(v)">Pub</button>
              <button class="btn btn-sm" @click="copyCDNUrl(v)">URL</button>
              <button class="btn btn-sm btn-danger" @click="removeVersion(v)">X</button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else style="color: var(--text-muted); margin-top: 1rem;">Sin versiones.</p>
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
  } catch (e) {
    toast.show(e.message, 'error');
  } finally {
    loading.value = false;
  }
}

function onFileChange(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  selectedFile.value = file;
  newVer.value.fileName = file.name;
  newVer.value.fileSize = file.size;
  newVer.value.contentType = file.type || 'application/java-archive';
}

async function uploadVersion() {
  if (!newVer.value.version || !selectedFile.value) {
    toast.show('Versión y archivo requeridos', 'error');
    return;
  }
  uploading.value = true;
  try {
    // 1. Solicitar URL de subida firmada
    const upload = await store.requestUploadUrl({
      fileName: newVer.value.fileName,
      contentType: newVer.value.contentType,
      size: newVer.value.fileSize,
      bucket: newVer.value.storageBucket,
      context: 'plugin-jar',
      pluginSlug: plugin.value.slug,
      version: newVer.value.version,
    });

    // 2. Subir archivo directamente a R2
    await fetch(upload.uploadUrl, {
      method: 'PUT',
      body: selectedFile.value,
      headers: { 'Content-Type': newVer.value.contentType },
    });

    // 3. Crear registro de versión
    await store.createVersion({
      slug: plugin.value.slug,
      version: newVer.value.version,
      changelog: newVer.value.changelog || '',
      gameVersion: newVer.value.gameVersion || '',
      fileName: newVer.value.fileName,
      fileSize: newVer.value.fileSize,
      contentType: newVer.value.contentType,
      storageBucket: newVer.value.storageBucket,
      storageKey: upload.storageKey,
      published: false,
    });

    toast.show('Versión subida correctamente', 'success');
    showNewVersion.value = false;
    selectedFile.value = null;
    newVer.value = { version: '', gameVersion: '', changelog: '', storageBucket: 'private', fileName: '', fileSize: 0, contentType: 'application/java-archive', published: false };
    // Recargar versiones
    const data = await store.getBySlug(route.params.slug);
    plugin.value = data.plugin;
    versions.value = data.versions || [];
  } catch (e) {
    toast.show(e.message || 'Error al subir', 'error');
  } finally {
    uploading.value = false;
  }
}

async function togglePublish() {
  try {
    await store.patch(plugin.value.slug, { published: !plugin.value.published });
    plugin.value.published = !plugin.value.published;
    toast.show(plugin.value.published ? 'Publicado' : 'Retirado', 'success');
  } catch (e) {
    toast.show(e.message, 'error');
  }
}

async function toggleVersionPublish(v) {
  try {
    const updated = await store.patchVersion(plugin.value.slug, v.version, { published: !v.published });
    v.published = updated.published;
    toast.show(v.published ? 'Versión publicada' : 'Versión retirada', 'success');
  } catch (e) {
    toast.show(e.message, 'error');
  }
}

async function removeVersion(v) {
  if (!confirm(`Eliminar versión ${v.version}?`)) return;
  try {
    await store.deleteVersion(plugin.value.slug, v.version);
    versions.value = versions.value.filter(x => x.version !== v.version);
    toast.show('Versión eliminada', 'success');
  } catch (e) {
    toast.show(e.message, 'error');
  }
}

async function copyCDNUrl(v) {
  try {
    const data = await store.getCDNUrl(plugin.value.slug, v.version);
    await navigator.clipboard.writeText(data.url);
    toast.show('URL copiada al portapapeles', 'success');
  } catch (e) {
    toast.show(e.message, 'error');
  }
}

function formatSize(bytes) {
  if (!bytes) return '-';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const sizes = ['B', 'KB', 'MB', 'GB'];
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
}
</script>
