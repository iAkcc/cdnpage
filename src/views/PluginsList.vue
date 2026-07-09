<template>
  <div>
    <div class="page-header">
      <div class="flex-between flex-wrap gap-2">
        <div>
          <h1>🔌 Plugins</h1>
          <p>Gestiona tus plugins y proyectos</p>
        </div>
        <router-link to="/plugins/new" class="btn btn-primary">➕ Nuevo plugin</router-link>
      </div>
    </div>

    <div v-if="store.loading" class="grid-3">
      <div v-for="n in 6" :key="n" class="card"><div class="skeleton" style="height:80px"></div></div>
    </div>
    <div v-else>
      <div class="card" style="padding:0;overflow:hidden" v-if="store.plugins.length">
        <table>
          <thead>
            <tr><th>Nombre</th><th>Slug</th><th>Estado</th><th>Visibilidad</th><th>Versión</th><th>Categoría</th></tr>
          </thead>
          <tbody>
            <tr v-for="p in store.plugins" :key="p.slug" @click="$router.push('/plugins/'+p.slug)">
              <td><strong>{{ p.name }}</strong></td>
              <td class="text-muted">{{ p.slug }}</td>
              <td>
                <span :class="['badge', p.published ? 'badge-green' : 'badge-yellow']">
                  {{ p.published ? '✅ Publicado' : '⏳ Borrador' }}
                </span>
              </td>
              <td>
                <span :class="['badge', p.visibility === 'public' ? 'badge-blue' : 'badge-red']">
                  {{ p.visibility === 'public' ? '🌍 Público' : '🔒 Privado' }}
                </span>
              </td>
              <td class="font-bold">v{{ p.latestVersion || '-' }}</td>
              <td class="text-muted">{{ p.category || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="card">
        <div class="empty-state">
          <div class="empty-icon">🔌</div>
          <h3>No hay plugins</h3>
          <p class="mb-2">Crea tu primer plugin</p>
          <router-link to="/plugins/new" class="btn btn-primary">➕ Crear plugin</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { usePluginsStore } from '@/stores/plugins';

const store = usePluginsStore();
onMounted(() => store.fetchAll());
</script>
