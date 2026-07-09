<template>
  <div>
    <div class="page-header">
      <h1>📊 Dashboard</h1>
      <p>Resumen de tu almacenamiento CDN</p>
    </div>

    <div v-if="loading" class="grid-4 mb-3">
      <div v-for="n in 4" :key="n" class="card stat-card"><div class="skeleton" style="height:60px"></div></div>
    </div>
    <div v-else class="grid-4 mb-3">
      <div class="card stat-card">
        <div class="stat-icon">📦</div>
        <div class="stat-value" style="color: var(--accent-light)">{{ stats?.totalPlugins || 0 }}</div>
        <div class="stat-label">Total proyectos</div>
      </div>
      <div class="card stat-card">
        <div class="stat-icon">✅</div>
        <div class="stat-value" style="color: var(--success)">{{ stats?.publishedPlugins || 0 }}</div>
        <div class="stat-label">Publicados</div>
      </div>
      <div class="card stat-card">
        <div class="stat-icon">📋</div>
        <div class="stat-value" style="color: var(--warning)">{{ stats?.totalVersions || 0 }}</div>
        <div class="stat-label">Versiones</div>
      </div>
      <div class="card stat-card">
        <div class="stat-icon">🔒</div>
        <div class="stat-value" style="color: var(--info)">{{ privateCount }}</div>
        <div class="stat-label">Archivos privados</div>
      </div>
    </div>

    <div class="grid-2 mb-3">
      <div class="card">
        <div class="flex-between mb-2">
          <h3>📦 Últimos proyectos</h3>
          <router-link to="/plugins" class="btn btn-sm btn-ghost">Ver todos →</router-link>
        </div>
        <div v-if="!stats?.plugins?.length" class="empty-state" style="padding:1.5rem 0">
          <div class="empty-icon">📂</div>
          <h3>Sin proyectos</h3>
          <p class="text-sm">Crea tu primer proyecto</p>
        </div>
        <div v-for="p in recentPlugins" :key="p.slug" @click="$router.push('/plugins/'+p.slug)" class="flex-between" style="padding:.5rem 0;border-bottom:1px solid var(--border);cursor:pointer">
          <div>
            <div class="font-bold text-sm">{{ p.name }}</div>
            <div class="text-xs text-muted">{{ p.slug }}</div>
          </div>
          <div class="flex gap-1">
            <span :class="['badge', p.published ? 'badge-green' : 'badge-yellow']">{{ p.published ? 'Publicado' : 'Borrador' }}</span>
            <span class="badge badge-purple">v{{ p.latestVersion || '-' }}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="flex-between mb-2">
          <h3>🌐 Links CDN rápidos</h3>
          <router-link to="/cdn" class="btn btn-sm btn-ghost">Generar →</router-link>
        </div>
        <div style="margin-bottom:.75rem">
          <label>Buscar plugin</label>
          <select v-model="quickSlug" class="mb-1" style="margin-bottom:.5rem">
            <option value="">Seleccionar...</option>
            <option v-for="p in stats?.plugins || []" :key="p.slug" :value="p.slug">{{ p.name }}</option>
          </select>
        </div>
        <div v-if="quickSlug" class="url-input-group">
          <input :value="quickUrl || 'Cargando...'" readonly />
          <button class="btn btn-sm btn-primary" @click="copyQuickUrl">📋</button>
        </div>
        <div v-if="expiresNote" class="text-xs text-muted mt-1">{{ expiresNote }}</div>
      </div>
    </div>

    <div class="card">
      <div class="flex-between mb-2">
        <h3>⚡ Acciones rápidas</h3>
      </div>
      <div class="flex gap-2 flex-wrap">
        <router-link to="/upload" class="btn btn-primary">⬆️ Subir archivo</router-link>
        <router-link to="/plugins/new" class="btn">➕ Nuevo proyecto</router-link>
        <router-link to="/cdn" class="btn btn-ghost">🌐 Generar link CDN</router-link>
        <button class="btn btn-ghost" @click="rebuild">🔄 Reconstruir manifest</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { usePluginsStore } from '@/stores/plugins';
import { useToast } from '@/stores/toast';

const store = usePluginsStore();
const toast = useToast();
const stats = ref(null);
const loading = ref(true);
const quickSlug = ref('');
const quickUrl = ref('');
const expiresNote = ref('');

onMounted(refresh);

async function refresh() {
  loading.value = true;
  try {
    stats.value = await store.getStats();
    await store.fetchAll();
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

const privateCount = computed(() => (stats.value?.plugins || []).filter(p => p.visibility === 'private').length);
const recentPlugins = computed(() => (stats.value?.plugins || []).slice(0, 5));

watch(quickSlug, async (slug) => {
  if (!slug) { quickUrl.value = ''; return; }
  try {
    const data = await store.getCDNUrl(slug);
    quickUrl.value = data.url;
    expiresNote.value = data.url?.includes('X-Amz-Expires') ? '🔒 Link firmado expira en 15 min' : '🌍 Link público permanente';
  } catch { quickUrl.value = 'Error al generar'; }
});

async function copyQuickUrl() {
  if (!quickUrl.value) return;
  try {
    await navigator.clipboard.writeText(quickUrl.value);
    toast.show('✅ Link copiado', 'success');
  } catch { toast.show('Error', 'error'); }
}

async function rebuild() {
  try {
    await store.rebuildManifest();
    toast.show('✅ Manifest reconstruido', 'success');
  } catch (e) { toast.show(e.message, 'error'); }
}
</script>
