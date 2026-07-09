<template>
  <div>
    <h1 class="mb-2">CDN & Distribución</h1>
    <div class="card mb-2">
      <h3 class="mb-1">Manifest público</h3>
      <p style="color: var(--text-muted); font-size: .85rem; margin-bottom: .5rem;">
        El manifest lista todos los plugins publicados con sus versiones. Es útil para launcher/actualizadores.
      </p>
      <div class="flex gap-2">
        <button class="btn btn-sm btn-primary" @click="rebuild">Reconstruir manifest</button>
        <button class="btn btn-sm" @click="viewManifest">{{ showManifest ? 'Ocultar' : 'Ver manifest' }}</button>
      </div>
      <pre v-if="showManifest" class="mt-2">{{ manifestText }}</pre>
    </div>

    <div class="card mb-2">
      <h3 class="mb-1">URLs de descarga directa</h3>
      <p style="color: var(--text-muted); font-size: .85rem; margin-bottom: .5rem;">
        Busca un plugin y copia la URL de descarga (firmada para archivos privados, pública para públicos).
      </p>
      <div class="grid-2 mb-2">
        <div>
          <label>Plugin</label>
          <select v-model="selectedSlug">
            <option value="">Seleccionar...</option>
            <option v-for="p in store.plugins" :key="p.slug" :value="p.slug">{{ p.name }}</option>
          </select>
        </div>
        <div>
          <label>Versión (opcional, última si vacío)</label>
          <input v-model="selectedVersion" placeholder="ej: 1.0.0" />
        </div>
      </div>
      <button class="btn btn-sm btn-primary" @click="getURL" :disabled="!selectedSlug">Generar URL</button>
      <div v-if="cdnUrl" class="mt-2">
        <label>URL de descarga</label>
        <div style="display: flex; gap: .5rem;">
          <input :value="cdnUrl" readonly @click="$event.target.select()" />
          <button class="btn btn-sm" @click="copyURL">Copiar</button>
        </div>
        <p v-if="cdnFileName" style="color: var(--text-muted); font-size: .85rem; margin-top: .25rem;">
          Archivo: {{ cdnFileName }} (v{{ cdnVersion }})
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { usePluginsStore } from '@/stores/plugins';
import { useToast } from '@/stores/toast';

const store = usePluginsStore();
const toast = useToast();

const showManifest = ref(false);
const manifestText = ref('');
const selectedSlug = ref('');
const selectedVersion = ref('');
const cdnUrl = ref('');
const cdnFileName = ref('');
const cdnVersion = ref('');

onMounted(() => store.fetchAll());

async function rebuild() {
  try {
    const res = await store.rebuildManifest();
    toast.show('Manifest reconstruido', 'success');
  } catch (e) {
    toast.show(e.message, 'error');
  }
}

async function viewManifest() {
  if (showManifest.value) {
    showManifest.value = false;
    return;
  }
  try {
    const data = await store.getStats();
    manifestText.value = JSON.stringify(data.manifest || {}, null, 2);
    showManifest.value = true;
  } catch (e) {
    toast.show(e.message, 'error');
  }
}

async function getURL() {
  if (!selectedSlug.value) return;
  try {
    const data = await store.getCDNUrl(selectedSlug.value, selectedVersion.value || undefined);
    cdnUrl.value = data.url;
    cdnFileName.value = data.fileName;
    cdnVersion.value = data.version;
  } catch (e) {
    toast.show(e.message, 'error');
  }
}

async function copyURL() {
  try {
    await navigator.clipboard.writeText(cdnUrl.value);
    toast.show('URL copiada', 'success');
  } catch (e) {
    toast.show('Error al copiar', 'error');
  }
}
</script>
