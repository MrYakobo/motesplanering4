<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
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
import { CircleDot, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import type { Event, EventView } from '../types'

const { db, selectedId, searchQuery, persist, assignments, currentView, setView } = useStore()
const { todayStr } = useToday()
const { show: toast } = useToast()
const route = useRoute()
const router = useRouter()

// Sync view from route meta
watch(() => route.meta.view, (v) => {
  if (v === 'list' || v === 'calendar' || v === 'year' || v === 'week') setView(v as EventView)
}, { immediate: true })

// Week date from route param
const weekDate = ref<string | undefined>((route.params.date as string) || undefined)
watch(() => route.params.date, (d) => { if (route.meta.view === 'week') weekDate.value = (d as string) || undefined })

function onWeekDateChange(d: string) {
  weekDate.value = d
  router.replace(`/events/week/${d}`)
}

const editingEvent = ref<Event | null>(null)
const highlightDate = ref<string | null>(null)
const monthRef = ref<InstanceType<typeof CalendarMonth> | null>(null)
const weekRef = ref<InstanceType<typeof CalendarWeek> | null>(null)
const listRef = ref<InstanceType<typeof EventList> | null>(null)
const yearRef = ref<InstanceType<typeof CalendarYear> | null>(null)

function goToday() {
  if (currentView.value === 'list') listRef.value?.goToday()
  else if (currentView.value === 'calendar') monthRef.value?.goToday()
  else if (currentView.value === 'week') weekRef.value?.goToday()
  else if (currentView.value === 'year') yearRef.value?.goToday()
}

const todayIsVisible = computed(() => {
  const view = currentView.value
  if (view === 'list') return listRef.value?.todayVisible ?? true
  if (view === 'calendar') return monthRef.value?.todayVisible ?? true
  if (view === 'week') return weekRef.value?.todayVisible ?? true
  if (view === 'year') return yearRef.value?.todayVisible ?? true
  return true
})

function navPrev() {
  if (currentView.value === 'week') weekRef.value?.prevWeek()
  else if (currentView.value === 'calendar') monthRef.value?.prevMonth()
  else if (currentView.value === 'year') yearRef.value?.prevYear()
}
function navNext() {
  if (currentView.value === 'week') weekRef.value?.nextWeek()
  else if (currentView.value === 'calendar') monthRef.value?.nextMonth()
  else if (currentView.value === 'year') yearRef.value?.nextYear()
}
const navLabel = computed(() => {
  const view = currentView.value
  if (view === 'week') return weekRef.value?.weekNum != null ? `Vecka ${weekRef.value.weekNum}` : ''
  if (view === 'calendar') return monthRef.value?.navLabel ?? ''
  if (view === 'year') return yearRef.value?.navLabel ?? ''
  return ''
})
const hasNav = computed(() => currentView.value !== 'list')

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

const flashWeek = ref(false)

function onCalendarSwitchWeek(dateStr: string) {
  weekDate.value = dateStr
  flashWeek.value = true
  router.push(`/events/week/${dateStr}`)
}

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

function activeRef() {
  if (currentView.value === 'list') return listRef.value
  if (currentView.value === 'calendar') return monthRef.value
  if (currentView.value === 'week') return weekRef.value
  if (currentView.value === 'year') return yearRef.value
  return null
}

function onKeydown(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement).tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
  if (currentView.value === 'list') return
  if (e.key === 'j' || e.key === 'ArrowDown') {
    e.preventDefault()
    activeRef()?.navDown()
  } else if (e.key === 'k' || e.key === 'ArrowUp') {
    e.preventDefault()
    activeRef()?.navUp()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="flex flex-col flex-1 overflow-hidden relative">
    <div class="skeu-toolbar">
      <!-- Today -->
      <button
        @click="goToday"
        class="skeu-today-btn"
        :class="{ 'skeu-today-btn-disabled': todayIsVisible }"
        title="Gå till idag"
      >
        <CircleDot :size="12" />
        <span class="hidden sm:inline">Idag</span>
      </button>
      <!-- Prev / Next / Label -->
      <template v-if="hasNav">
        <button @click="navPrev" class="skeu-icon-btn"><ChevronLeft :size="14" /></button>
        <button @click="navNext" class="skeu-icon-btn"><ChevronRight :size="14" /></button>
        <span class="text-[13px] font-semibold text-[#333] whitespace-nowrap capitalize hidden sm:inline" style="text-shadow: 0 1px 0 rgba(255,255,255,.7)">{{ navLabel }}</span>
      </template>
      <span v-else class="text-[11px] text-[#666] hidden sm:inline" style="text-shadow: 0 1px 0 rgba(255,255,255,.7)">
        {{ filteredEvents.length }} händelser
      </span>
      <!-- Spacer -->
      <div class="flex-1" />
      <!-- Search -->
      <input
        v-model="searchQuery"
        type="search"
        placeholder="Sök..."
        class="skeu-search"
      />
    </div>

    <!-- List view -->
    <EventList
      v-if="currentView === 'list'"
      ref="listRef"
      :events="filteredEvents"
      :selected-id="selectedId"
      @select="onSelect"
    />

    <!-- Month calendar -->
    <CalendarMonth
      v-else-if="currentView === 'calendar'"
      ref="monthRef"
      :events="filteredEvents"
      :highlight-date="highlightDate"
      @select="onSelect"
      @create="onCalendarSwitchWeek"
      @move="onMoveEvent"
    />

    <!-- Week calendar -->
    <CalendarWeek
      v-else-if="currentView === 'week'"
      ref="weekRef"
      :events="filteredEvents"
      :initial-date="weekDate"
      :flash-initial="flashWeek"
      @select="onSelect"
      @create="(d: string, t?: string) => newEvent(d, t)"
      @move="onMoveEvent"
      @update:date="onWeekDateChange"
      @vue:mounted="flashWeek = false"
    />

    <!-- Year calendar -->
    <CalendarYear
      v-else-if="currentView === 'year'"
      ref="yearRef"
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
  </div>
</template>

<style scoped>
</style>
