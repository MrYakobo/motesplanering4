<script setup lang="ts">
import { computed, ref, nextTick, onMounted } from 'vue'
import { useCategories } from '../composables/useCategories'
import { useToday, localDateStr } from '../composables/useToday'
import type { Event } from '../types'

const props = defineProps<{ events: Event[] }>()
const emit = defineEmits<{ select: [id: number]; create: [date: string] }>()

const { catStyle } = useCategories()
const { today, todayStr } = useToday()

const scrollRef = ref<HTMLElement | null>(null)

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
  const el = scrollRef.value?.querySelector('.month-today') as HTMLElement
  if (el) {
    const section = el.closest('.month-section') as HTMLElement
    if (section) section.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }
}

onMounted(() => {
  nextTick(() => {
    const el = scrollRef.value?.querySelector('.month-today') as HTMLElement
    if (el) {
      const section = el.closest('.month-section') as HTMLElement
      if (section) section.scrollIntoView({ block: 'start', behavior: 'instant' })
    }
  })
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
              class="cal-day-col border-l border-gray-100 px-0.5 py-0.5 cursor-pointer transition-colors hover:bg-gray-50 overflow-hidden"
              :class="{
                'opacity-30': day.getMonth() !== m.month,
                'month-today ring-2 ring-accent ring-inset': dateStr(day) === todayStr,
                'bg-accent/5': dateStr(day) === todayStr,
              }"
              @click="emit('create', dateStr(day))"
            >
              <div
                class="text-[11px] font-medium mb-0.5 px-0.5"
                :class="dateStr(day) === todayStr ? 'text-accent font-bold' : 'text-gray-500'"
              >
                {{ day.getDate() === 1 && day.getMonth() === m.month
                  ? `1 ${monthNames[day.getMonth()].slice(0,3)}`
                  : day.getDate() }}
              </div>
              <div
                v-for="ev in (byDate[dateStr(day)] || []).slice(0, expandedDate === dateStr(day) ? 999 : MAX_VIS)"
                :key="ev.id"
                class="text-[10px] leading-tight rounded px-1 py-px mb-px truncate cursor-pointer hover:opacity-80"
                :style="catStyle(ev.category)"
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
