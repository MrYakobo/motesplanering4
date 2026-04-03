<script setup lang="ts">
import { computed, ref, watch, onMounted, nextTick } from 'vue'
import { useCategories } from '../composables/useCategories'
import { useToday, localDateStr } from '../composables/useToday'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import type { Event } from '../types'

const props = defineProps<{ events: Event[]; initialDate?: string }>()
const emit = defineEmits<{
  select: [id: number]
  create: [date: string, time?: string]
  move: [id: number, date: string, time?: string]
  'update:date': [date: string]
}>()

const { catStyle } = useCategories()
const { todayStr } = useToday()

const dayLabels = ['mån', 'tis', 'ons', 'tor', 'fre', 'lör', 'sön']
const monthNames = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7)

const selectedDate = ref(props.initialDate || todayStr.value)
watch(() => props.initialDate, (d) => { if (d) selectedDate.value = d })

function parseDate(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const selectedDayObj = computed(() => parseDate(selectedDate.value))

const monday = computed(() => {
  const d = new Date(selectedDayObj.value)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
})

const days = computed(() =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.value)
    d.setDate(monday.value.getDate() + i)
    return d
  })
)

const selIdx = computed(() => days.value.findIndex(d => ds(d) === selectedDate.value))

const headerLabel = computed(() => {
  const d = selectedDayObj.value
  return `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`
})

