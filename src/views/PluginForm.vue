<template>
  <div>
    <h1 style="margin-bottom: 1rem;">{{ isEdit ? 'Editar' : 'Nuevo' }} Plugin</h1>
    <form @submit.prevent="save" class="card" style="max-width: 600px;">
      <div class="mb-2">
        <label>Slug (ID único, solo minúsculas y guiones)</label>
        <input v-model="form.slug" :disabled="isEdit" required pattern="^[a-z0-9-]+$" />
      </div>
      <div class="grid-2 mb-2">
        <div>
          <label>Nombre</label>
          <input v-model="form.name" required />
        </div>
        <div>
          <label>Categoría</label>
          <input v-model="form.category" />
        </div>
      </div>
      <div class="mb-2">
        <label>Descripción</label>
        <textarea v-model="form.description" rows="3"></textarea>
      </div>
      <div class="grid-2 mb-2">
        <div>
          <label>Autor</label>
          <input v-model="form.author" />
        </div>
        <div>
          <label>Visibilidad</label>
          <select v-model="form.visibility">
            <option value="private">Privado</option>
            <option value="public">Público</option>
          </select>
        </div>
      </div>
      <div class="mb-2">
        <label>URL de página (homepage)</label>
        <input v-model="form.homepage" type="url" placeholder="https://" />
      </div>
      <div class="mb-2">
        <label>Tags (separados por coma)</label>
        <input v-model="tagsInput" placeholder="minecraft, papel, chat" />
      </div>
      <div class="flex gap-2">
        <button type="submit" class="btn btn-primary">{{ isEdit ? 'Guardar' : 'Crear' }}</button>
        <router-link to="/plugins" class="btn">Cancelar</router-link>
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
      toast.show('Plugin actualizado', 'success');
    } else {
      await store.create({ ...form.value });
      toast.show('Plugin creado', 'success');
    }
    router.push('/plugins');
  } catch (e) {
    toast.show(e.message || 'Error', 'error');
  }
}
</script>
