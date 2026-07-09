<template>
  <div>
    <div class="flex-between mb-2">
      <h1>Dashboard</h1>
      <button class="btn btn-sm btn-primary" @click="refresh">Actualizar</button>
    </div>
    <div v-if="loading" style="color: var(--text-muted);">Cargando...</div>
    <div v-else>
      <div class="grid-3 mb-2">
        <div class="card">
          <div style="font-size: 2rem; font-weight: 700;">{{ stats?.totalPlugins || 0 }}</div>
          <div style="color: var(--text-muted); font-size: .85rem;">Total plugins</div>
        </div>
        <div class="card">
          <div style="font-size: 2rem; font-weight: 700;">{{ stats?.publishedPlugins || 0 }}</div>
          <div style="color: var(--text-muted); font-size: .85rem;">Publicados</div>
        </div>
        <div class="card">
          <div style="font-size: 2rem; font-weight: 700;">{{ stats?.totalVersions || 0 }}</div>
          <div style="color: var(--text-muted); font-size: .85rem;">Versiones</div>
        </div>
      </div>

      <h2 class="mb-1">Últimos plugins</h2>
      <table>
        <thead>
          <tr><th>Plugin</th><th>Slug</th><th>Estado</th><th>Versiones</th></tr>
        </thead>
        <tbody>
          <tr v-for="p in recentPlugins" :key="p.slug" @click="$router.push('/plugins/'+p.slug)" style="cursor:pointer">
            <td>{{ p.name }}</td>
            <td style="color: var(--text-muted)">{{ p.slug }}</td>
            <td>
              <span v-if="p.published" class="badge badge-green">Publicado</span>
              <span v-else class="badge badge-yellow">Borrador</span>
            </td>
            <td>{{ p.versions || 0 }}</td>
          </tr>
        </tbody>
      </table>
      <div v-if="!stats?.plugins?.length" style="color: var(--text-muted); margin-top: 1rem;">No hay plugins aún.</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { usePluginsStore } from '@/stores/plugins';

const store = usePluginsStore();
const stats = ref(null);
const loading = ref(true);

onMounted(refresh);
async function refresh() {
  loading.value = true;
  try {
    stats.value = await store.getStats();
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

const recentPlugins = computed(() => {
  if (!stats.value?.plugins) return [];
  return stats.value.plugins.slice(0, 10);
});
</script>
