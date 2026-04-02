<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { Contact } from '../types'

const props = defineProps<{ contact: Contact }>()
const emit = defineEmits<{ save: [contact: Contact]; delete: [id: number] }>()

const form = reactive<Contact>({ ...props.contact })
watch(() => props.contact, (c) => Object.assign(form, c))
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Namn</label>
      <input v-model="form.name" type="text" class="field-input" />
    </div>
    <div>
      <label class="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">E-post</label>
      <input v-model="form.email" type="email" class="field-input" />
    </div>
    <div>
      <label class="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Telefon</label>
      <input v-model="form.phone" type="tel" class="field-input" />
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
