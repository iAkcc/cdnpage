<template>
  <div>
    <div class="page-header">
      <h1>📦 Mis Archivos</h1>
      <p>Todos los archivos subidos organizados por proyecto</p>
    </div>

    <div class="flex-between mb-3 flex-wrap gap-2">
      <div class="flex gap-2">
        <router-link to="/upload" class="btn btn-primary">⬆️ Subir archivo</router-link>
        <router-link to="/cdn" class="btn btn-ghost">🌐 Generar link CDN</router-link>
      </div>
      <div class="flex gap-2">
        <select v-model="filterBucket" class="btn-sm" style="width:auto">
          <option value="">Todos los buckets</option>
          <option value="private">Privados</option>
          <option value="public">Públicos</option>
        </select>
        <input v-model="search" placeholder="🔍 Buscar archivo..." style="width:200px" />
      </div>
    </div>

    <div v-if="loading" class="grid-3">
      <div v-for="n in 6" :key="n" class="card" style="padding:1rem"><div class="skeleton" style="height:80px"></div></div>
    </div>

    <template v-else>
      <div class="card" v-if="!filteredFiles.length">
        <div class="empty-state">
          <div class="empty-icon">📂</div>
          <h3>No hay archivos</h3>
          <p class="mb-2">Sube tu primer archivo para empezar</p>
          <router-link to="/upload" class="btn btn-primary">⬆️ Subir archivo</router-link>
        </div>
      </div>

      <div v-else class="grid-2">
        <div v-for="f in filteredFiles" :key="f.id || f.key" class="card" @click="openFile(f)" style="cursor:pointer">
          <div class="flex-between mb-1">
            <div class="flex gap-1" style="min-width:0">
              <span style="font-size:1.2rem">{{ fileIcon(f.fileName) }}</span>
              <div style="min-width:0">
                <div class="truncate font-bold">{{ f.fileName }}</div>
                <div class="text-xs text-muted">{{ f.slug }} v{{ f.version }}</div>
              </div>
            </div>
            <span :class="['badge', f.storageBucket === 'public' ? 'badge-blue' : 'badge-red']">
              {{ f.storageBucket === 'public' ? 'Público' : 'Privado' }}
            </span>
          </div>
          <div class="flex gap-2 text-xs text-muted">
            <span>{{ formatSize(f.fileSize) }}</span>
            <span>📥 {{ f.downloadCount || 0 }}</span>
            <span>{{ f.published ? '✅ Publicado' : '⏳ Borrador' }}</span>
          </div>
          <div class="mt-2 flex gap-1" @click.stop>
            <button class="btn btn-xs btn-primary" @click="copyLink(f)">📋 Copiar link</button>
            <button class="btn btn-xs" @click="togglePublish(f)">{{ f.published ? 'Retirar' : 'Publicar' }}</button>
            <button class="btn btn-xs btn-danger" @click="remove(f)">🗑️</button>
          </div>
        </div>
      </div>
    </template>

    <!-- Modal detalle -->
    <div v-if="selectedFile" class="modal-overlay" @click.self="selectedFile=null">
      <div class="modal-content">
        <div class="flex-between mb-2">
          <h3>{{ selectedFile.fileName }}</h3>
          <button class="btn btn-sm btn-ghost" @click="selectedFile=null">✕</button>
        </div>
        <div class="mb-2">
          <label>URL de descarga</label>
          <div class="url-input-group">
            <input :value="downloadUrl" readonly @click="$event.target.select()" />
            <button class="btn btn-sm btn-primary" @click="copyText(downloadUrl)">📋</button>
          </div>
        </div>
        <div class="grid-2 mb-2">
          <div><label>Tamaño</label><div class="text-sm">{{ formatSize(selectedFile.fileSize) }}</div></div>
          <div><label>Bucket</label><div class="text-sm">{{ selectedFile.storageBucket }}</div></div>
          <div><label>Proyecto</label><div class="text-sm">{{ selectedFile.slug }}</div></div>
          <div><label>Versión</label><div class="text-sm">{{ selectedFile.version }}</div></div>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-sm btn-primary" @click="copyText(downloadUrl)">📋 Copiar link CDN</button>
          <button class="btn btn-sm" @click="togglePublish(selectedFile)">{{ selectedFile.published ? 'Retirar' : 'Publicar' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { usePluginsStore } from '@/stores/plugins';
import { useToast } from '@/stores/toast';

const store = usePluginsStore();
const toast = useToast();
const loading = ref(true);
const allFiles = ref([]);
const search = ref('');
const filterBucket = ref('');
const selectedFile = ref(null);
const downloadUrl = ref('');

onMounted(load);

async function load() {
  loading.value = true;
  try {
    const data = await store.getStats();
    const files = [];
    for (const p of data.plugins || []) {
      const versions = await store.listVersions(p.slug);
      for (const v of versions) {
        files.push({ ...v, pluginName: p.name, id: `${p.slug}__${v.version}` });
      }
    }
    allFiles.value = files;
  } catch (e) {
    toast.show(e.message, 'error');
  } finally {
    loading.value = false;
  }
}

const filteredFiles = computed(() => {
  let list = allFiles.value;
  if (filterBucket.value) list = list.filter(f => f.storageBucket === filterBucket.value);
  if (search.value) {
    const q = search.value.toLowerCase();
    list = list.filter(f => f.fileName?.toLowerCase().includes(q) || f.slug?.toLowerCase().includes(q) || f.version?.toLowerCase().includes(q));
  }
  return list;
});

async function openFile(f) {
  selectedFile.value = f;
  try {
    const data = await store.getCDNUrl(f.slug, f.version);
    downloadUrl.value = data.url;
  } catch { downloadUrl.value = 'Error al generar URL'; }
}

async function copyLink(f) {
  try {
    const data = await store.getCDNUrl(f.slug, f.version);
    await navigator.clipboard.writeText(data.url);
    toast.show('✅ Link copiado al portapapeles', 'success');
  } catch (e) {
    toast.show(e.message, 'error');
  }
}

async function copyText(t) {
  try {
    await navigator.clipboard.writeText(t);
    toast.show('✅ Copiado', 'success');
  } catch { toast.show('Error al copiar', 'error'); }
}

async function togglePublish(f) {
  try {
    const updated = await store.patchVersion(f.slug, f.version, { published: !f.published });
    f.published = updated.published;
    toast.show(f.published ? '✅ Publicado' : '⏳ Retirado', 'success');
  } catch (e) {
    toast.show(e.message, 'error');
  }
}

async function remove(f) {
  if (!confirm(`¿Eliminar ${f.fileName} versión ${f.version}?`)) return;
  try {
    await store.deleteVersion(f.slug, f.version);
    allFiles.value = allFiles.value.filter(x => x.id !== f.id);
    toast.show('🗑️ Archivo eliminado', 'success');
  } catch (e) {
    toast.show(e.message, 'error');
  }
}

function fileIcon(name) {
  const ext = (name||'').split('.').pop()?.toLowerCase();
  if (['jar'].includes(ext)) return '📦';
  if (['png','jpg','jpeg','gif','webp','svg'].includes(ext)) return '🖼️';
  if (['yml','yaml','json','toml','xml'].includes(ext)) return '⚙️';
  if (['zip','gz','tar','rar','7z'].includes(ext)) return '🗜️';
  if (['js','ts','py','java','php','rb'].includes(ext)) return '💻';
  if (['pdf','doc','docx','txt'].includes(ext)) return '📄';
  return '📁';
}

function formatSize(bytes) {
  if (!bytes) return '-';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const sizes = ['B','KB','MB','GB'];
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
}
</script>
