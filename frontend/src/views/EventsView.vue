<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '../composables/useStore'
import { useToast } from '../composables/useToast'
import DataTable from '../components/DataTable.vue'
import RecordModal from '../components/RecordModal.vue'
import EventForm from '../components/EventForm.vue'
import CalendarMonth from '../components/CalendarMonth.vue'
import CalendarWeek from '../components/CalendarWeek.vue'
import CalendarYear from '../components/CalendarYear.vue'
import { PlusCircle, List, CalendarDays, CalendarRange, Grid3x3, RefreshCw } from 'lucide-vue-next'
import type { Event, EventView } from '../types'
import GenerateEventsModal from '../components/GenerateEventsModal.vue'

const { db, selectedId, searchQuery, persist, assignments, currentView, setView } = useStore()
const { show: toast } = useToast()

const editingEvent = ref<Event | null>(null)
const generateOpen = ref(false)

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

function newEvent(date?: string) {
  const maxId = db.events.reduce((m, e) => Math.max(m, e.id), 0) + 1
  editingEvent.value = {
    id: maxId,
    date: date || new Date().toISOString().slice(0, 10),
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

function onCalendarSwitchWeek(_dateStr: string) {
  setView('week')
}

const views: { id: EventView; icon: any; label: string }[] = [
  { id: 'list', icon: List, label: 'Lista' },
  { id: 'calendar', icon: CalendarDays, label: 'Månad' },
  { id: 'week', icon: CalendarRange, label: 'Vecka' },
  { id: 'year', icon: Grid3x3, label: 'År' },
]

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
  <div class="flex flex-col flex-1 overflow-hidden relative">
    <div class="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200 shrink-0">
      <span class="text-xs text-gray-500">
        Totalt: <strong class="text-gray-900">{{ filteredEvents.length }}</strong>
      </span>
      <button
        @click="newEvent()"
        class="flex items-center gap-1 text-accent text-sm cursor-pointer bg-transparent border-none hover:underline"
      >
        <PlusCircle :size="14" /> Ny händelse
      </button>
      <button
        @click="generateOpen = true"
        class="flex items-center gap-1 text-accent text-sm cursor-pointer bg-transparent border-none hover:underline"
      >
        <RefreshCw :size="14" /> Generera
      </button>
      <!-- View toggle -->
      <div class="flex items-center gap-0.5 ml-2 bg-gray-100 rounded-md p-0.5">
        <button
          v-for="v in views" :key="v.id"
          @click="setView(v.id)"
          class="flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer border-none transition-colors"
          :class="currentView === v.id
            ? 'bg-white text-gray-800 shadow-sm'
            : 'bg-transparent text-gray-500 hover:text-gray-700'"
          :title="v.label"
        >
          <component :is="v.icon" :size="13" />
          <span class="hidden sm:inline">{{ v.label }}</span>
        </button>
      </div>
      <input
        v-model="searchQuery"
        type="search"
        placeholder="Sök..."
        class="ml-auto border border-gray-300 rounded-md px-2.5 py-1 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 w-48"
      />
    </div>

    <!-- List view -->
    <DataTable
      v-if="currentView === 'list'"
      :columns="columns"
      :rows="filteredEvents"
      :selected-id="selectedId"
      @select="onSelect"
    />

    <!-- Month calendar -->
    <CalendarMonth
      v-else-if="currentView === 'calendar'"
      :events="filteredEvents"
      @select="onSelect"
      @create="newEvent"
    />

    <!-- Week calendar -->
    <CalendarWeek
      v-else-if="currentView === 'week'"
      :events="filteredEvents"
      @select="onSelect"
      @create="newEvent"
    />

    <!-- Year calendar -->
    <CalendarYear
      v-else-if="currentView === 'year'"
      :events="filteredEvents"
      @switch-week="onCalendarSwitchWeek"
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

    <GenerateEventsModal :open="generateOpen" @close="generateOpen = false" @generated="() => {}" />
  </div>
</template>
