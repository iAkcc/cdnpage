<template>
  <div>
    <div class="flex-between mb-2">
      <h1>Usuarios</h1>
      <button class="btn btn-sm btn-primary" @click="showForm = !showForm">+ Invitar</button>
    </div>

    <div v-if="showForm" class="card mb-2" style="max-width: 400px;">
      <h3 class="mb-1">Nuevo usuario</h3>
      <div class="mb-2">
        <label>Email</label>
        <input v-model="newEmail" type="email" />
      </div>
      <div class="mb-2">
        <label>Rol</label>
        <select v-model="newRole">
          <option value="editor">Editor</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <button class="btn btn-primary" @click="createUser">Crear</button>
    </div>

    <table>
      <thead>
        <tr><th>Email</th><th>Rol</th><th>Estado</th><th>Creado</th><th>Acciones</th></tr>
      </thead>
      <tbody>
        <tr v-for="u in users" :key="u.id">
          <td>{{ u.email }}</td>
          <td>
            <select :value="u.role" @change="updateRole(u, $event.target.value)" style="width:auto">
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </td>
          <td>
            <button class="btn btn-sm" @click="toggleDisabled(u)">
              {{ u.disabled ? 'Desbloquear' : 'Bloquear' }}
            </button>
          </td>
          <td style="color: var(--text-muted); font-size: .85rem;">{{ formatDate(u.createdAt) }}</td>
          <td>
            <button class="btn btn-sm btn-danger" @click="remove(u)">Eliminar</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/stores/toast';

const auth = useAuthStore();
const toast = useToast();
const users = ref([]);
const showForm = ref(false);
const newEmail = ref('');
const newRole = ref('editor');

onMounted(load);

async function load() {
  try {
    users.value = await auth.fetchUsers();
  } catch (e) {
    toast.show(e.message, 'error');
  }
}

async function createUser() {
  if (!newEmail.value) return;
  try {
    await auth.createUser(newEmail.value, newRole.value);
    toast.show('Usuario creado', 'success');
    newEmail.value = '';
    showForm.value = false;
    await load();
  } catch (e) {
    toast.show(e.message, 'error');
  }
}

async function updateRole(u, role) {
  try {
    await auth.updateUser(u.email, { role });
    u.role = role;
    toast.show('Rol actualizado', 'success');
  } catch (e) {
    toast.show(e.message, 'error');
  }
}

async function toggleDisabled(u) {
  try {
    await auth.updateUser(u.email, { disabled: !u.disabled });
    u.disabled = !u.disabled;
    toast.show(u.disabled ? 'Bloqueado' : 'Desbloqueado', 'success');
  } catch (e) {
    toast.show(e.message, 'error');
  }
}

async function remove(u) {
  if (!confirm(`Eliminar a ${u.email}?`)) return;
  try {
    await auth.deleteUser(u.email);
    users.value = users.value.filter(x => x.email !== u.email);
    toast.show('Usuario eliminado', 'success');
  } catch (e) {
    toast.show(e.message, 'error');
  }
}

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString();
}
</script>
