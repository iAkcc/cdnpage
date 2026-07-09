<template>
  <div v-if="toast.message.value" :class="['toast', typeClass]">{{ toast.message.value }}</div>
</template>

<script setup>
import { computed } from 'vue';
import { useToast } from '@/stores/toast';

const toast = useToast();
const typeClass = computed(() =>
  toast.type.value === 'success' ? 'toast-success' : toast.type.value === 'error' ? 'toast-error' : ''
);
</script>
