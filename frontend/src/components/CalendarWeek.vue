<script setup lang="ts">
import { computed, ref, nextTick, onMounted } from 'vue'
import { useCategories } from '../composables/useCategories'
import { useToday } from '../composables/useToday'
import type { Event } from '../types'

const props = defineProps<{ events: Event[] }>()
const emit = defineEmits<{ select: [id: number]; create: [date: string] }>()

const { catStyle } = useCategories()
const { today, todayStr } = useToday()

const scrollRef = ref<HTMLElement | null>(null)
const dayLabels = ['mån', 'tis', 'ons', 'tor', 'fre', 'lör', 'sön']
const monthNames = ['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec']

const byDate = computed(() => {
  const m: Record<string, Event[]> = {}
  props.events.forEach(ev => {
    if (!m[ev.date]) m[ev.date] = []
    m[ev.date].push(ev)
  })
  return m
})

function dateStr(d: Date) { return d.toISOString().slice(0, 10) }

function weekNumber(d: Date) {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

// Generate all weeks from 1 year before to 1 year after
const weeks = computed(() => {
  const now = today.value
  const start = new Date(now.getFullYear() - 1, 0, 1)
  // Align to Monday
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  const end = new Date(now.getFullYear() + 1, 11, 31)
  end.setDate(end.getDate() + (7 - ((end.getDay() + 6) % 7)) % 7)

  const result: Date[] = []
  const d = new Date(start)
  while (d <= end) {
    result.push(new Date(d))
    d.setDate(d.getDate() + 7)
  }
  return result
})

function weekRange(mon: Date) {
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  const monM = monthNames[mon.getMonth()]
  const sunM = monthNames[sun.getMonth()]
  if (monM === sunM) return `${mon.getDate()}–${sun.getDate()} ${monM} ${mon.getFullYear()}`
  return `${mon.getDate()} ${monM} – ${sun.getDate()} ${sunM} ${sun.getFullYear()}`
}

function daysForWeek(mon: Date) {
  const days: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    days.push(d)
  }
  return days
}

function goToday() {
  const el = scrollRef.value?.querySelector('.week-today') as HTMLElement
  if (el) {
    const section = el.closest('.week-section') as HTMLElement
    if (section) section.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }
}

onMounted(() => {
  nextTick(() => {
    const el = scrollRef.value?.querySelector('.week-today') as HTMLElement
    if (el) {
      const section = el.closest('.week-section') as HTMLElement
      if (section) section.scrollIntoView({ block: 'start', behavior: 'instant' })
    }
  })
})
</script>

<template>
  <div class="flex-1 overflow-hidden flex flex-col relative">
    <div ref="scrollRef" class="flex-1 overflow-y-auto">
      <div
        v-for="mon in weeks" :key="dateStr(mon)"
        class="week-section border-b border-gray-200"
      >
        <div class="sticky top-0 z-10 bg-white/95 backdrop-blur-sm px-3 py-1.5 text-sm font-bold text-gray-800 border-b border-gray-100">
          Vecka {{ weekNumber(mon) }}
          <span class="font-normal text-gray-400 text-xs ml-1">{{ weekRange(mon) }}</span>
        </div>
        <div class="grid grid-cols-7 min-h-[120px]">
          <div
            v-for="(day, i) in daysForWeek(mon)" :key="dateStr(day)"
            class="border-l border-gray-100 first:border-l-0 px-1.5 py-1.5 cursor-pointer hover:bg-gray-50 transition-colors"
            :class="{
              'week-today bg-accent/5': dateStr(day) === todayStr,
            }"
            @click="emit('create', dateStr(day))"
          >
            <div
              class="text-xs font-semibold mb-1"
              :class="dateStr(day) === todayStr ? 'text-accent' : 'text-gray-500'"
            >
              {{ dayLabels[i] }}
              <span class="ml-0.5" :class="dateStr(day) === todayStr ? 'text-accent' : 'text-gray-400'">{{ day.getDate() }}</span>
            </div>
            <div
              v-for="ev in (byDate[dateStr(day)] || []).sort((a, b) => (a.time || '').localeCompare(b.time || ''))"
              :key="ev.id"
              class="text-[11px] rounded px-1.5 py-0.5 mb-1 cursor-pointer hover:opacity-80"
              :style="catStyle(ev.category)"
              @click.stop="emit('select', ev.id)"
            >
              <div class="text-[10px] opacity-60 font-mono">{{ ev.time }}</div>
              <div class="font-medium leading-tight truncate">{{ ev.title }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <button
      @click="goToday"
      class="absolute bottom-4 right-4 bg-accent text-white text-xs px-3 py-1.5 rounded-full shadow-lg cursor-pointer hover:bg-accent-hover transition-colors z-20"
    >
      ↕ Idag
    </button>
  </div>
</template>
