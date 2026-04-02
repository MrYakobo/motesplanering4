<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '../composables/useStore'
import { useToast } from '../composables/useToast'
import DataTable from '../components/DataTable.vue'
import RecordModal from '../components/RecordModal.vue'
import EventForm from '../components/EventForm.vue'
import CategoryBadge from '../components/CategoryBadge.vue'
import { PlusCircle } from 'lucide-vue-next'
import type { Event } from '../types'

const { db, selectedId, selectRecord, searchQuery, persist, assignments } = useStore()
const { show: toast } = useToast()

const editingEvent = ref<Event | null>(null)

const modalOpen = computed(() => editingEvent.value !== null)

const filteredEvents = computed(() => {
  const q = searchQuery.value.toLowerCase()
  let data = [...db.events].sort((a, b) =>
    (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))
  )
  if (q) {
    data = data.filter(e =>
      e.title.toLowerCase().includes(q) ||
      e.date.includes(q) ||
      (e.category || '').toLowerCase().includes(q) ||
      (e.description || '').toLowerCase().includes(q)
    )
  }
  return data
})

const columns = [
  {
    key: 'date', label: 'Datum',
    render: (r: Event) => `<span class="text-xs whitespace-nowrap">${r.date} ${r.time || ''}</span>`,
  },
  { key: 'title', label: 'Titel', render: (r: Event) => r.title },
  {
    key: 'category', label: 'Kategori',
    render: () => '', // handled via slot-like approach below — but DataTable uses v-html, so we render inline
  },
  {
    key: 'description', label: 'Beskrivning',
    render: (r: Event) => r.description || '<span class="text-gray-400">—</span>',
  },
]

function onSelect(id: number) {
  const ev = db.events.find(e => e.id === id)
  if (ev) editingEvent.value = { ...ev }
}

function newEvent() {
  const maxId = db.events.reduce((m, e) => Math.max(m, e.id), 0) + 1
  const today = new Date().toISOString().slice(0, 10)
  editingEvent.value = {
    id: maxId,
    date: today,
    time: '10:00',
    title: '',
    category: db.categories?.[0]?.name || '',
    description: '',
    infoLink: '',
    promoSlides: [],
    expectedTasks: [],
    volunteers: 0,
  }
}

async function onSave(ev: Event) {
  const idx = db.events.findIndex(e => e.id === ev.id)
  if (idx >= 0) {
    db.events[idx] = ev
  } else {
    db.events.push(ev)
    assignments[ev.id] = {}
  }
  await persist('events')
  editingEvent.value = null
  toast('Händelse sparad')
}

async function onDelete(id: number) {
  db.events = db.events.filter(e => e.id !== id)
  delete assignments[id]
  await persist('events')
  editingEvent.value = null
  toast('Händelse borttagen')
}
</script>

<template>
  <div class="flex flex-col flex-1 overflow-hidden">
    <div class="flex items-center gap-4 px-4 py-2 bg-white border-b border-gray-200 shrink-0">
      <span class="text-xs text-gray-500">
        Totalt: <strong class="text-gray-900">{{ filteredEvents.length }}</strong>
      </span>
      <button
        @click="newEvent"
        class="flex items-center gap-1 text-accent text-sm cursor-pointer bg-transparent border-none hover:underline"
      >
        <PlusCircle :size="14" /> Ny händelse
      </button>
      <input
        v-model="searchQuery"
        type="search"
        placeholder="Sök..."
        class="ml-auto border border-gray-300 rounded-md px-2.5 py-1 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 w-48"
      />
    </div>
    <DataTable
      :columns="columns"
      :rows="filteredEvents"
      :selected-id="selectedId"
      @select="onSelect"
    />
    <RecordModal
      :open="modalOpen"
      :title="editingEvent?.title || 'Ny händelse'"
      @close="editingEvent = null"
    >
      <EventForm
        v-if="editingEvent"
        :event="editingEvent"
        @save="onSave"
        @delete="onDelete"
      />
    </RecordModal>
  </div>
</template>
