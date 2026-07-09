import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/api/client';

export const usePluginsStore = defineStore('plugins', () => {
  const plugins = ref([]);
  const loading = ref(false);

  async function fetchAll() {
    loading.value = true;
    try {
      const data = await api.get('/plugins');
      plugins.value = data.plugins || [];
    } finally {
      loading.value = false;
    }
  }

  async function getBySlug(slug) {
    const data = await api.get(`/plugins/${slug}`);
    return data;
  }

  async function create(data) {
    const res = await api.post('/plugins', data);
    await fetchAll();
    return res.plugin;
  }

  async function update(data) {
    const res = await api.put('/plugins', data);
    await fetchAll();
    return res.plugin;
  }

  async function patch(slug, data) {
    const res = await api.patch(`/plugins/${slug}`, data);
    await fetchAll();
    return res.plugin;
  }

  async function remove(slug) {
    await api.del(`/plugins?slug=${slug}`);
    await fetchAll();
  }

  // Versiones
  async function listVersions(slug) {
    const data = await api.get(`/versions?slug=${slug}`);
    return data.versions || [];
  }

  async function createVersion(versionData) {
    const res = await api.post('/versions', versionData);
    return res;
  }

  async function patchVersion(slug, version, data) {
    const res = await api.patch(`/versions/${slug}/${version}`, data);
    return res.version;
  }

  async function deleteVersion(slug, version) {
    await api.del(`/versions/${slug}/${version}`);
  }

  async function getCDNUrl(slug, version) {
    const q = version ? `?slug=${slug}&version=${version}` : `?slug=${slug}`;
    return await api.get(`/cdn${q}`);
  }

  async function requestUploadUrl(data) {
    return await api.post('/upload', data);
  }

  // Admin
  async function rebuildManifest() {
    return await api.post('/admin', { action: 'rebuild-manifest' });
  }

  async function getStats() {
    return await api.get('/admin?action=stats');
  }

  return {
    plugins, loading,
    fetchAll, getBySlug, create, update, patch, remove,
    listVersions, createVersion, patchVersion, deleteVersion,
    getCDNUrl, requestUploadUrl, rebuildManifest, getStats,
  };
});
