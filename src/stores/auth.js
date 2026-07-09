import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '@/api/client';

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null);
  const loading = ref(true);

  const isAdmin = computed(() => user.value?.role === 'admin');
  const isLoggedIn = computed(() => !!user.value);

  async function tryRestoreSession() {
    loading.value = true;
    try {
      const data = await api.get('/auth/session');
      user.value = data.user;
    } catch {
      user.value = null;
    } finally {
      loading.value = false;
    }
  }

  async function requestLogin(email) {
    const data = await api.post('/auth/login', { email });
    return data;
  }

  async function verifyToken(token) {
    const data = await api.post('/auth/verify', { token });
    user.value = data.user;
    return data;
  }

  async function logout() {
    await api.get('/auth/logout');
    user.value = null;
  }

  async function fetchUsers() {
    const data = await api.get('/auth/users');
    return data.users;
  }

  async function createUser(email, role = 'editor') {
    const data = await api.post('/auth/users', { email, role });
    return data.user;
  }

  async function updateUser(email, fields) {
    const data = await api.patch('/auth/users', { email, ...fields });
    return data.user;
  }

  async function deleteUser(email) {
    await api.del('/auth/users', { email });
  }

  return {
    user, loading, isAdmin, isLoggedIn,
    tryRestoreSession, requestLogin, verifyToken, logout,
    fetchUsers, createUser, updateUser, deleteUser,
  };
});
