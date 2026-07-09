<template>
  <div class="login-page">
    <div class="card login-card">
      <div class="login-logo">CDN</div>
      <h1>Admin Panel</h1>
      <p>Ingresa tu email para recibir el enlace de acceso</p>

      <form @submit.prevent="send">
        <div class="mb-2">
          <label>Email</label>
          <input v-model="email" type="email" required placeholder="tu@email.com" autocomplete="email" />
        </div>
        <button type="submit" class="btn btn-primary w-full" :disabled="sending">
          {{ sending ? '⏳ Enviando...' : '📬 Enviar enlace mágico' }}
        </button>

        <div v-if="sent" class="mt-2" style="text-align:center">
          <div style="font-size:2rem;margin-bottom:.5rem">📬</div>
          <p style="color:var(--success);font-weight:500;font-size:.9rem">
            Si el email existe, recibirás un enlace.
          </p>
          <p class="text-xs text-muted mt-1">Revisa tu bandeja de entrada y spam</p>
        </div>

        <div v-if="error" class="mt-2" style="text-align:center">
          <p style="color:var(--danger);font-size:.85rem">{{ error }}</p>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const email = ref('');
const sending = ref(false);
const sent = ref(false);
const error = ref('');

const token = route.query.token;
if (token) verifyToken(token);

async function verifyToken(t) {
  try {
    await auth.verifyToken(t);
    router.push(route.query.redirect || '/');
  } catch (e) {
    error.value = e.message || 'Enlace inválido o expirado';
  }
}

async function send() {
  sending.value = true; error.value = ''; sent.value = false;
  try {
    await auth.requestLogin(email.value);
    sent.value = true;
  } catch (e) {
    error.value = e.message || 'Error al enviar';
  } finally {
    sending.value = false;
  }
}
</script>
