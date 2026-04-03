<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useCategories } from '../composables/useCategories'
import { useToday, localDateStr } from '../composables/useToday'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import type { Event } from '../types'

const props = defineProps<{ events: Event[]; initialDate?: string; flashInitial?: boolean }>()
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
const flashDate = ref('')

function triggerFlash(d: string) {
  flashDate.value = d
  setTimeout(() => { flashDate.value = '' }, 2000)
}

watch(() => props.initialDate, (d) => {
  if (d) {
    selectedDate.value = d
    if (props.flashInitial) triggerFlash(d)
  }
})
if (props.initialDate && props.flashInitial) {
  triggerFlash(props.initialDate)
}

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
  const m1 = monday.value
  const sun = new Date(m1)
  sun.setDate(m1.getDate() + 6)
  const sameMonth = m1.getMonth() === sun.getMonth()
  if (sameMonth) {
    return `${m1.getDate()}–${sun.getDate()} ${monthNames[m1.getMonth()]} ${m1.getFullYear()}`
  }
  return `${m1.getDate()} ${monthNames[m1.getMonth()]}–${sun.getDate()} ${monthNames[sun.getMonth()]} ${sun.getFullYear()}`
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
const GRID_HEIGHT = HOURS.length * 60 + 30 // extra padding at bottom

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
  const col = (e.currentTarget as HTMLElement).querySelector('.desk-col-inner') as HTMLElement
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
  const inner = grid.querySelector('.grid-inner') as HTMLElement
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
    if (dir > 0) prev(); else next()
    swipeDx.value = -dir * window.innerWidth * 0.4
    settling.value = false
    requestAnimationFrame(() => {
      settling.value = true
      swipeDx.value = 0
      setTimeout(() => { settling.value = false }, 300)
    })
  } else {
    settling.value = true
    swipeDx.value = 0
    setTimeout(() => { settling.value = false }, 300)
  }
}

const pillStyle = computed(() => {
  const base = selIdx.value >= 0 ? selIdx.value : 0
  const swipeShift = swipeDir.value === 'h' && !settling.value ? -swipeDx.value / (window.innerWidth || 400) : 0
  const frac = (base + swipeShift) / 7
  return {
    left: `calc(24px + (100% - 48px) * ${frac} + ((100% - 48px) / 7 - 30px) / 2)`,
    transition: settling.value || swipeDir.value !== 'h' ? 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
  }
})

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
  const col = (e.currentTarget as HTMLElement).querySelector('.desk-col-inner') as HTMLElement
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
  const inner = grid?.querySelector('.grid-inner') as HTMLElement
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

const gridRef = ref<HTMLElement | null>(null)
const mobileGridRef = ref<HTMLElement | null>(null)

// ── Off-screen event indicators ──────────────────────────────────────────────
const scrollTop = ref(0)
const scrollViewH = ref(400)

function onScrollGrid(e: globalThis.Event) {
  const el = e.target as HTMLElement
  scrollTop.value = el.scrollTop
  scrollViewH.value = el.clientHeight
}

const mobileAbove = computed(() => layoutEvents.value.filter(le => le.top + EVENT_HEIGHT < scrollTop.value).length)
const mobileBelow = computed(() => layoutEvents.value.filter(le => le.top > scrollTop.value + scrollViewH.value).length)

const desktopAbove = computed(() => {
  const st = scrollTop.value
  let count = 0
  for (const dl of weekLayouts.value) for (const le of dl.events) if (le.top + EVENT_HEIGHT < st) count++
  return count
})
const desktopBelow = computed(() => {
  const bottom = scrollTop.value + scrollViewH.value
  let count = 0
  for (const dl of weekLayouts.value) for (const le of dl.events) if (le.top > bottom) count++
  return count
})

