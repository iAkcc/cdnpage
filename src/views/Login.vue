<template>
  <div style="max-width: 420px; margin: 4rem auto; padding: 2rem;">
    <div class="card">
      <h2 style="margin-bottom: 1.5rem;">Acceso al Panel</h2>
      <p style="color: var(--text-muted); font-size: .9rem; margin-bottom: 1rem;">
        Ingresa tu email para recibir un enlace de acceso.
      </p>
      <form @submit.prevent="send">
        <div class="mb-2">
          <label>Email</label>
          <input v-model="email" type="email" required placeholder="admin@ejemplo.com" />
        </div>
        <button type="submit" class="btn btn-primary" :disabled="sending" style="width:100%">
          {{ sending ? 'Enviando...' : 'Enviar enlace' }}
        </button>
        <p v-if="sent" style="color: var(--success); margin-top: 1rem; font-size: .9rem;">
          Si el email existe, recibirás un enlace.
        </p>
        <p v-if="error" style="color: var(--danger); margin-top: 1rem; font-size: .9rem;">
          {{ error }}
        </p>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const email = ref('');
const sending = ref(false);
const sent = ref(false);
const error = ref('');

// Si hay un token en la URL, verificarlo automáticamente
const token = route.query.token;
if (token) {
  verifyToken(token);
}

async function verifyToken(t) {
  try {
    await auth.verifyToken(t);
    const redirect = route.query.redirect || '/';
    router.push(redirect);
  } catch (e) {
    error.value = e.message || 'Enlace inválido o expirado';
  }
}

async function send() {
  sending.value = true;
  error.value = '';
  sent.value = false;
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
