<template>
  <div>
    <div class="flex-between mb-2">
      <h1>Plugins</h1>
      <router-link to="/plugins/new" class="btn btn-primary">+ Nuevo</router-link>
    </div>
    <div v-if="store.loading" style="color: var(--text-muted);">Cargando...</div>
    <div v-else>
      <table>
        <thead>
          <tr><th>Nombre</th><th>Slug</th><th>Estado</th><th>Visibilidad</th><th>Versión</th></tr>
        </thead>
        <tbody>
          <tr v-for="p in store.plugins" :key="p.slug" @click="$router.push('/plugins/'+p.slug)" style="cursor:pointer">
            <td>{{ p.name }}</td>
            <td style="color: var(--text-muted)">{{ p.slug }}</td>
            <td>
              <span v-if="p.published" class="badge badge-green">Publicado</span>
              <span v-else class="badge badge-yellow">Borrador</span>
            </td>
            <td>
              <span v-if="p.visibility === 'public'" class="badge badge-blue">Público</span>
              <span v-else class="badge badge-red">Privado</span>
            </td>
            <td>{{ p.latestVersion || '-' }}</td>
          </tr>
        </tbody>
      </table>
      <div v-if="!store.plugins.length" style="color: var(--text-muted); margin-top: 1rem;">No hay plugins.</div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { usePluginsStore } from '@/stores/plugins';

const store = usePluginsStore();
onMounted(() => store.fetchAll());
</script>