function scrollToNearest(direction: 'up' | 'down', el: HTMLElement | null) {
  if (!el) return
  const st = el.scrollTop
  const vh = el.clientHeight
  const tops = [...layoutEvents.value.map(le => le.top)]
  for (const dl of weekLayouts.value) for (const le of dl.events) tops.push(le.top)
  if (direction === 'up') {
    const above = tops.filter(t => t + EVENT_HEIGHT < st).sort((a, b) => b - a)
    if (above.length) el.scrollTo({ top: above[0] - 10, behavior: 'smooth' })
  } else {
    const below = tops.filter(t => t > st + vh).sort((a, b) => a - b)
    if (below.length) el.scrollTo({ top: below[0] - 10, behavior: 'smooth' })
  }
}

function nowTop() {
  return (new Date().getHours() - 7) * 60 + new Date().getMinutes()
}

onMounted(() => {
  nextTick(() => {
    const h = Math.max(7, Math.min(new Date().getHours(), 20))
    const scrollTo = (h - 7) * 60 - 30
    if (mobileGridRef.value) {
      mobileGridRef.value.scrollTop = scrollTo
      mobileGridRef.value.addEventListener('scroll', onScrollGrid, { passive: true })
    }
    if (gridRef.value) {
      gridRef.value.scrollTop = scrollTo
      gridRef.value.addEventListener('scroll', onScrollGrid, { passive: true })
    }
    scrollTop.value = scrollTo
  })
})
onUnmounted(() => {
  mobileGridRef.value?.removeEventListener('scroll', onScrollGrid)
  gridRef.value?.removeEventListener('scroll', onScrollGrid)
})

const todayVisible = computed(() => days.value.some(d => ds(d) === todayStr.value))

const weekNum = computed(() => weekNumber(monday.value))

function navDown() { nextWeek() }
function navUp() { prevWeek() }

defineExpose({ goToday, todayVisible, prevWeek, nextWeek, weekNum, headerLabel, navUp, navDown })
</script>

