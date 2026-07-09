<template>
  <div>
    <div class="page-header">
      <h1>⬆️ Subir Archivo</h1>
      <p>Sube JARs, imágenes, configs y cualquier archivo a tu CDN</p>
    </div>

    <div class="grid-2">
      <div>
        <div class="card mb-2">
          <h3 class="mb-2">Archivo</h3>

          <div class="drop-zone mb-2" @drop.prevent="onDrop" @dragover.prevent="dragover=true" @dragleave="dragover=false" :class="{dragover}" @click="$refs.fileInput.click()">
            <div class="drop-icon">📁</div>
            <p v-if="!file">Arrastra un archivo aquí o haz clic para seleccionar</p>
            <p v-else><strong>{{ file.name }}</strong> ({{ formatSize(file.size) }})</p>
            <input ref="fileInput" type="file" style="display:none" @change="onFileChange" />
          </div>

          <div class="grid-2 mb-2">
            <div>
              <label>Nombre del archivo</label>
              <input v-model="fileName" placeholder="archivo.jar" />
            </div>
            <div>
              <label>Tipo de contenido</label>
              <select v-model="contentType">
                <option value="application/java-archive">JAR</option>
                <option value="application/zip">ZIP</option>
                <option value="image/png">PNG</option>
                <option value="image/jpeg">JPEG</option>
                <option value="text/plain">TXT</option>
                <option value="application/json">JSON</option>
                <option value="application/octet-stream">Otro</option>
              </select>
            </div>
          </div>

          <div class="grid-2 mb-2">
            <div>
              <label>Categoría</label>
              <select v-model="context">
                <option value="plugin-jar">Plugin JAR</option>
                <option value="thumbnail">Imagen / Thumbnail</option>
                <option value="config">Configuración</option>
                <option value="bot">Bot Discord</option>
                <option value="asset">Asset genérico</option>
                <option value="other">Otro</option>
              </select>
            </div>
            <div>
              <label>Visibilidad</label>
              <select v-model="bucket">
                <option value="private">🔒 Privado (solo con link firmado)</option>
                <option value="public">🌍 Público (cualquiera puede descargar)</option>
              </select>
            </div>
          </div>

          <div class="grid-2 mb-2" v-if="context === 'plugin-jar'">
            <div>
              <label>Plugin (slug)</label>
              <input v-model="pluginSlug" list="pluginSuggest" placeholder="ej: mi-plugin" />
              <datalist id="pluginSuggest">
                <option v-for="p in store.plugins" :key="p.slug" :value="p.slug">{{ p.name }}</option>
              </datalist>
            </div>
            <div>
              <label>Versión</label>
              <input v-model="version" placeholder="1.0.0" />
            </div>
          </div>
          <div v-else class="mb-2">
            <label>Nombre del proyecto (opcional)</label>
            <input v-model="projectName" placeholder="mi-proyecto" />
          </div>
        </div>

        <button class="btn btn-primary w-full" @click="upload" :disabled="uploading || !file">
          {{ uploading ? '⏳ Subiendo...' : '⬆️ Subir a CDN' }}
        </button>
      </div>

      <div>
        <div v-if="result" class="card card-accent">
          <h3 class="mb-2">✅ Archivo subido</h3>
          <div class="mb-2">
            <label>URL de descarga</label>
            <div class="url-input-group">
              <input :value="downloadUrl" readonly @click="$event.target.select()" />
              <button class="btn btn-sm btn-primary" @click="copyText(downloadUrl)">📋 Copiar</button>
            </div>
          </div>
          <div class="grid-2 mb-2">
            <div><label>Storage Key</label><div class="text-xs text-muted truncate">{{ result.storageKey }}</div></div>
            <div><label>Bucket</label><div class="text-sm">{{ result.storageBucket }}</div></div>
            <div><label>Tamaño</label><div class="text-sm">{{ formatSize(file.size) }}</div></div>
            <div><label>Tipo</label><div class="text-sm">{{ contentType }}</div></div>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-sm btn-success" @click="copyText(downloadUrl)">📋 Copiar link</button>
            <button class="btn btn-sm" @click="reset">⬆️ Subir otro</button>
          </div>
        </div>

        <div v-else class="card">
          <h3 class="mb-2">📋 Tips</h3>
          <ul style="color:var(--text-secondary);font-size:.85rem;line-height:2;list-style:none;padding:0">
            <li>📦 <strong>JARs</strong> — Sube tus plugins compilados</li>
            <li>🖼️ <strong>Imágenes</strong> — Thumbnails, screenshots, iconos</li>
            <li>⚙️ <strong>Configs</strong> — Archivos YAML, JSON, TOML</li>
            <li>🤖 <strong>Bots</strong> — Scripts y archivos de bots</li>
            <li>🔗 El link CDN se genera automáticamente</li>
            <li>🔒 Archivos privados requieren URL firmada</li>
          </ul>
        </div>

        <div v-if="uploading" class="card mt-2">
          <label>Subiendo...</label>
          <div class="progress-bar mt-1"><div class="progress-bar-fill" style="width:100%"></div></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { usePluginsStore } from '@/stores/plugins';
