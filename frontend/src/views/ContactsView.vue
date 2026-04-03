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
    <div class="skeu-toolbar">
      <span class="skeu-toolbar-label">Totalt: <strong>{{ filtered.length }}</strong> kontakter</span>
      <button @click="newContact" class="skeu-toolbar-btn">
        <PlusCircle :size="13" /> Ny kontakt
      </button>
      <input v-model="searchQuery" type="search" placeholder="Sök..." class="skeu-search ml-auto" />
    </div>
    <DataTable :columns="columns" :rows="filtered" :selected-id="selectedId" @select="onSelect" />
    <RecordModal :open="modalOpen" :title="editing?.name || 'Ny kontakt'" @close="editing = null">
      <ContactForm v-if="editing" :contact="editing" @save="onSave" @delete="onDelete" />
    </RecordModal>
  </div>
</template>

<style scoped>
.skeu-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  flex-shrink: 0;
  background: linear-gradient(180deg, #e8e8e8 0%, #d4d4d4 100%);
  border-bottom: 1px solid #bbb;
  box-shadow: 0 1px 0 rgba(255,255,255,.4) inset;
}
.skeu-toolbar-label {
  font-size: 11px;
  color: #666;
  text-shadow: 0 1px 0 rgba(255,255,255,.7);
}
.skeu-toolbar-label strong { color: #333; }
.skeu-toolbar-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 5px;
  font-size: 12px;
  cursor: pointer;
  color: #fff;
  border: 1px solid rgba(0,0,0,.2);
  background: linear-gradient(180deg, #6a5aed 0%, #4a3cc9 100%);
  box-shadow: 0 1px 0 rgba(255,255,255,.2) inset, 0 1px 2px rgba(59,47,186,.25);
  text-shadow: 0 -1px 0 rgba(0,0,0,.15);
  transition: all 0.12s ease;
}
.skeu-toolbar-btn:hover {
  background: linear-gradient(180deg, #7b6cf5 0%, #5544d4 100%);
}
.skeu-search {
  width: 180px;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  outline: none;
  color: #333;
  background: linear-gradient(180deg, #e0e0e0 0%, #fff 3px);
  border: 1px solid #aaa;
  box-shadow: 0 1px 2px rgba(0,0,0,.06) inset;
}
.skeu-search:focus {
  border-color: #6a5aed;
  box-shadow: 0 1px 2px rgba(0,0,0,.06) inset, 0 0 0 2px rgba(106,90,237,.15);
}
</style>
