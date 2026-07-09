<template>
  <div>
    <div class="page-header">
      <div class="flex-between flex-wrap gap-2">
        <div>
          <h1>👥 Usuarios</h1>
          <p>Administra quién puede acceder al panel</p>
        </div>
        <button class="btn btn-primary" @click="showForm = !showForm">➕ Invitar usuario</button>
      </div>
    </div>

    <div v-if="showForm" class="card card-accent mb-3" style="max-width: 450px">
      <h3 class="mb-2">Invitar nuevo usuario</h3>
      <div class="mb-2">
        <label>Email</label>
        <input v-model="newEmail" type="email" placeholder="usuario@email.com" />
      </div>
      <div class="mb-2">
        <label>Rol</label>
        <select v-model="newRole">
          <option value="editor">✏️ Editor</option>
          <option value="admin">🔧 Admin</option>
        </select>
      </div>
      <button class="btn btn-primary w-full" @click="createUser">✅ Invitar</button>
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      <table>
        <thead>
          <tr><th>Email</th><th>Rol</th><th>Estado</th><th>Creado</th><th>Acciones</th></tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td><strong>{{ u.email }}</strong></td>
            <td>
              <select :value="u.role" @change="updateRole(u, $event.target.value)" class="btn-sm" style="width:auto">
                <option value="editor">✏️ Editor</option>
                <option value="admin">🔧 Admin</option>
              </select>
            </td>
            <td>
              <span :class="['badge', u.disabled ? 'badge-red' : 'badge-green']">{{ u.disabled ? '🔒 Bloqueado' : '✅ Activo' }}</span>
            </td>
            <td class="text-muted text-sm">{{ formatDate(u.createdAt) }}</td>
            <td>
              <div class="flex gap-1">
                <button class="btn btn-xs" @click="toggleDisabled(u)">{{ u.disabled ? '🔓' : '🔒' }}</button>
                <button class="btn btn-xs btn-danger" @click="remove(u)">🗑️</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
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
  try { users.value = await auth.fetchUsers(); } catch (e) { toast.show(e.message, 'error'); }
}

async function createUser() {
  if (!newEmail.value) return;
  try {
    await auth.createUser(newEmail.value, newRole.value);
    toast.show('✅ Usuario invitado', 'success');
    newEmail.value = ''; showForm.value = false;
    await load();
  } catch (e) { toast.show(e.message, 'error'); }
}

async function updateRole(u, role) {
  try { await auth.updateUser(u.email, { role }); u.role = role; toast.show('✅ Rol actualizado', 'success'); } catch (e) { toast.show(e.message, 'error'); }
}

async function toggleDisabled(u) {
  try { await auth.updateUser(u.email, { disabled: !u.disabled }); u.disabled = !u.disabled; toast.show(u.disabled ? '🔒 Bloqueado' : '🔓 Desbloqueado', 'success'); } catch (e) { toast.show(e.message, 'error'); }
}

async function remove(u) {
  if (!confirm(`Eliminar a ${u.email}?`)) return;
  try { await auth.deleteUser(u.email); users.value = users.value.filter(x => x.email !== u.email); toast.show('🗑️ Eliminado', 'success'); } catch (e) { toast.show(e.message, 'error'); }
}

function formatDate(d) { if (!d) return '-'; return new Date(d).toLocaleDateString(); }
</script>