import { useToast } from '@/stores/toast';

const store = usePluginsStore();
const toast = useToast();

const file = ref(null);
const fileName = ref('');
const contentType = ref('application/java-archive');
const context = ref('plugin-jar');
const bucket = ref('private');
const pluginSlug = ref('');
const version = ref('');
const projectName = ref('');
const uploading = ref(false);
const result = ref(null);
const dragover = ref(false);

function onFileChange(e) {
  const f = e.target.files?.[0];
  if (!f) return;
  file.value = f;
  fileName.value = f.name;
  contentType.value = f.type || 'application/octet-stream';
  result.value = null;
}

function readFileAsBase64(f) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(f);
  });
}

function onDrop(e) {
  dragover.value = false;
  const f = e.dataTransfer?.files?.[0];
  if (!f) return;
  file.value = f;
  fileName.value = f.name;
  contentType.value = f.type || 'application/octet-stream';
  result.value = null;
}

async function upload() {
  if (!file.value) { toast.show('Selecciona un archivo', 'error'); return; }
  uploading.value = true;
  result.value = null;
  try {
    const slug = pluginSlug.value || projectName.value || 'general';
    const ver = version.value || '1.0.0';

    // Leer archivo como base64
    const base64 = await readFileAsBase64(file.value);

    // Subir archivo directo a la API (que lo reenvía a Backblaze)
    const upload = await store.requestUploadUrl({
      fileName: fileName.value,
      contentType: contentType.value,
      size: file.value.size,
      bucket: bucket.value,
      context: context.value,
      pluginSlug: slug,
      version: ver,
      file: base64,
    });

    // Si es plugin, registrar versión
    if (context.value === 'plugin-jar') {
      try {
        await store.createVersion({
          slug,
          version: ver,
          changelog: '',
          gameVersion: '',
          fileName: fileName.value,
          fileSize: upload.fileSize || file.value.size,
          contentType: contentType.value,
          storageBucket: bucket.value,
          storageKey: upload.storageKey,
          published: false,
        });
      } catch (e) { console.error('version create:', e); }
    }

    result.value = upload;
    downloadUrl.value = upload.downloadUrl || `🔒 Link firmado — usa "Copiar link" en la lista de archivos`;

    toast.show('✅ Archivo subido exitosamente', 'success');
  } catch (e) {
    toast.show(e.message || 'Error al subir', 'error');
  } finally {
    uploading.value = false;
  }
}

const downloadUrl = ref('');

async function copyText(t) {
  try {
    await navigator.clipboard.writeText(t);
    toast.show('✅ Copiado', 'success');
  } catch { toast.show('Error al copiar', 'error'); }
}

function reset() {
  file.value = null;
  fileName.value = '';
  result.value = null;
  downloadUrl.value = '';
}

function formatSize(bytes) {
  if (!bytes) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const sizes = ['B','KB','MB','GB'];
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
}
</script>
