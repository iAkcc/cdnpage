<template>
  <div>
    <div class="page-header">
      <h1>🌐 CDN Links</h1>
      <p>Genera URLs de descarga para compartir tus archivos</p>
    </div>

    <div class="grid-2 mb-3">
      <div class="card">
        <h3 class="mb-2">🔗 Generar link de descarga</h3>
        <div class="mb-2">
          <label>Proyecto / Plugin</label>
          <select v-model="selectedSlug">
            <option value="">Seleccionar...</option>
            <option v-for="p in store.plugins" :key="p.slug" :value="p.slug">{{ p.name }} ({{ p.slug }})</option>
          </select>
        </div>
        <div class="mb-2">
          <label>Versión <span class="text-muted">(opcional, última si se deja vacío)</span></label>
          <div class="flex gap-2">
            <input v-model="selectedVersion" placeholder="ej: 1.0.0" />
            <button class="btn btn-sm" @click="selectedVersion=''">×</button>
          </div>
        </div>
        <div class="mb-2">
          <label>Tipo de link</label>
          <select v-model="linkType">
            <option value="download">📥 Descarga directa</option>
            <option value="manifest">📋 Manifest JSON</option>
          </select>
        </div>
        <button class="btn btn-primary w-full" @click="generate" :disabled="!selectedSlug && linkType!=='manifest'">
          🔗 Generar link
        </button>
      </div>

      <div>
        <div v-if="generatedUrl" class="card card-accent">
          <h3 class="mb-2">✅ Link generado</h3>
          <div class="mb-2">
            <label>URL</label>
            <div class="url-input-group">
              <input :value="generatedUrl" readonly @click="$event.target.select()" />
              <button class="btn btn-sm btn-primary" @click="copyLink">📋</button>
            </div>
          </div>
          <div v-if="fileInfo" class="grid-2 text-sm mb-2">
            <div><label>Archivo</label><span class="text-muted">{{ fileInfo.fileName }}</span></div>
            <div><label>Versión</label><span class="text-muted">{{ fileInfo.version }}</span></div>
          </div>
          <div class="badge badge-blue" v-if="!isSigned">🌍 Link público</div>
          <div class="badge badge-yellow" v-else>🔒 Link firmado (expira 15 min)</div>
        </div>

        <div v-if="manifest" class="card mt-2">
          <div class="flex-between mb-1">
            <h3>📋 Manifest público</h3>
            <button class="btn btn-sm btn-ghost" @click="copyManifest">📋 Copiar JSON</button>
          </div>
          <pre>{{ manifestText }}</pre>
          <button class="btn btn-sm mt-2" @click="rebuild">🔄 Reconstruir manifest</button>
        </div>
      </div>
    </div>

    <div class="card">
      <h3 class="mb-2">📖 Cómo usar los links CDN</h3>
      <div class="grid-3 text-sm" style="color:var(--text-secondary)">
        <div>
          <strong>🌍 Links públicos</strong>
          <p class="mt-1">Ideales para imágenes, thumbnails, configs. Cualquiera con el link puede descargar.</p>
        </div>
        <div>
          <strong>🔒 Links firmados</strong>
          <p class="mt-1">Para JARs privados. El link expira después de 15 minutos. Ideal para distribuir a usuarios autorizados.</p>
        </div>
        <div>
          <strong>📋 Manifest JSON</strong>
          <p class="mt-1">Lista completa de todos los plugins publicados con sus versiones. Útil para launchers y actualizadores automáticos.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { usePluginsStore } from '@/stores/plugins';
import { useToast } from '@/stores/toast';

const store = usePluginsStore();
const toast = useToast();

const selectedSlug = ref('');
const selectedVersion = ref('');
const linkType = ref('download');
const generatedUrl = ref('');
const fileInfo = ref(null);
const isSigned = ref(false);
const manifest = ref(null);
const manifestText = ref('');

onMounted(async () => {
  await store.fetchAll();
  try {
    const data = await store.getStats();
    manifest.value = data.manifest;
    manifestText.value = JSON.stringify(data.manifest, null, 2);
  } catch {}
});

async function generate() {
  generatedUrl.value = '';
  fileInfo.value = null;

  if (linkType.value === 'manifest') {
    try {
      const data = await store.getStats();
      manifest.value = data.manifest;
      manifestText.value = JSON.stringify(data.manifest, null, 2);
      const blob = new Blob([manifestText.value], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      generatedUrl.value = url;
      isSigned.value = false;
      toast.show('✅ Manifest generado', 'success');
    } catch (e) { toast.show(e.message, 'error'); }
    return;
  }

  if (!selectedSlug.value) return;
  try {
    const data = await store.getCDNUrl(selectedSlug.value, selectedVersion.value || undefined);
    generatedUrl.value = data.url;
    fileInfo.value = data;
    isSigned.value = data.url?.includes('X-Amz-Expires') || false;
  } catch (e) {
    toast.show(e.message, 'error');
  }
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(generatedUrl.value);
    toast.show('✅ Link copiado', 'success');
  } catch { toast.show('Error al copiar', 'error'); }
}

async function copyManifest() {
  try {
    await navigator.clipboard.writeText(manifestText.value);
    toast.show('✅ JSON copiado', 'success');
  } catch { toast.show('Error', 'error'); }
}

async function rebuild() {
  try {
    const res = await store.rebuildManifest();
    manifest.value = res.manifest;
    manifestText.value = JSON.stringify(res.manifest, null, 2);
    toast.show('✅ Manifest reconstruido', 'success');
  } catch (e) { toast.show(e.message, 'error'); }
}
</script>