function weekNumber(d: Date) {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

const byDate = computed(() => {
  const m: Record<string, Event[]> = {}
  props.events.forEach(ev => { (m[ev.date] ??= []).push(ev) })
  for (const k in m) m[k].sort((a, b) => (a.time || '').localeCompare(b.time || ''))
  return m
})

function hasEvents(d: Date) { return (byDate.value[ds(d)] || []).length > 0 }
function ds(d: Date) { return localDateStr(d) }
function isToday(d: Date) { return ds(d) === todayStr.value }

function setDay(dateStr: string) {
  selectedDate.value = dateStr
  emit('update:date', dateStr)
}
function selectDayIdx(i: number) { setDay(ds(days.value[i])) }
function goToday() { setDay(todayStr.value) }

function prev() { const d = new Date(selectedDayObj.value); d.setDate(d.getDate() - 1); setDay(ds(d)) }
function next() { const d = new Date(selectedDayObj.value); d.setDate(d.getDate() + 1); setDay(ds(d)) }
function prevWeek() { const d = new Date(monday.value); d.setDate(d.getDate() - 7); setDay(ds(d)) }
function nextWeek() { const d = new Date(monday.value); d.setDate(d.getDate() + 7); setDay(ds(d)) }

const EVENT_HEIGHT = 60

function eventTop(ev: Event) {
  if (!ev.time) return 0
  const [h, m] = ev.time.split(':').map(Number)
  return (h - 7) * 60 + (m || 0)
}
function eventInRange(ev: Event) {
  if (!ev.time) return false
  const h = parseInt(ev.time.split(':')[0])
  return h >= 7 && h < 22
}

const dayEvents = computed(() => byDate.value[selectedDate.value] || [])
const allDayEvents = computed(() => dayEvents.value.filter(e => !eventInRange(e)))

interface LayoutEvent { ev: Event; top: number; col: number; totalCols: number }

function layoutForDay(events: Event[]): LayoutEvent[] {
  const evs = events.filter(eventInRange).map(ev => ({ ev, top: eventTop(ev), end: eventTop(ev) + EVENT_HEIGHT }))
  evs.sort((a, b) => a.top - b.top)
  const clusters: typeof evs[] = []
  for (const e of evs) {
    const last = clusters[clusters.length - 1]
    if (last && e.top < Math.max(...last.map(x => x.end))) last.push(e)
    else clusters.push([e])
  }
  const result: LayoutEvent[] = []
  for (const cluster of clusters) {
    const cols: number[] = []
    for (const e of cluster) {
      let col = 0
      const placed = result.filter(r => cluster.some(c => c.ev === r.ev))
      while (placed.some(r => r.col === col && e.top < r.top + EVENT_HEIGHT && r.top < e.end)) col++
      cols.push(col)
      result.push({ ev: e.ev, top: e.top, col, totalCols: 0 })
    }
    const maxCol = Math.max(...cols) + 1
    for (let i = result.length - cluster.length; i < result.length; i++) result[i].totalCols = maxCol
  }
  return result
}

const layoutEvents = computed(() => layoutForDay(dayEvents.value))

const weekLayouts = computed(() =>
  days.value.map(d => ({
    date: ds(d),
    events: layoutForDay(byDate.value[ds(d)] || []),
    allDay: (byDate.value[ds(d)] || []).filter(e => !eventInRange(e)),
  }))
)

// Desktop click/drop helpers
const ghostDateStr = ref('')

function onDesktopGridClick(e: MouseEvent, dateStr: string) {
  if ((e.target as HTMLElement).closest('.week-ev')) return
  const col = (e.currentTarget as HTMLElement).querySelector('.week-desk-col-inner') as HTMLElement
  if (!col) return
  const relY = e.clientY - col.getBoundingClientRect().top
  const minutes = Math.max(0, Math.floor(relY / 30) * 30)
  const h = Math.floor(minutes / 60) + 7
  const m = minutes % 60
  if (h < 7 || h >= 22) return
  const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  ghostTop.value = (h - 7) * 60 + m
  ghostTime.value = time
  ghostDateStr.value = dateStr
  setTimeout(() => {
    emit('create', dateStr, time)
    ghostTop.value = -1
    ghostDateStr.value = ''
  }, 400)
}

function onDesktopDrop(e: DragEvent, dateStr: string) {
  e.preventDefault()
  if (!dragEventId.value) return
  const col = (e.currentTarget as HTMLElement)
  const relY = e.clientY - col.getBoundingClientRect().top
  const minutes = Math.max(0, Math.floor(relY / 30) * 30)
  const h = Math.floor(minutes / 60) + 7
  const m = minutes % 60
  if (h >= 7 && h < 22) {
    emit('move', dragEventId.value, dateStr, `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  } else {
    emit('move', dragEventId.value, dateStr)
  }
  dragEventId.value = null
}

// ── Tap ghost preview ────────────────────────────────────────────────────────
const ghostTop = ref(-1)
const ghostTime = ref('')

function onGridClick(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('.week-ev')) return
  const grid = mobileGridRef.value
  if (!grid) return
  const inner = grid.querySelector('.week-grid-inner') as HTMLElement
  if (!inner) return
  const relY = e.clientY - inner.getBoundingClientRect().top
  const minutes = Math.max(0, Math.floor(relY / 30) * 30)
  const h = Math.floor(minutes / 60) + 7
  const m = minutes % 60
  if (h < 7 || h >= 22) return
  const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  ghostTop.value = (h - 7) * 60 + m
  ghostTime.value = time
  ghostDateStr.value = selectedDate.value
  setTimeout(() => {
    emit('create', selectedDate.value, time)
    ghostTop.value = -1
    ghostDateStr.value = ''
  }, 400)
}

// ── Real-time swipe tracking ─────────────────────────────────────────────────
const touchStartX = ref(0)
const touchStartY = ref(0)
const swipeDir = ref<'none' | 'h' | 'v'>('none')
const swipeDx = ref(0)
const settling = ref(false)

function onTouchStart(e: TouchEvent) {
  touchStartX.value = e.touches[0].clientX
  touchStartY.value = e.touches[0].clientY
  swipeDir.value = 'none'
  swipeDx.value = 0
  settling.value = false
}
function onTouchMove(e: TouchEvent) {
  const dx = e.touches[0].clientX - touchStartX.value
  const dy = e.touches[0].clientY - touchStartY.value
  if (swipeDir.value === 'none' && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
    swipeDir.value = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
  }
  if (swipeDir.value === 'h') {
    e.preventDefault()
    swipeDx.value = dx
  }
}
function onTouchEnd() {
  if (swipeDir.value !== 'h') { swipeDx.value = 0; swipeDir.value = 'none'; return }
  const committed = Math.abs(swipeDx.value) > 60
  const dir = swipeDx.value > 0 ? 1 : -1
  swipeDir.value = 'none'

  if (committed) {
    // Switch day immediately, then animate new content in from the edge
    if (dir > 0) prev(); else next()
    // Start off-screen on the incoming side
    swipeDx.value = -dir * window.innerWidth * 0.4
    settling.value = false
    requestAnimationFrame(() => {
      settling.value = true
      swipeDx.value = 0
      setTimeout(() => { settling.value = false }, 300)
    })
  } else {
    // Snap back
    settling.value = true
    swipeDx.value = 0
    setTimeout(() => { settling.value = false }, 300)
  }
}

// Pill: follows finger during swipe, springs on settle
const pillStyle = computed(() => {
  const base = selIdx.value >= 0 ? selIdx.value : 0
  const swipeShift = swipeDir.value === 'h' && !settling.value ? -swipeDx.value / (window.innerWidth || 400) : 0
  const frac = (base + swipeShift) / 7
  return {
    left: `calc(${frac * 100}% + (100% / 7 - 30px) / 2)`,
    transition: settling.value || swipeDir.value !== 'h' ? 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
  }
})

// Grid content transform
const gridTransform = computed(() => ({
  transform: `translateX(${swipeDx.value}px)`,
  transition: settling.value ? 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none',
}))

// Drag and drop
const dragEventId = ref<number | null>(null)
const dragGhostDate = ref('')
const dragGhostTop = ref(-1)

function onDragStart(e: DragEvent, evId: number) {
  dragEventId.value = evId
  e.dataTransfer!.effectAllowed = 'move'
  e.dataTransfer!.setData('text/plain', String(evId))
}
function onDragEnd() {
  dragEventId.value = null
  dragGhostDate.value = ''
  dragGhostTop.value = -1
}
function onDragOver(e: DragEvent) { if (dragEventId.value) e.preventDefault() }

function onDesktopDragOver(e: DragEvent, dateStr: string) {
  if (!dragEventId.value) return
  e.preventDefault()
  const col = (e.currentTarget as HTMLElement).querySelector('.week-desk-col-inner') as HTMLElement
  if (!col) return
  const relY = e.clientY - col.getBoundingClientRect().top
  const minutes = Math.max(0, Math.floor(relY / 30) * 30)
  dragGhostDate.value = dateStr
  dragGhostTop.value = minutes
}
function onDrop(e: DragEvent) {
  e.preventDefault()
  if (!dragEventId.value) return
  const grid = gridRef.value
  const inner = grid?.querySelector('.week-grid-inner') as HTMLElement
  if (inner) {
    const relY = e.clientY - inner.getBoundingClientRect().top
    const minutes = Math.max(0, Math.floor(relY / 30) * 30)
    const h = Math.floor(minutes / 60) + 7
    const m = minutes % 60
    if (h >= 7 && h < 22) {
      const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      emit('move', dragEventId.value, selectedDate.value, time)
      dragEventId.value = null
      return
    }
  }
  emit('move', dragEventId.value, selectedDate.value)
  dragEventId.value = null
}

const showTodayBtn = computed(() => selectedDate.value !== todayStr.value)

const gridRef = ref<HTMLElement | null>(null)
const mobileGridRef = ref<HTMLElement | null>(null)
onMounted(() => {
  nextTick(() => {
    const h = Math.max(7, Math.min(new Date().getHours(), 20))
    const scrollTo = (h - 7) * 60 - 30
    if (mobileGridRef.value) mobileGridRef.value.scrollTop = scrollTo
    if (gridRef.value) gridRef.value.scrollTop = scrollTo
  })
})
</script>

<template>
  <div class="week-root"
    @touchstart.passive="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
  >
    <!-- Header (desktop only: week nav) -->
    <div class="week-header hidden sm:flex">
      <button @click="prevWeek" class="week-nav-btn"><ChevronLeft :size="16" /></button>
      <div class="week-header-center">
        <span class="week-header-label">Vecka {{ weekNumber(monday) }}</span>
        <span class="week-header-wk">{{ headerLabel }}</span>
      </div>
      <button @click="nextWeek" class="week-nav-btn"><ChevronRight :size="16" /></button>
      <button @click="goToday" class="week-today-btn" :class="{ 'week-today-btn-disabled': !showTodayBtn }">Idag</button>
    </div>

    <!-- Day strip (mobile only) -->
    <div class="week-days-bar sm:hidden">
      <button @click="prev" class="week-strip-nav"><ChevronLeft :size="14" /></button>
      <div class="week-sel-pill" :style="pillStyle" />
      <div
        v-for="(day, i) in days" :key="ds(day)"
        class="week-day-col"
        @click="selectDayIdx(i)"
      >
        <span class="week-day-label" :class="{ 'week-day-label-sel': ds(day) === selectedDate }">{{ dayLabels[i] }}</span>
        <span class="week-day-num" :class="{
          'week-day-num-on': ds(day) === selectedDate,
          'week-day-num-today-idle': isToday(day) && ds(day) !== selectedDate,
        }">{{ day.getDate() }}</span>
        <span class="week-day-dot" :class="{ 'week-day-dot-vis': hasEvents(day) }" />
      </div>
      <button @click="next" class="week-strip-nav"><ChevronRight :size="14" /></button>
    </div>

    <!-- All-day (mobile) -->
    <div v-if="allDayEvents.length > 0" class="week-allday sm:hidden">
      <div class="week-allday-label">heldag</div>
      <div class="week-allday-list">
        <div v-for="ev in allDayEvents" :key="ev.id" class="week-allday-ev" :style="catStyle(ev.category)" @click.stop="emit('select', ev.id)">{{ ev.title }}</div>
      </div>
    </div>

    <!-- Mobile: single day grid -->
    <div ref="mobileGridRef" class="week-grid sm:hidden" @click="onGridClick" @dragover="onDragOver" @drop="onDrop">
      <div class="week-grid-content" :style="gridTransform">
        <div class="week-grid-inner" :style="{ height: HOURS.length * 60 + 'px' }">
          <div v-for="h in HOURS" :key="h" class="week-hour-row" :style="{ top: (h - 7) * 60 + 'px' }">
            <div class="week-gutter-time">{{ String(h).padStart(2, '0') }}:00</div>
            <div class="week-hour-line" />
            <div class="week-half-line" />
          </div>

          <div class="week-ev-area">
            <div v-if="ghostTop >= 0" class="week-ghost" :style="{ top: ghostTop + 'px', height: EVENT_HEIGHT + 'px' }">
              <span class="week-ghost-time">{{ ghostTime }}</span>
              <span class="week-ghost-label">Ny händelse</span>
            </div>

            <div
              v-for="le in layoutEvents" :key="le.ev.id"
              class="week-ev"
              :style="{
                ...catStyle(le.ev.category),
                top: le.top + 'px',
                height: EVENT_HEIGHT + 'px',
                left: (le.col / le.totalCols * 100) + '%',
                width: (1 / le.totalCols * 100) + '%',
              }"
              draggable="true"
              @dragstart="onDragStart($event, le.ev.id)"
              @dragend="onDragEnd"
              @click.stop="emit('select', le.ev.id)"
            >
              <span class="week-ev-time">{{ le.ev.time }}</span>
              <span class="week-ev-title">{{ le.ev.title }}</span>
            </div>
          </div>

          <div v-if="selectedDate === todayStr" class="week-now" :style="{ top: ((new Date().getHours() - 7) * 60 + new Date().getMinutes()) + 'px' }" />
        </div>
      </div>
    </div>

    <!-- Desktop: 7-column grid -->
    <div ref="gridRef" class="week-desk hidden sm:flex">
      <!-- Time gutter -->
      <div class="week-desk-gutter" :style="{ height: HOURS.length * 60 + 'px' }">
        <div v-for="h in HOURS" :key="h" class="week-desk-gutter-time" :style="{ top: (h - 7) * 60 + 'px' }">
          {{ String(h).padStart(2, '0') }}:00
        </div>
      </div>
      <!-- Day columns -->
      <div
        v-for="dl in weekLayouts" :key="dl.date"
        class="week-desk-col"
        :class="{ 'week-desk-col-today': dl.date === todayStr }"
        @click="onDesktopGridClick($event, dl.date)"
        @dragover="onDesktopDragOver($event, dl.date)"
        @drop="onDesktopDrop($event, dl.date)"
        @dragleave="dragGhostDate = ''; dragGhostTop = -1"
      >
        <div class="week-desk-col-inner" :style="{ height: HOURS.length * 60 + 'px' }">
          <!-- Hour lines -->
          <div v-for="h in HOURS" :key="h" class="week-desk-hour" :style="{ top: (h - 7) * 60 + 'px' }" />
          <div v-for="h in HOURS" :key="'hf'+h" class="week-desk-half" :style="{ top: (h - 7) * 60 + 30 + 'px' }" />
          <!-- Events -->
          <div
            v-for="le in dl.events" :key="le.ev.id"
            class="week-ev"
            :style="{
              ...catStyle(le.ev.category),
              top: le.top + 'px',
              height: EVENT_HEIGHT + 'px',
              left: (le.col / le.totalCols * 100) + '%',
              width: (1 / le.totalCols * 100) + '%',
            }"
            draggable="true"
            @dragstart="onDragStart($event, le.ev.id)"
            @dragend="onDragEnd"
            @click.stop="emit('select', le.ev.id)"
          >
            <span class="week-ev-time">{{ le.ev.time }}</span>
            <span class="week-ev-title">{{ le.ev.title }}</span>
          </div>
          <!-- Ghost preview (tap) -->
          <div v-if="ghostTop >= 0 && ghostDateStr === dl.date" class="week-ghost" :style="{ top: ghostTop + 'px', height: EVENT_HEIGHT + 'px' }">
            <span class="week-ghost-time">{{ ghostTime }}</span>
            <span class="week-ghost-label">Ny händelse</span>
          </div>
          <!-- Ghost preview (drag) -->
          <div v-if="dragEventId && dragGhostDate === dl.date && dragGhostTop >= 0" class="week-drag-ghost" :style="{ top: dragGhostTop + 'px', height: EVENT_HEIGHT + 'px' }">
            <span class="week-ghost-time">{{ String(Math.floor(dragGhostTop / 60) + 7).padStart(2, '0') }}:{{ String(dragGhostTop % 60).padStart(2, '0') }}</span>
          </div>
          <!-- Now line -->
          <div v-if="dl.date === todayStr" class="week-now-desk" :style="{ top: ((new Date().getHours() - 7) * 60 + new Date().getMinutes()) + 'px' }" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.week-root { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

.week-header {
  display: flex; align-items: center; gap: 4px; padding: 6px 8px; flex-shrink: 0;
  background: linear-gradient(180deg, #e8e8e8 0%, #d4d4d4 100%);
  border-bottom: 1px solid #bbb;
  box-shadow: 0 1px 0 rgba(255,255,255,.4) inset;
}
.week-nav-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 5px;
  border: 1px solid transparent; background: transparent; color: #555; cursor: pointer;
  transition: all 0.1s ease;
}
.week-nav-btn:hover {
  background: linear-gradient(180deg, #fff 0%, #e8e8e8 100%);
  border-color: #aaa; box-shadow: 0 1px 0 rgba(255,255,255,.7) inset;
}
.week-header-center { flex: 1; text-align: center; }
.week-header-label { font-size: 13px; font-weight: 600; color: #333; text-shadow: 0 1px 0 rgba(255,255,255,.7); }
.week-header-wk { font-size: 11px; color: #888; margin-left: 6px; text-shadow: 0 1px 0 rgba(255,255,255,.5); }
.week-today-btn {
  padding: 3px 10px; border-radius: 5px; font-size: 12px; font-weight: 600; cursor: pointer;
  color: #fff; border: 1px solid rgba(0,0,0,.2);
  background: linear-gradient(180deg, #6a5aed 0%, #4a3cc9 100%);
  box-shadow: 0 1px 0 rgba(255,255,255,.2) inset; text-shadow: 0 -1px 0 rgba(0,0,0,.15);
}
.week-today-btn:hover { background: linear-gradient(180deg, #7b6cf5 0%, #5544d4 100%); }
.week-today-btn-disabled {
  opacity: 0.35;
  pointer-events: none;
}

/* Day strip */
.week-days-bar {
  display: flex; flex-shrink: 0; position: relative;
  background: linear-gradient(180deg, #eee 0%, #ddd 100%);
  border-bottom: 1px solid #bbb;
  box-shadow: 0 1px 0 rgba(255,255,255,.4) inset;
}
.week-sel-pill {
  position: absolute; width: 30px; height: 30px; border-radius: 50%;
  top: 18px; z-index: 0;
  background: linear-gradient(180deg, #6a5aed 0%, #4a3cc9 100%);
  box-shadow: 0 1px 0 rgba(255,255,255,.2) inset, 0 2px 8px rgba(59,47,186,.4);
  will-change: left;
}
.week-day-col {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  padding: 4px 0 3px; cursor: pointer; min-width: 0; position: relative; z-index: 1;
}
.week-strip-nav {
  display: flex; align-items: center; justify-content: center;
  width: 24px; flex-shrink: 0; background: none; border: none;
  color: #888; cursor: pointer; z-index: 1;
}
.week-strip-nav:active { color: #6a5aed; }
.week-day-label {
  font-size: 10px; font-weight: 600; text-transform: uppercase; color: #888;
  text-shadow: 0 1px 0 rgba(255,255,255,.7); transition: color 0.2s ease;
}
.week-day-label-sel { color: #6a5aed; }
.week-day-num {
  font-size: 16px; font-weight: 700; color: #444;
  width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
  border-radius: 50%; text-shadow: 0 1px 0 rgba(255,255,255,.5); transition: color 0.2s ease;
}
.week-day-num-on { color: #fff; text-shadow: none; }
.week-day-num-today-idle { color: #6a5aed; font-weight: 800; }
.week-day-dot { width: 5px; height: 5px; border-radius: 50%; margin-top: 2px; background: transparent; transition: background 0.2s ease; }
.week-day-dot-vis { background: #6a5aed; box-shadow: 0 0 2px rgba(106,90,237,.5); }

/* All-day */
.week-allday {
  display: flex; align-items: flex-start; gap: 8px; flex-shrink: 0; padding: 4px 8px;
  border-bottom: 1px solid #ccc; background: linear-gradient(180deg, #f4f4f4 0%, #eaeaea 100%);
}
.week-allday-label { font-size: 9px; color: #999; padding-top: 2px; flex-shrink: 0; width: 36px; text-align: center; text-shadow: 0 1px 0 rgba(255,255,255,.5); }
.week-allday-list { display: flex; flex-wrap: wrap; gap: 3px; flex: 1; min-width: 0; }
.week-allday-ev {
  font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 4px; cursor: pointer;
  border: 1px solid rgba(0,0,0,.06); box-shadow: 0 1px 0 rgba(255,255,255,.4) inset;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;
}

/* Time grid */
.week-grid { flex: 1; overflow-y: auto; overflow-x: hidden; position: relative; cursor: pointer; }
.week-grid-content { position: relative; min-height: 100%; will-change: transform; }
.week-grid-inner { position: relative; min-height: 100%; }
.week-hour-row { position: absolute; left: 0; right: 0; height: 60px; }
.week-gutter-time { position: absolute; top: -7px; left: 0; width: 40px; font-size: 10px; color: #999; text-align: center; text-shadow: 0 1px 0 rgba(255,255,255,.5); }
.week-hour-line { position: absolute; top: 0; left: 44px; right: 0; height: 1px; background: #d0d0d0; }
.week-half-line { position: absolute; top: 30px; left: 44px; right: 0; height: 1px; background: #e8e8e8; }

.week-ev-area { position: absolute; top: 0; left: 48px; right: 8px; bottom: 0; }

/* Ghost preview */
.week-ghost {
  position: absolute; left: 0; right: 0;
  border-radius: 6px; padding: 4px 8px;
  background: rgba(106, 90, 237, 0.12);
  border: 2px dashed rgba(106, 90, 237, 0.5);
  box-sizing: border-box;
  animation: ghostPulse 0.4s ease;
  pointer-events: none;
  z-index: 3;
}
.week-ghost-time { font-size: 11px; color: #6a5aed; font-weight: 600; margin-right: 6px; }
.week-ghost-label { font-size: 11px; color: #6a5aed; opacity: 0.7; }

.week-drag-ghost {
  position: absolute; left: 2px; right: 2px;
  border-radius: 6px; padding: 4px 6px;
  background: rgba(106, 90, 237, 0.15);
  border: 2px solid rgba(106, 90, 237, 0.4);
  box-sizing: border-box;
  pointer-events: none;
  z-index: 3;
}
@keyframes ghostPulse {
  0% { transform: scaleY(0.3); opacity: 0; }
  50% { transform: scaleY(1.05); opacity: 1; }
  100% { transform: scaleY(1); opacity: 1; }
}

.week-ev {
  position: absolute; padding: 4px 6px; border-radius: 6px; font-size: 12px; line-height: 1.4;
  overflow: hidden; cursor: grab; z-index: 1;
  border: 1px solid rgba(0,0,0,.08);
  box-shadow: 0 1px 0 rgba(255,255,255,.4) inset, 0 1px 3px rgba(0,0,0,.08);
  box-sizing: border-box;
}
.week-ev:hover { opacity: 0.85; }
.week-ev-time { font-size: 11px; opacity: 0.7; margin-right: 4px; }
.week-ev-title { font-weight: 600; }

.week-now {
  position: absolute; left: 40px; right: 0; height: 2px; background: #e74c3c;
  z-index: 2; pointer-events: none;
}
.week-now::before {
  content: ''; position: absolute; left: 0; top: -4px;
  width: 10px; height: 10px; border-radius: 50%; background: #e74c3c;
}

/* Desktop 7-column grid */
.week-desk {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  flex-direction: row;
}
.week-desk-gutter {
  width: 40px;
  flex-shrink: 0;
  position: relative;
  position: sticky;
  left: 0;
  z-index: 2;
}
.week-desk-gutter-time {
  position: absolute;
  left: 0;
  width: 40px;
  font-size: 10px;
  color: #999;
  text-align: center;
  margin-top: -7px;
  text-shadow: 0 1px 0 rgba(255,255,255,.5);
}
.week-desk-col {
  flex: 1;
  min-width: 0;
  position: relative;
  border-left: 1px solid #ddd;
  cursor: pointer;
}
.week-desk-col-today {
  background: rgba(106, 90, 237, 0.03);
}
.week-desk-col-inner {
  position: relative;
}
.week-desk-hour {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: #d0d0d0;
}
.week-desk-half {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: #e8e8e8;
}
.week-now-desk {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: #e74c3c;
  z-index: 2;
  pointer-events: none;
}
.week-now-desk::before {
  content: '';
  position: absolute;
  left: -4px;
  top: -3px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e74c3c;
}
</style>
