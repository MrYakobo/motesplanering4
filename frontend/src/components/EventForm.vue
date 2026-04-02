<script setup lang="ts">
import { reactive, watch } from 'vue'
import { useStore } from '../composables/useStore'
import type { Event } from '../types'

const props = defineProps<{ event: Event }>()
const emit = defineEmits<{ save: [event: Event]; delete: [id: number] }>()

const { db } = useStore()

const form = reactive<Event>({ ...props.event })
watch(() => props.event, (e) => Object.assign(form, e))

function onSave() {
  emit('save', { ...form })
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Datum</label>
      <input v-model="form.date" type="date" class="field-input" />
    </div>
    <div>
      <label class="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Tid</label>
      <input v-model="form.time" type="time" class="field-input" />
    </div>
    <div>
      <label class="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Titel</label>
      <input v-model="form.title" type="text" class="field-input" />
    </div>
    <div>
      <label class="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Kategori</label>
      <select v-model="form.category" class="field-input">
        <option v-for="cat in db.categories" :key="cat.name" :value="cat.name">{{ cat.name }}</option>
      </select>
    </div>
    <div>
      <label class="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Beskrivning</label>
      <textarea v-model="form.description" rows="2" class="field-input" />
    </div>
    <div>
      <label class="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Infolänk</label>
      <input v-model="form.infoLink" type="url" placeholder="https://…" class="field-input" />
    </div>
    <div>
      <label class="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Förväntade uppgifter</label>
      <div class="space-y-1">
        <label
          v-for="task in db.tasks"
          :key="task.id"
          class="flex items-center gap-2 px-1.5 py-1 rounded cursor-pointer text-sm text-gray-700 hover:bg-gray-50"
        >
          <input
            type="checkbox"
            :checked="(form.expectedTasks || []).includes(task.id)"
            class="accent-accent"
            @change="
              ($event.target as HTMLInputElement).checked
                ? form.expectedTasks.push(task.id)
                : (form.expectedTasks = form.expectedTasks.filter(id => id !== task.id))
            "
          />
          {{ task.name }}
        </label>
      </div>
    </div>
  </div>

  <div class="flex gap-2 mt-6 pt-4 border-t border-gray-200">
    <button @click="onSave" class="btn-primary">Spara</button>
    <span class="flex-1" />
    <button
      v-if="!props.event._isNew"
      @click="emit('delete', form.id)"
      class="btn-danger"
    >
      Ta bort
    </button>
  </div>
</template>

<style scoped>
@reference "../style.css";
.field-input {
  @apply w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm outline-none
         transition-colors focus:border-accent focus:ring-2 focus:ring-accent/10 bg-gray-50 focus:bg-white;
}
.btn-primary {
  @apply bg-accent text-white border-none rounded-md px-4 py-1.5 text-sm cursor-pointer
         hover:bg-accent-hover transition-colors;
}
.btn-danger {
  @apply bg-red-500 text-white border-none rounded-md px-4 py-1.5 text-sm cursor-pointer
         hover:bg-red-600 transition-colors;
}
</style>
