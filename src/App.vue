<template>
  <div class="main-layout">
    <Sidebar v-if="auth.user" />
    <main class="main-content">
      <router-view />
    </main>
  </div>
  <Toast />
</template>

<script setup>
import { onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import Sidebar from '@/components/Sidebar.vue';
import Toast from '@/components/Toast.vue';

const auth = useAuthStore();
onMounted(() => auth.tryRestoreSession());
</script>