<template>
  <div class="flex-1 flex flex-col overflow-hidden"
    @touchstart.passive="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
  >
    <!-- Desktop day labels -->
    <div class="hidden sm:flex shrink-0 border-b border-[#ccc] bg-gradient-to-b from-[#f0f0f0] to-[#e4e4e4]">
      <div class="w-10 shrink-0" />
      <div v-for="(day, i) in days" :key="'dh'+i" class="flex-1 min-w-0 text-center py-1 border-l border-[#ddd]">
        <div class="text-[10px] font-semibold uppercase text-[#888]">{{ dayLabels[i] }}</div>
        <div class="text-[15px] font-bold" :class="isToday(day) ? 'text-accent' : 'text-[#444]'">{{ day.getDate() }}</div>
      </div>
    </div>

    <!-- Mobile day strip -->
    <div class="flex sm:hidden shrink-0 relative border-b border-[#bbb] bg-gradient-to-b from-[#eee] to-[#ddd] shadow-[inset_0_1px_0_rgba(255,255,255,.4)]">
      <button @click="prev" class="flex items-center justify-center w-6 shrink-0 bg-transparent border-none text-[#888] cursor-pointer z-[1] active:text-accent">
        <ChevronLeft :size="14" />
      </button>
      <div class="absolute w-[30px] h-[30px] rounded-full top-[17px] z-0 bg-gradient-to-b from-accent to-[#4a3cc9] shadow-[inset_0_1px_0_rgba(255,255,255,.2),0_2px_8px_rgba(59,47,186,.4)] will-change-[left]" :style="pillStyle" />
      <div
        v-for="(day, i) in days" :key="ds(day)"
        class="flex-1 flex flex-col items-center py-1 pb-0.5 cursor-pointer min-w-0 relative z-[1]"
        @click="selectDayIdx(i)"
      >
        <span class="text-[10px] font-semibold uppercase transition-colors duration-200" :class="ds(day) === selectedDate ? 'text-accent' : 'text-[#888]'">{{ dayLabels[i] }}</span>
        <span class="text-[16px] font-bold w-7 h-7 flex items-center justify-center rounded-full transition-colors duration-200" :class="{
          'text-white': ds(day) === selectedDate,
          'text-accent font-extrabold': isToday(day) && ds(day) !== selectedDate,
          'text-[#444]': ds(day) !== selectedDate && !isToday(day),
          'flash-day': ds(day) === flashDate,
        }">{{ day.getDate() }}</span>
        <span class="w-[5px] h-[5px] rounded-full mt-px shrink-0 transition-colors duration-200" :class="hasEvents(day) ? 'bg-accent shadow-[0_0_2px_rgba(106,90,237,.5)]' : 'bg-transparent'" />
      </div>
      <button @click="next" class="flex items-center justify-center w-6 shrink-0 bg-transparent border-none text-[#888] cursor-pointer z-[1] active:text-accent">
        <ChevronRight :size="14" />
      </button>
    </div>

    <!-- Mobile all-day -->
    <div v-if="allDayEvents.length > 0" class="flex sm:hidden items-start gap-2 shrink-0 px-2 py-1 border-b border-[#ccc] bg-gradient-to-b from-[#f4f4f4] to-[#eaeaea]">
      <div class="text-[9px] text-[#999] pt-0.5 shrink-0 w-9 text-center">heldag</div>
      <div class="flex flex-wrap gap-0.5 flex-1 min-w-0">
        <div v-for="ev in allDayEvents" :key="ev.id"
          class="text-[11px] font-medium px-2 py-0.5 rounded cursor-pointer border border-black/5 truncate max-w-[200px]"
          :style="catStyle(ev.category)" @click.stop="emit('select', ev.id)">{{ ev.title }}</div>
      </div>
    </div>

    <!-- ═══ MOBILE: single day grid ═══ -->
    <div class="flex-1 relative overflow-hidden flex flex-col sm:hidden">
      <div ref="mobileGridRef" class="flex-1 overflow-y-auto overflow-x-hidden relative cursor-pointer bg-[#f9f9f9]" @click="onGridClick" @dragover="onDragOver" @drop="onDrop">
        <div class="relative min-h-full will-change-transform" :style="gridTransform">
          <div class="grid-inner relative" :style="{ height: GRID_HEIGHT + 'px' }">
            <!-- Hour rows -->
            <div v-for="h in HOURS" :key="h" class="absolute left-0 right-0 h-[60px]" :style="{ top: (h - 7) * 60 + 'px' }">
              <div class="absolute -top-[7px] left-0 w-10 text-[10px] text-[#999] text-center">{{ String(h).padStart(2, '0') }}:00</div>
              <div class="absolute top-0 left-[44px] right-0 h-px bg-[#d0d0d0]" />
              <div class="absolute top-[30px] left-[44px] right-0 h-px bg-[#e8e8e8]" />
            </div>
            <!-- Event area -->
            <div class="absolute top-0 bottom-0 left-[48px] right-2">
              <!-- Ghost -->
              <div v-if="ghostTop >= 0 && ghostDateStr === selectedDate" class="absolute left-0 right-0 rounded-md px-2 py-1 bg-accent/10 border-2 border-dashed border-accent/50 pointer-events-none z-[3] animate-ghost-pulse" :style="{ top: ghostTop + 'px', height: EVENT_HEIGHT + 'px' }">
                <span class="text-[11px] text-accent font-semibold mr-1.5">{{ ghostTime }}</span>
                <span class="text-[11px] text-accent opacity-70">Ny händelse</span>
              </div>
              <!-- Events -->
              <div
                v-for="le in layoutEvents" :key="le.ev.id"
                class="week-ev absolute p-1 px-1.5 rounded-md text-xs leading-snug overflow-hidden cursor-grab z-[1] border border-black/[.08] shadow-[inset_0_1px_0_rgba(255,255,255,.4),0_1px_3px_rgba(0,0,0,.08)] box-border hover:opacity-85"
                :style="{ ...catStyle(le.ev.category), top: le.top + 'px', height: EVENT_HEIGHT + 'px', left: (le.col / le.totalCols * 100) + '%', width: (1 / le.totalCols * 100) + '%' }"
                draggable="true"
                @dragstart="onDragStart($event, le.ev.id)"
                @dragend="onDragEnd"
                @click.stop="emit('select', le.ev.id)"
              >
                <span class="text-[11px] opacity-70 mr-1">{{ le.ev.time }}</span>
                <span class="font-semibold">{{ le.ev.title }}</span>
              </div>
            </div>
            <!-- Now line -->
            <div v-if="selectedDate === todayStr" class="absolute left-10 right-0 h-0.5 bg-red-500 z-[2] pointer-events-none" :style="{ top: nowTop() + 'px' }">
              <div class="absolute left-0 -top-1 w-2.5 h-2.5 rounded-full bg-red-500" />
            </div>
          </div>
        </div>
      </div>
      <!-- Off-screen indicators -->
      <button v-if="mobileAbove > 0" class="offscreen-pill top-1" @click="scrollToNearest('up', mobileGridRef)">↑ {{ mobileAbove }} ovan</button>
      <button v-if="mobileBelow > 0" class="offscreen-pill bottom-1" @click="scrollToNearest('down', mobileGridRef)">↓ {{ mobileBelow }} nedan</button>
    </div>

    <!-- ═══ DESKTOP: 7-column grid ═══ -->
    <div class="hidden sm:flex flex-1 relative overflow-hidden flex-col">
      <div ref="gridRef" class="flex-1 overflow-y-auto overflow-x-hidden flex flex-row bg-[#f9f9f9]">
        <!-- Time gutter -->
        <div class="w-10 shrink-0 relative sticky left-0 z-[2]" :style="{ height: GRID_HEIGHT + 'px' }">
          <div v-for="h in HOURS" :key="h" class="absolute left-0 w-10 text-[10px] text-[#999] text-center -mt-[7px]" :style="{ top: (h - 7) * 60 + 'px' }">
            {{ String(h).padStart(2, '0') }}:00
          </div>
        </div>
        <!-- Day columns -->
        <div
          v-for="dl in weekLayouts" :key="dl.date"
          class="flex-1 min-w-0 relative border-l border-[#ddd] cursor-pointer"
          :class="{ 'bg-accent/[.03]': dl.date === todayStr, 'flash-col': dl.date === flashDate }"
          :style="{ height: GRID_HEIGHT + 'px' }"
          @click="onDesktopGridClick($event, dl.date)"
          @dragover="onDesktopDragOver($event, dl.date)"
          @drop="onDesktopDrop($event, dl.date)"
          @dragleave="dragGhostDate = ''; dragGhostTop = -1"
        >
          <div class="desk-col-inner relative" :style="{ height: GRID_HEIGHT + 'px' }">
            <!-- Hour / half-hour lines -->
            <div v-for="h in HOURS" :key="h" class="absolute left-0 right-0 h-px bg-[#d0d0d0]" :style="{ top: (h - 7) * 60 + 'px' }" />
            <div v-for="h in HOURS" :key="'hf'+h" class="absolute left-0 right-0 h-px bg-[#e8e8e8]" :style="{ top: (h - 7) * 60 + 30 + 'px' }" />
            <!-- Events -->
            <div
              v-for="le in dl.events" :key="le.ev.id"
              class="week-ev absolute p-1 px-1.5 rounded-md text-xs leading-snug overflow-hidden cursor-grab z-[1] border border-black/[.08] shadow-[inset_0_1px_0_rgba(255,255,255,.4),0_1px_3px_rgba(0,0,0,.08)] box-border hover:opacity-85"
              :style="{ ...catStyle(le.ev.category), top: le.top + 'px', height: EVENT_HEIGHT + 'px', left: (le.col / le.totalCols * 100) + '%', width: (1 / le.totalCols * 100) + '%' }"
              draggable="true"
              @dragstart="onDragStart($event, le.ev.id)"
              @dragend="onDragEnd"
              @click.stop="emit('select', le.ev.id)"
            >
              <span class="text-[11px] opacity-70 mr-1">{{ le.ev.time }}</span>
              <span class="font-semibold">{{ le.ev.title }}</span>
            </div>
            <!-- Ghost (tap) -->
            <div v-if="ghostTop >= 0 && ghostDateStr === dl.date" class="absolute left-0 right-0 rounded-md px-2 py-1 bg-accent/10 border-2 border-dashed border-accent/50 pointer-events-none z-[3] animate-ghost-pulse" :style="{ top: ghostTop + 'px', height: EVENT_HEIGHT + 'px' }">
              <span class="text-[11px] text-accent font-semibold mr-1.5">{{ ghostTime }}</span>
              <span class="text-[11px] text-accent opacity-70">Ny händelse</span>
            </div>
            <!-- Ghost (drag) -->
            <div v-if="dragEventId && dragGhostDate === dl.date && dragGhostTop >= 0" class="absolute left-0.5 right-0.5 rounded-md px-1.5 py-1 bg-accent/15 border-2 border-accent/40 pointer-events-none z-[3]" :style="{ top: dragGhostTop + 'px', height: EVENT_HEIGHT + 'px' }">
              <span class="text-[11px] text-accent font-semibold">{{ String(Math.floor(dragGhostTop / 60) + 7).padStart(2, '0') }}:{{ String(dragGhostTop % 60).padStart(2, '0') }}</span>
            </div>
            <!-- Now line -->
            <div v-if="dl.date === todayStr" class="absolute left-0 right-0 h-0.5 bg-red-500 z-[2] pointer-events-none" :style="{ top: nowTop() + 'px' }">
              <div class="absolute -left-1 -top-[3px] w-2 h-2 rounded-full bg-red-500" />
            </div>
          </div>
        </div>
      </div>
      <!-- Off-screen indicators -->
      <button v-if="desktopAbove > 0" class="offscreen-pill top-1" @click="scrollToNearest('up', gridRef)">↑ {{ desktopAbove }} ovan</button>
      <button v-if="desktopBelow > 0" class="offscreen-pill bottom-1" @click="scrollToNearest('down', gridRef)">↓ {{ desktopBelow }} nedan</button>
    </div>
  </div>
