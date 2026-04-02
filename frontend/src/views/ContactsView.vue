<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '../composables/useStore'
import { useToast } from '../composables/useToast'
import DataTable from '../components/DataTable.vue'
import RecordModal from '../components/RecordModal.vue'
import ContactForm from '../components/ContactForm.vue'
import { PlusCircle } from 'lucide-vue-next'
import type { Contact } from '../types'

const { db, selectedId, searchQuery, persist } = useStore()
const { show: toast } = useToast()

const editing = ref<Contact | null>(null)
const modalOpen = computed(() => editing.value !== null)

const filtered = computed(() => {
  const q = searchQuery.value.toLowerCase()
  let data = [...db.contacts]
  if (q) data = data.filter(c => c.name.toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q))
  return data
})

const columns = [
  { key: 'name', label: 'Namn', render: (r: Contact) => r.name },
  { key: 'email', label: 'E-post', render: (r: Contact) => r.email ? `<a href="mailto:${r.email}" class="text-indigo-600" onclick="event.stopPropagation()">${r.email}</a>` : '—' },
  { key: 'phone', label: 'Telefon', render: (r: Contact) => r.phone || '<span class="text-gray-400">—</span>' },
]

function onSelect(id: number) {
  const c = db.contacts.find(x => x.id === id)
  if (c) editing.value = { ...c }
}

function newContact() {
  const maxId = db.contacts.reduce((m, c) => Math.max(m, c.id), 0) + 1
  editing.value = { id: maxId, name: '', email: '', phone: '' }
}

async function onSave(c: Contact) {
  const idx = db.contacts.findIndex(x => x.id === c.id)
  if (idx >= 0) db.contacts[idx] = c
  else db.contacts.push(c)
  await persist('contacts')
  editing.value = null
  toast('Kontakt sparad')
}

async function onDelete(id: number) {
  db.contacts = db.contacts.filter(c => c.id !== id)
  await persist('contacts')
  editing.value = null
  toast('Kontakt borttagen')
}
</script>

<template>
  <div class="flex flex-col flex-1 overflow-hidden">
    <div class="flex items-center gap-4 px-4 py-2 bg-white border-b border-gray-200 shrink-0">
      <span class="text-xs text-gray-500">Totalt: <strong class="text-gray-900">{{ filtered.length }}</strong> kontakter</span>
      <button @click="newContact" class="flex items-center gap-1 text-accent text-sm cursor-pointer bg-transparent border-none hover:underline">
        <PlusCircle :size="14" /> Ny kontakt
      </button>
      <input v-model="searchQuery" type="search" placeholder="Sök..." class="ml-auto border border-gray-300 rounded-md px-2.5 py-1 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 w-48" />
    </div>
    <DataTable :columns="columns" :rows="filtered" :selected-id="selectedId" @select="onSelect" />
    <RecordModal :open="modalOpen" :title="editing?.name || 'Ny kontakt'" @close="editing = null">
      <ContactForm v-if="editing" :contact="editing" @save="onSave" @delete="onDelete" />
    </RecordModal>
  </div>
</template>
