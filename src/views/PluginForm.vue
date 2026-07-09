<template>
  <div>
    <div class="page-header">
      <h1>{{ isEdit ? '✏️ Editar Plugin' : '➕ Nuevo Plugin' }}</h1>
      <p>{{ isEdit ? 'Actualiza los datos del plugin' : 'Crea un nuevo proyecto para almacenar versiones' }}</p>
    </div>

    <form @submit.prevent="save" class="card" style="max-width: 680px">
      <div class="grid-2 mb-2">
        <div>
          <label>Slug <span class="text-muted">(ID único)</span></label>
          <input v-model="form.slug" :disabled="isEdit" required pattern="^[a-z0-9-]+$" placeholder="mi-plugin" />
        </div>
        <div>
          <label>Nombre</label>
          <input v-model="form.name" required placeholder="Mi Plugin" />
        </div>
      </div>
      <div class="mb-2">
        <label>Descripción</label>
        <textarea v-model="form.description" rows="3" placeholder="¿Qué hace este plugin?"></textarea>
      </div>
      <div class="grid-2 mb-2">
        <div>
          <label>Autor</label>
          <input v-model="form.author" placeholder="Tu nombre" />
        </div>
        <div>
          <label>Categoría</label>
          <select v-model="form.category">
            <option value="">Sin categoría</option>
            <option value="utility">Utilidad</option>
            <option value="gameplay">Gameplay</option>
            <option value="admin">Administración</option>
            <option value="chat">Chat</option>
            <option value="economy">Economía</option>
            <option value="world">Mundo</option>
            <option value="bot">Bot</option>
            <option value="other">Otro</option>
          </select>
        </div>
      </div>
      <div class="grid-2 mb-2">
        <div>
          <label>Visibilidad</label>
          <select v-model="form.visibility">
            <option value="private">🔒 Privado</option>
            <option value="public">🌍 Público</option>
          </select>
        </div>
        <div>
          <label>URL (homepage)</label>
          <input v-model="form.homepage" type="url" placeholder="https://" />
        </div>
      </div>
      <div class="mb-2">
        <label>Tags <span class="text-muted">(separados por coma)</span></label>
        <input v-model="tagsInput" placeholder="minecraft, papel, chat" />
      </div>
      <div class="flex gap-2">
        <button type="submit" class="btn btn-primary">{{ isEdit ? '💾 Guardar cambios' : '✅ Crear plugin' }}</button>
        <router-link to="/plugins" class="btn btn-ghost">Cancelar</router-link>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { usePluginsStore } from '@/stores/plugins';
import { useToast } from '@/stores/toast';

const store = usePluginsStore();
const router = useRouter();
const route = useRoute();
const toast = useToast();

const isEdit = computed(() => !!route.params.slug);
const tagsInput = ref('');

const form = ref({
  slug: '', name: '', description: '', author: '',
  category: '', visibility: 'private', homepage: '',
  tags: [],
});

onMounted(async () => {
  if (isEdit.value) {
    const data = await store.getBySlug(route.params.slug);
    if (data?.plugin) {
      form.value = { ...data.plugin };
      tagsInput.value = (data.plugin.tags || []).join(', ');
    }
  }
});

async function save() {
  form.value.tags = tagsInput.value.split(',').map(t => t.trim()).filter(Boolean);
  try {
    if (isEdit.value) {
      await store.update({ ...form.value });
      toast.show('✅ Plugin actualizado', 'success');
    } else {
      await store.create({ ...form.value });
      toast.show('✅ Plugin creado', 'success');
    }
    router.push('/plugins');
  } catch (e) { toast.show(e.message || 'Error', 'error'); }
}
</script>