</template>

<style scoped>
@keyframes ghost-pulse {
  0% { transform: scaleY(0.3); opacity: 0; }
  50% { transform: scaleY(1.05); opacity: 1; }
  100% { transform: scaleY(1); opacity: 1; }
}
.animate-ghost-pulse { animation: ghost-pulse 0.4s ease; }

@keyframes col-flash {
  0%, 20% { background: rgba(79, 70, 229, 0.25); }
  50% { background: rgba(79, 70, 229, 0.10); }
  70% { background: rgba(79, 70, 229, 0.18); }
  100% { background: transparent; }
}
.flash-col { animation: col-flash 2s ease-out; }

@keyframes day-flash {
  0%, 20% { box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.5); background: rgba(79, 70, 229, 0.15); }
  50% { box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.3); background: rgba(79, 70, 229, 0.08); }
  70% { box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.4); background: rgba(79, 70, 229, 0.12); }
  100% { box-shadow: 0 0 0 0 transparent; background: transparent; }
}
.flash-day { animation: day-flash 2s ease-out; }

.offscreen-pill {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  padding: 3px 12px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid rgba(106, 90, 237, 0.3);
  background: rgba(255, 255, 255, 0.95);
  color: #4f46e5;
  box-shadow: 0 2px 8px rgba(106, 90, 237, 0.2);
  backdrop-filter: blur(4px);
  white-space: nowrap;
}
.offscreen-pill:hover { background: #ede9fe; }
</style>
