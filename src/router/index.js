import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { guest: true },
  },
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/plugins',
    name: 'Plugins',
    component: () => import('@/views/PluginsList.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/plugins/new',
    name: 'PluginNew',
    component: () => import('@/views/PluginForm.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/plugins/:slug',
    name: 'PluginDetail',
    component: () => import('@/views/PluginDetail.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/plugins/:slug/edit',
    name: 'PluginEdit',
    component: () => import('@/views/PluginForm.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/users',
    name: 'Users',
    component: () => import('@/views/UsersList.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/cdn',
    name: 'CDN',
    component: () => import('@/views/CDNInfo.vue'),
    meta: { requiresAuth: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  const auth = useAuthStore();
  if (to.meta.requiresAuth && !auth.user) {
    return next({ name: 'Login', query: { redirect: to.fullPath } });
  }
  if (to.meta.guest && auth.user) {
    return next({ name: 'Dashboard' });
  }
  if (to.meta.requiresAdmin && auth.user && auth.user.role !== 'admin') {
    return next({ name: 'Dashboard' });
  }
  next();
});

export default router;
