<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useStore } from '../composables/useStore'
import { useToday } from '../composables/useToday'
import { useToast } from '../composables/useToast'
import { useRoute, useRouter } from 'vue-router'
import EventList from '../components/EventList.vue'
import RecordModal from '../components/RecordModal.vue'
import EventForm from '../components/EventForm.vue'
import PropagateModal from '../components/PropagateModal.vue'
import CalendarMonth from '../components/CalendarMonth.vue'
import CalendarWeek from '../components/CalendarWeek.vue'
import CalendarYear from '../components/CalendarYear.vue'
import SubscribeModal from '../components/SubscribeModal.vue'
import { List, CalendarDays, CalendarRange, Grid3x3, CalendarPlus } from 'lucide-vue-next'
import type { Event, EventView } from '../types'

const { db, selectedId, searchQuery, persist, assignments, currentView, setView } = useStore()
const { todayStr } = useToday()
const { show: toast } = useToast()
const route = useRoute()
const router = useRouter()

// Sync view from route meta
watch(() => route.meta.view, (v) => {
  if (v === 'calendar' || v === 'year' || v === 'week') setView(v as EventView)
}, { immediate: true })

// Week date from route param
const weekDate = ref<string | undefined>((route.params.date as string) || undefined)
watch(() => route.params.date, (d) => { if (route.meta.view === 'week') weekDate.value = (d as string) || undefined })

function onWeekDateChange(d: string) {
  weekDate.value = d
  router.replace(`/week/${d}`)
}

const editingEvent = ref<Event | null>(null)
const highlightDate = ref<string | null>(null)
const subscribeOpen = ref(false)

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

function newEvent(date?: string, time?: string) {
  const maxId = db.events.reduce((m, e) => Math.max(m, e.id), 0) + 1
  editingEvent.value = {
    id: maxId,
    date: date || todayStr.value,
    time: time || '10:00',
    title: '',
    category: db.categories?.[0]?.name || '',
    description: '',
    infoLink: '',
    promoSlides: [],
    expectedTasks: [],
    volunteers: 0,
  }
}

function onCalendarSwitchWeek(dateStr: string) {
  weekDate.value = dateStr
  setView('week')
  router.replace(`/week/${dateStr}`)
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

async function onMoveEvent(eventId: number, newDate: string, newTime?: string) {
  const ev = db.events.find(e => e.id === eventId)
  if (!ev) return
  if (ev.date === newDate && (!newTime || ev.time === newTime)) return
  ev.date = newDate
  if (newTime) ev.time = newTime
  await persist('events')
  toast(`Flyttad till ${newDate}${newTime ? ' ' + newTime : ''}`)
}
</script>

<template>
  <div class="flex flex-col flex-1 overflow-hidden relative">
    <div class="skeu-toolbar">
      <span class="text-[11px] text-[#666] hidden sm:inline" style="text-shadow: 0 1px 0 rgba(255,255,255,.7)">
        Totalt: <strong class="text-[#333]">{{ filteredEvents.length }}</strong>
      </span>
      <!-- View toggle -->
      <div class="skeu-segmented">
        <button
          v-for="v in views" :key="v.id"
          @click="setView(v.id)"
          class="skeu-seg-btn"
          :class="[
            currentView === v.id ? 'skeu-seg-active' : '',
            v.id === 'year' ? 'hidden sm:flex' : '',
          ]"
          :title="v.label"
        >
          <component :is="v.icon" :size="12" />
          <span class="hidden sm:inline">{{ v.label }}</span>
        </button>
      </div>
      <button
        @click="subscribeOpen = true"
        class="skeu-icon-btn"
        title="Prenumerera på kategori"
      >
        <CalendarPlus :size="13" />
      </button>
      <input
        v-model="searchQuery"
        type="search"
        placeholder="Sök..."
        class="skeu-search ml-auto"
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
      :highlight-date="highlightDate"
      @select="onSelect"
      @create="onCalendarSwitchWeek"
      @move="onMoveEvent"
    />

    <!-- Week calendar -->
    <CalendarWeek
      v-else-if="currentView === 'week'"
      :events="filteredEvents"
      :initial-date="weekDate"
      @select="onSelect"
      @create="(d: string, t?: string) => newEvent(d, t)"
      @move="onMoveEvent"
      @update:date="onWeekDateChange"
    />

    <!-- Year calendar -->
    <CalendarYear
      v-else-if="currentView === 'year'"
      :events="filteredEvents"
      @select-date="onCalendarSwitchWeek"
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

    <SubscribeModal :open="subscribeOpen" @close="subscribeOpen = false" />
  </div>
</template>

<style scoped>
.skeu-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  flex-shrink: 0;
  background: linear-gradient(180deg, #e8e8e8 0%, #d4d4d4 100%);
  border-bottom: 1px solid #bbb;
  box-shadow: 0 1px 0 rgba(255,255,255,.4) inset;
}
.skeu-segmented {
  display: flex;
  align-items: center;
  border-radius: 5px;
  overflow: hidden;
  border: 1px solid #aaa;
  box-shadow: 0 1px 2px rgba(0,0,0,.06) inset;
}
.skeu-seg-btn {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 3px 8px;
  font-size: 11px;
  cursor: pointer;
  border: none;
  border-right: 1px solid #aaa;
  color: #555;
  background: linear-gradient(180deg, #f4f4f4 0%, #ddd 100%);
  text-shadow: 0 1px 0 rgba(255,255,255,.7);
  transition: all 0.1s ease;
}
.skeu-seg-btn:last-child { border-right: none; }
.skeu-seg-btn:hover { background: linear-gradient(180deg, #fff 0%, #e8e8e8 100%); }
.skeu-seg-active {
  color: #fff !important;
  text-shadow: 0 -1px 0 rgba(0,0,0,.2) !important;
  background: linear-gradient(180deg, #6a5aed 0%, #4a3cc9 100%) !important;
  box-shadow: 0 1px 2px rgba(0,0,0,.15) inset;
}
.skeu-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 1px solid transparent;
  background: transparent;
  color: #777;
  cursor: pointer;
  transition: all 0.1s ease;
}
.skeu-icon-btn:hover {
  background: linear-gradient(180deg, #fff 0%, #e8e8e8 100%);
  border-color: #aaa;
  color: #444;
  box-shadow: 0 1px 0 rgba(255,255,255,.7) inset;
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
