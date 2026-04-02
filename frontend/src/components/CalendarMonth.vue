<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useCategories } from '../composables/useCategories'
import { useToday, localDateStr } from '../composables/useToday'
import type { Event } from '../types'

const props = defineProps<{ events: Event[]; highlightDate?: string | null }>()
const emit = defineEmits<{ select: [id: number]; create: [date: string]; move: [id: number, date: string] }>()

const { catStyle } = useCategories()
const { today, todayStr } = useToday()

const scrollRef = ref<HTMLElement | null>(null)
const dragEventId = ref<number | null>(null)
const dragOverDate = ref<string | null>(null)

function onDragStart(e: DragEvent, evId: number) {
  dragEventId.value = evId
  e.dataTransfer!.effectAllowed = 'move'
  e.dataTransfer!.setData('text/plain', String(evId))
  ;(e.target as HTMLElement).classList.add('opacity-40')
}

function onDragEnd(e: DragEvent) {
  ;(e.target as HTMLElement).classList.remove('opacity-40')
  dragEventId.value = null
  dragOverDate.value = null
}

function onDragOver(e: DragEvent, ds: string) {
  if (!dragEventId.value) return
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'move'
  dragOverDate.value = ds
}

function onDragLeave(_e: DragEvent, ds: string) {
  if (dragOverDate.value === ds) dragOverDate.value = null
}

function onDrop(e: DragEvent, ds: string) {
  e.preventDefault()
  if (!dragEventId.value) return
  emit('move', dragEventId.value, ds)
  dragEventId.value = null
  dragOverDate.value = null
}

const monthNames = ['januari','februari','mars','april','maj','juni','juli','augusti','september','oktober','november','december']
const dayHeaders = ['mån','tis','ons','tor','fre','lör','sön']

const byDate = computed(() => {
  const m: Record<string, Event[]> = {}
  props.events.forEach(ev => {
    if (!m[ev.date]) m[ev.date] = []
    m[ev.date].push(ev)
  })
  return m
})

// Generate months: 1 year before → 1 year after
const months = computed(() => {
  const result: { year: number; month: number }[] = []
  const startYear = today.value.getFullYear() - 1
  const endYear = today.value.getFullYear() + 1
  for (let yr = startYear; yr <= endYear; yr++) {
    for (let m = 0; m < 12; m++) {
      result.push({ year: yr, month: m })
    }
  }
  return result
})

function weeksForMonth(year: number, month: number) {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const startDay = (first.getDay() + 6) % 7
  const startDate = new Date(first)
  startDate.setDate(1 - startDay)

  const weeks: Date[] = []
  const d = new Date(startDate)
  while (true) {
    weeks.push(new Date(d))
    d.setDate(d.getDate() + 7)
    if (d > last && d.getDay() === 1) break
    if (weeks.length >= 6) break
  }
  return weeks
}

function daysForWeek(weekMon: Date) {
  const days: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekMon)
    d.setDate(weekMon.getDate() + i)
    days.push(d)
  }
  return days
}

function dateStr(d: Date) {
  return localDateStr(d)
}

