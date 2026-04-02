<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { Task } from '../types'

const props = defineProps<{ task: Task }>()
const emit = defineEmits<{ save: [task: Task]; delete: [id: number] }>()

const form = reactive<Task>({ ...props.task })
watch(() => props.task, (t) => Object.assign(form, t))
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Namn</label>
      <input v-model="form.name" type="text" class="field-input" />
    </div>
    <div class="flex items-center gap-2">
      <input v-model="form.teamTask" type="checkbox" id="teamTask" class="accent-accent" />
      <label for="teamTask" class="text-sm text-gray-700">Teamuppgift</label>
    </div>
    <div class="flex items-center gap-2">
      <input v-model="form.mailbot" type="checkbox" id="mailbot" class="accent-accent" />
      <label for="mailbot" class="text-sm text-gray-700">Mailbot aktiv</label>
    </div>
    <div>
      <label class="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Påminnelsefras</label>
      <input v-model="form.phrase" type="text" placeholder="T.ex. 'Du är schemalagd för...'" class="field-input" />
    </div>
  </div>
  <div class="flex gap-2 mt-6 pt-4 border-t border-gray-200">
    <button @click="emit('save', { ...form })" class="bg-accent text-white rounded-md px-4 py-1.5 text-sm cursor-pointer hover:bg-accent-hover transition-colors">Spara</button>
    <span class="flex-1" />
    <button @click="emit('delete', form.id)" class="bg-red-500 text-white rounded-md px-4 py-1.5 text-sm cursor-pointer hover:bg-red-600 transition-colors">Ta bort</button>
  </div>
</template>

<style scoped>
@reference "../style.css";
.field-input {
  @apply w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm outline-none
         transition-colors focus:border-accent focus:ring-2 focus:ring-accent/10 bg-gray-50 focus:bg-white;
}
</style>
