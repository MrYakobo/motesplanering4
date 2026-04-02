<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '../composables/useStore'
import { useToast } from '../composables/useToast'
import DataTable from '../components/DataTable.vue'
import RecordModal from '../components/RecordModal.vue'
import TaskForm from '../components/TaskForm.vue'
import { PlusCircle } from 'lucide-vue-next'
import type { Task } from '../types'

const { db, selectedId, searchQuery, persist } = useStore()
const { show: toast } = useToast()

const editing = ref<Task | null>(null)
const modalOpen = computed(() => editing.value !== null)

const filtered = computed(() => {
  const q = searchQuery.value.toLowerCase()
  let data = [...db.tasks]
  if (q) data = data.filter(t => t.name.toLowerCase().includes(q))
  return data
})

const badge = (v: boolean) => v
  ? '<span class="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">Ja</span>'
  : '<span class="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-500">Nej</span>'

const columns = [
  { key: 'name', label: 'Namn', render: (r: Task) => r.name },
  { key: 'teamTask', label: 'Teamuppgift', render: (r: Task) => badge(r.teamTask) },
  { key: 'mailbot', label: 'Mailbot', render: (r: Task) => badge(r.mailbot) },
  { key: 'phrase', label: 'Påminnelsefras', render: (r: Task) => r.phrase ? `"${r.phrase}"` : '<span class="text-gray-400">—</span>' },
]

function onSelect(id: number) {
  const t = db.tasks.find(x => x.id === id)
  if (t) editing.value = { ...t }
}

function newTask() {
  const maxId = db.tasks.reduce((m, t) => Math.max(m, t.id), 0) + 1
  editing.value = { id: maxId, name: '', teamTask: false, mailbot: false, phrase: '' }
}

async function onSave(t: Task) {
  const idx = db.tasks.findIndex(x => x.id === t.id)
  if (idx >= 0) db.tasks[idx] = t
  else db.tasks.push(t)
  await persist('tasks')
  editing.value = null
  toast('Uppgift sparad')
}

async function onDelete(id: number) {
  db.tasks = db.tasks.filter(t => t.id !== id)
  await persist('tasks')
  editing.value = null
  toast('Uppgift borttagen')
}
</script>

<template>
  <div class="flex flex-col flex-1 overflow-hidden">
    <div class="flex items-center gap-4 px-4 py-2 bg-white border-b border-gray-200 shrink-0">
      <span class="text-xs text-gray-500">Totalt: <strong class="text-gray-900">{{ filtered.length }}</strong> uppgifter</span>
      <button @click="newTask" class="flex items-center gap-1 text-accent text-sm cursor-pointer bg-transparent border-none hover:underline">
        <PlusCircle :size="14" /> Ny uppgift
      </button>
      <input v-model="searchQuery" type="search" placeholder="Sök..." class="ml-auto border border-gray-300 rounded-md px-2.5 py-1 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 w-48" />
    </div>
    <DataTable :columns="columns" :rows="filtered" :selected-id="selectedId" @select="onSelect" />
    <RecordModal :open="modalOpen" :title="editing?.name || 'Ny uppgift'" @close="editing = null">
      <TaskForm v-if="editing" :task="editing" @save="onSave" @delete="onDelete" />
    </RecordModal>
  </div>
</template>