function weekNumber(d: Date) {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

const MAX_VIS = 3

function goToday() {
  const idx = months.value.findIndex(m => m.year === today.value.getFullYear() && m.month === today.value.getMonth())
  if (idx >= 0) {
    const sections = scrollRef.value?.querySelectorAll('.month-section')
    if (sections?.[idx]) (sections[idx] as HTMLElement).scrollIntoView({ block: 'start', behavior: 'smooth' })
  }
}

onMounted(() => {
  setTimeout(() => {
    // If a highlight date is provided, scroll to that month
    const targetDate = props.highlightDate || null
    let targetYear: number, targetMonth: number
    if (targetDate) {
      const d = new Date(targetDate + 'T00:00:00')
      targetYear = d.getFullYear()
      targetMonth = d.getMonth()
    } else {
      targetYear = today.value.getFullYear()
      targetMonth = today.value.getMonth()
    }
    const idx = months.value.findIndex(m => m.year === targetYear && m.month === targetMonth)
    if (idx >= 0) {
      const sections = scrollRef.value?.querySelectorAll('.month-section')
      if (sections?.[idx]) (sections[idx] as HTMLElement).scrollIntoView({ block: 'start', behavior: 'instant' })
    }
  }, 50)
})

// Expand overflow for a date
const expandedDate = ref<string | null>(null)
function toggleExpand(ds: string) {
  expandedDate.value = expandedDate.value === ds ? null : ds
}
</script>

<template>
  <div class="flex-1 overflow-hidden flex flex-col relative">
    <div ref="scrollRef" class="flex-1 overflow-y-auto snap-y snap-mandatory">
      <div
        v-for="m in months" :key="`${m.year}-${m.month}`"
        class="month-section snap-start h-full min-h-full flex flex-col"
      >
        <div class="shrink-0 bg-white/95 backdrop-blur-sm px-3 py-1.5 text-sm font-bold text-gray-800 border-b border-gray-100 capitalize z-10">
          {{ monthNames[m.month] }} <span class="font-normal text-gray-400">{{ m.year }}</span>
        </div>
        <!-- Day headers -->
        <div class="shrink-0 cal-row text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
          <div class="cal-wk-col text-center py-1">v.</div>
          <div v-for="dh in dayHeaders" :key="dh" class="cal-day-col text-center py-1">{{ dh }}</div>
        </div>
        <!-- Weeks — fill remaining height equally -->
        <div class="flex-1 flex flex-col">
          <div
            v-for="(weekMon, wi) in weeksForMonth(m.year, m.month)" :key="wi"
            class="cal-row flex-1 border-b border-gray-50 min-h-0"
          >
            <div class="cal-wk-col text-[9px] text-gray-300 font-mono flex items-start justify-center pt-1">
              {{ weekNumber(weekMon) }}
            </div>
            <div
              v-for="day in daysForWeek(weekMon)" :key="dateStr(day)"
              class="cal-day-col bg-white/80 border-l border-t border-gray-200 px-0.5 py-0.5 cursor-pointer transition-colors hover:bg-gray-50 overflow-hidden"
              :class="{
                'opacity-30': day.getMonth() !== m.month,
                'month-today ring-2 ring-accent ring-inset': dateStr(day) === todayStr,
                'bg-accent/5': dateStr(day) === todayStr,
                'bg-accent/10 ring-2 ring-accent/30 ring-inset': dragOverDate === dateStr(day),
                'ring-2 ring-amber-400 ring-inset bg-amber-50': props.highlightDate === dateStr(day) && dateStr(day) !== todayStr,
              }"
              @click="emit('create', dateStr(day))"
              @dragover="onDragOver($event, dateStr(day))"
              @dragleave="onDragLeave($event, dateStr(day))"
              @drop="onDrop($event, dateStr(day))"
            >
              <div
                class="text-[11px] mb-0.5 px-0.5"
                :class="dateStr(day) === todayStr ? 'text-accent font-bold' : 'font-medium text-gray-500'"
              >
                {{ day.getDate() === 1 && day.getMonth() === m.month
                  ? `1 ${monthNames[day.getMonth()].slice(0,3)}`
                  : day.getDate() }}
              </div>
              <div
                v-for="ev in (byDate[dateStr(day)] || []).slice(0, expandedDate === dateStr(day) ? 999 : MAX_VIS)"
                :key="ev.id"
                class="text-[10px] leading-tight rounded px-1 py-px mb-px truncate cursor-grab hover:opacity-80"
                :style="catStyle(ev.category)"
                draggable="true"
                @dragstart="onDragStart($event, ev.id)"
                @dragend="onDragEnd"
                @click.stop="emit('select', ev.id)"
              >
                <span class="text-[9px] opacity-60 mr-0.5">{{ ev.time }}</span>{{ ev.title.replace(/<[^>]*>/g, '') }}
              </div>
              <div
                v-if="!expandedDate || expandedDate !== dateStr(day)"
                v-show="(byDate[dateStr(day)] || []).length > MAX_VIS"
                class="text-[9px] text-accent cursor-pointer hover:underline px-1"
                @click.stop="toggleExpand(dateStr(day))"
              >
                +{{ (byDate[dateStr(day)] || []).length - MAX_VIS }} till
              </div>
              <div
                v-if="expandedDate === dateStr(day) && (byDate[dateStr(day)] || []).length > MAX_VIS"
                class="text-[9px] text-gray-400 cursor-pointer hover:underline px-1"
                @click.stop="toggleExpand(dateStr(day))"
              >
                visa färre
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- Floating today button -->
    <button
      @click="goToday"
      class="absolute bottom-4 right-4 bg-accent text-white text-xs px-3 py-1.5 rounded-full shadow-lg cursor-pointer hover:bg-accent-hover transition-colors z-20"
    >
      ↕ Idag
    </button>
  </div>
</template>

<style scoped>
.cal-row {
  display: grid;
  grid-template-columns: 32px repeat(7, 1fr);
}
.cal-wk-col {
  min-width: 32px;
  max-width: 32px;
}
.cal-day-col {
  min-width: 0;
  width: 100%;
}
</style>
