<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <div class="sidebar-logo">CDN</div>
      <h2>Admin Panel</h2>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-section-title">General</div>
      <nav>
        <router-link to="/">
          <span>📊</span><span>Dashboard</span>
        </router-link>
        <router-link to="/files">
          <span>📦</span><span>Mis Archivos</span>
        </router-link>
        <router-link to="/upload">
          <span>⬆️</span><span>Subir Archivo</span>
        </router-link>
      </nav>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-section-title">Plugins</div>
      <nav>
        <router-link to="/plugins">
          <span>🔌</span><span>Plugins</span>
        </router-link>
        <router-link to="/plugins/new">
          <span>➕</span><span>Nuevo Plugin</span>
        </router-link>
      </nav>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-section-title">Distribución</div>
      <nav>
        <router-link to="/cdn">
          <span>🌐</span><span>CDN Links</span>
        </router-link>
      </nav>
    </div>
    <div class="sidebar-section" v-if="auth.isAdmin">
      <div class="sidebar-section-title">Admin</div>
      <nav>
        <router-link to="/users">
          <span>👥</span><span>Usuarios</span>
        </router-link>
      </nav>
    </div>
    <div class="sidebar-footer">
      <div class="flex gap-1 mb-1" style="font-size: .8rem; color: var(--text-secondary);">
        <span class="truncate" style="max-width:160px">{{ auth.user?.email }}</span>
        <span class="badge badge-purple">{{ auth.user?.role }}</span>
      </div>
      <button class="btn btn-sm btn-ghost w-full" @click="logout">🚪 Cerrar sesión</button>
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
