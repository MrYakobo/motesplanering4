<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '../composables/useStore'
import { useToday } from '../composables/useToday'
import { useToast } from '../composables/useToast'
import EventList from '../components/EventList.vue'
import RecordModal from '../components/RecordModal.vue'
import EventForm from '../components/EventForm.vue'
import PropagateModal from '../components/PropagateModal.vue'
import CalendarMonth from '../components/CalendarMonth.vue'
import CalendarWeek from '../components/CalendarWeek.vue'
import CalendarYear from '../components/CalendarYear.vue'
import { PlusCircle, List, CalendarDays, CalendarRange, Grid3x3, RefreshCw } from 'lucide-vue-next'
import type { Event, EventView } from '../types'
import GenerateEventsModal from '../components/GenerateEventsModal.vue'

const { db, selectedId, searchQuery, persist, assignments, currentView, setView } = useStore()
const { todayStr } = useToday()
const { show: toast } = useToast()

const editingEvent = ref<Event | null>(null)
const generateOpen = ref(false)

// ── Propagation state ────────────────────────────────────────────────────────
const propagateOpen = ref(false)
const propagateEvent = ref<Event | null>(null)
const propagateOriginalTitle = ref('')
const propagateChangedFields = ref<string[]>([])
const propagateFutureCount = ref(0)
const propagateFutureMatches = ref<Event[]>([])

const SKIP_FIELDS = new Set(['id', 'date', 'time', 'volunteers'])

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

function onSelect(id: number) {
  const ev = db.events.find(e => e.id === id)
  if (ev) editingEvent.value = { ...ev }
}

function newEvent(date?: string) {
  const maxId = db.events.reduce((m, e) => Math.max(m, e.id), 0) + 1
  editingEvent.value = {
    id: maxId,
    date: date || todayStr.value,
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
  const isNew = idx < 0

  if (!isNew) {
    // Existing event — check for propagatable changes
    const original = db.events[idx]
    const oldTitle = original.title
    const changedFields: string[] = []

    for (const key of Object.keys(ev) as (keyof Event)[]) {
      if (SKIP_FIELDS.has(key)) continue
      if (JSON.stringify(original[key]) !== JSON.stringify(ev[key])) {
        changedFields.push(key)
      }
    }

    const futureMatches = db.events.filter(
      e => e.id !== ev.id && e.title === oldTitle && e.date > original.date
    )

    if (changedFields.length > 0 && futureMatches.length > 0) {
      // Save the current event first
      db.events[idx] = ev
      // Show propagation modal
      propagateEvent.value = ev
      propagateOriginalTitle.value = oldTitle
      propagateChangedFields.value = changedFields
      propagateFutureMatches.value = futureMatches
      propagateFutureCount.value = futureMatches.length
      propagateOpen.value = true
      editingEvent.value = null
      return
    }

    db.events[idx] = ev
  } else {
    db.events.push(ev)
    assignments[ev.id] = {}
  }

  await persist('events')
  editingEvent.value = null
  toast('Händelse sparad')
}

async function onPropagate(fields: string[]) {
  const ev = propagateEvent.value!
  propagateFutureMatches.value.forEach(m => {
    fields.forEach(f => {
      const val = (ev as any)[f]
      ;(m as any)[f] = typeof val === 'object' ? JSON.parse(JSON.stringify(val)) : val
    })
  })
  propagateOpen.value = false
  await persist('events')
  toast(`Uppdaterade ${propagateFutureMatches.value.length + 1} händelser`)
}

async function onPropagateSkip() {
  propagateOpen.value = false
  await persist('events')
  toast('Händelse sparad')
}

async function onDelete(id: number) {
  db.events = db.events.filter(e => e.id !== id)
  delete assignments[id]
  await persist('events')
  editingEvent.value = null
  toast('Händelse borttagen')
}

async function onMoveEvent(eventId: number, newDate: string) {
  const ev = db.events.find(e => e.id === eventId)
  if (!ev || ev.date === newDate) return
  ev.date = newDate
  await persist('events')
  toast(`Flyttad till ${newDate}`)
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
    <EventList
      v-if="currentView === 'list'"
      :events="filteredEvents"
      :selected-id="selectedId"
      @select="onSelect"
    />

    <!-- Month calendar -->
    <CalendarMonth
      v-else-if="currentView === 'calendar'"
      :events="filteredEvents"
      @select="onSelect"
      @create="newEvent"
      @move="onMoveEvent"
    />

    <!-- Week calendar -->
    <CalendarWeek
      v-else-if="currentView === 'week'"
      :events="filteredEvents"
      @select="onSelect"
      @create="newEvent"
      @move="onMoveEvent"
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

    <PropagateModal
      :open="propagateOpen"
      :event="propagateEvent!"
      :original-title="propagateOriginalTitle"
      :changed-fields="propagateChangedFields"
      :future-count="propagateFutureCount"
      @apply="onPropagate"
      @skip="onPropagateSkip"
      @close="onPropagateSkip"
    />
  </div>
</template>
