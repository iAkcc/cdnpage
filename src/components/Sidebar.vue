<template>
  <aside class="sidebar">
    <h2>Panel Plugins</h2>
    <nav>
      <router-link to="/">
        <span>Dashboard</span>
      </router-link>
      <router-link to="/plugins">
        <span>Plugins</span>
      </router-link>
      <router-link to="/plugins/new">
        <span>+ Nuevo Plugin</span>
      </router-link>
      <router-link v-if="auth.isAdmin" to="/users">
        <span>Usuarios</span>
      </router-link>
      <router-link to="/cdn">
        <span>CDN</span>
      </router-link>
    </nav>
    <div style="margin-top: auto; padding-top: 1rem; border-top: 1px solid var(--border);">
      <div style="font-size: .85rem; color: var(--text-muted); margin-bottom: .5rem;">
        {{ auth.user?.email }}
        <span class="badge badge-blue ml-1">{{ auth.user?.role }}</span>
      </div>
      <button class="btn btn-sm" @click="logout">Cerrar sesión</button>
    </div>
  </aside>
</template>

<script setup>
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'vue-router';

const auth = useAuthStore();
const router = useRouter();

async function logout() {
  await auth.logout();
  router.push('/login');
}
</script>
