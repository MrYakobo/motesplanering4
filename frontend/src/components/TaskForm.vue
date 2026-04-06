<script setup lang="ts">
import { reactive, watch } from 'vue'
import { useStore } from '../composables/useStore'
import type { Task } from '../types'

const props = defineProps<{ task: Task }>()
const emit = defineEmits<{ save: [task: Task]; delete: [id: number] }>()
const { db } = useStore()

const form = reactive<Task>({ ...props.task })
watch(() => props.task, (t) => Object.assign(form, t))
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Namn</label>
      <input v-model="form.name" type="text" class="field-input" />
    </div>
    <div>
      <label class="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Kort beskrivning</label>
      <input v-model="form.description" type="text" placeholder="T.ex. 'Sköter ljudmixern under mötet'" class="field-input" />
    </div>
    <div>
      <label class="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Påminnelsefras</label>
      <input v-model="form.phrase" type="text" placeholder="T.ex. 'kör ljud'" class="field-input" />
    </div>
    <div>
      <label class="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Ansvarig person</label>
      <select v-model="form.responsibleId" class="field-input">
        <option :value="null">Ingen</option>
        <option v-for="c in db.contacts" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
    </div>
    <div>
      <label class="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Manual</label>
      <textarea v-model="form.manual" rows="6" placeholder="Instruktioner i markdown..." class="field-input font-mono text-xs" />
    </div>
    <div class="flex flex-col gap-2">
      <label class="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
        <input v-model="form.teamTask" type="checkbox" class="accent-accent" />
        Teamuppgift
      </label>
      <label class="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
        <input v-model="form.mailbot" type="checkbox" class="accent-accent" />
        Mailbot aktiv
      </label>
      <label class="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
        <input v-model="form.locked" type="checkbox" class="accent-accent" />
        Låst (dölj från platsbanken)
      </label>
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
