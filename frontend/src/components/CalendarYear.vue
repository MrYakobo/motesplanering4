<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import type { Event } from '../types'

const props = defineProps<{ events: Event[] }>()
const emit = defineEmits<{ switchWeek: [date: string] }>()

const scrollRef = ref<HTMLElement | null>(null)
const monthNames = ['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec']
const dayHeaders = ['m','t','o','t','f','l','s']

const todayStr = computed(() => new Date().toISOString().slice(0, 10))

const eventDates = computed(() => new Set(props.events.map(e => e.date)))

const years = computed(() => {
  const now = new Date()
  return [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]
})

function dateStr(d: Date) { return d.toISOString().slice(0, 10) }

function weekNumber(d: Date) {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

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

// Current week range for highlighting
const currentWeekMon = computed(() => {
  const d = new Date()
  const day = d.getDay()
  const mon = new Date(d)
  mon.setDate(d.getDate() - ((day + 6) % 7))
  return dateStr(mon)
})
const currentWeekSun = computed(() => {
  const d = new Date(currentWeekMon.value + 'T00:00:00')
  d.setDate(d.getDate() + 6)
  return dateStr(d)
})

function isCurrentWeek(weekMon: Date) {
  const monStr = dateStr(weekMon)
  const sun = new Date(weekMon)
  sun.setDate(weekMon.getDate() + 6)
  const sunStr = dateStr(sun)
  return monStr <= currentWeekSun.value && sunStr >= currentWeekMon.value
}

onMounted(() => {
  nextTick(() => {
    const el = scrollRef.value?.querySelector('.year-today') as HTMLElement
    if (el) el.scrollIntoView({ block: 'center', behavior: 'instant' })
  })
})
</script>

<template>
  <div ref="scrollRef" class="flex-1 overflow-y-auto p-4">
    <div v-for="yr in years" :key="yr" class="mb-8">
      <div class="text-xl font-extrabold text-gray-800 px-2 mb-3">{{ yr }}</div>
      <div class="grid grid-cols-4 gap-4">
        <div v-for="m in 12" :key="m" class="bg-white rounded-lg border border-gray-100 p-2">
          <div class="text-xs font-bold text-gray-600 mb-1 capitalize">{{ monthNames[m - 1] }}</div>
          <!-- Mini header -->
          <div class="grid grid-cols-[20px_repeat(7,1fr)] text-[8px] text-gray-400 font-semibold">
            <div class="text-center">v</div>
            <div v-for="dh in dayHeaders" :key="dh" class="text-center">{{ dh }}</div>
          </div>
          <!-- Mini weeks -->
          <div
            v-for="(weekMon, wi) in weeksForMonth(yr, m - 1)" :key="wi"
            class="grid grid-cols-[20px_repeat(7,1fr)]"
          >
            <div
              class="text-[8px] text-center"
              :class="isCurrentWeek(weekMon) ? 'text-accent font-bold' : 'text-gray-300'"
            >
              {{ weekNumber(weekMon) }}
            </div>
            <div
              v-for="day in daysForWeek(weekMon)" :key="dateStr(day)"
              class="text-[10px] text-center py-px cursor-pointer rounded-sm hover:bg-gray-100 transition-colors"
              :class="{
                'opacity-20': day.getMonth() !== m - 1,
                'year-today text-accent font-bold ring-1 ring-accent rounded-sm': dateStr(day) === todayStr,
                'text-gray-600': dateStr(day) !== todayStr && day.getMonth() === m - 1,
                'font-semibold': eventDates.has(dateStr(day)) && day.getMonth() === m - 1,
              }"
              @click="emit('switchWeek', dateStr(day))"
            >
              <span
                v-if="eventDates.has(dateStr(day)) && day.getMonth() === m - 1"
                class="relative"
              >
                {{ day.getDate() }}
                <span class="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent"></span>
              </span>
              <span v-else>{{ day.getDate() }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
