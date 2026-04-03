<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useToday, localDateStr } from '../composables/useToday'
import type { Event } from '../types'

const props = defineProps<{ events: Event[] }>()
const emit = defineEmits<{ selectDate: [date: string] }>()

const { today, todayStr } = useToday()

const scrollRef = ref<HTMLElement | null>(null)
const todayVisible = ref(true)
const monthNames = ['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec']
const dayHeaders = ['m','t','o','t','f','l','s']

const eventDates = computed(() => new Set(props.events.map(e => e.date)))

const years = computed(() => {
  const now = today.value
  return [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]
})

function dateStr(d: Date) { return localDateStr(d) }

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

const currentWeekMon = computed(() => {
  const d = new Date(today.value)
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

const visibleYearIdx = ref(0)

function updateVisibleYear() {
  const container = scrollRef.value
  if (!container) return
  const sections = container.querySelectorAll('.year-section')
  const cTop = container.scrollTop
  const cH = container.clientHeight
  for (let i = 0; i < sections.length; i++) {
    const el = sections[i] as HTMLElement
    if (el.offsetTop + cH / 2 > cTop) { visibleYearIdx.value = i; return }
  }
}

const navLabel = computed(() => String(years.value[visibleYearIdx.value] ?? ''))

function prevYear() {
  const idx = Math.max(0, visibleYearIdx.value - 1)
  const sections = scrollRef.value?.querySelectorAll('.year-section')
  if (sections?.[idx]) (sections[idx] as HTMLElement).scrollIntoView({ block: 'start', behavior: 'smooth' })
}
function nextYear() {
  const idx = Math.min(years.value.length - 1, visibleYearIdx.value + 1)
  const sections = scrollRef.value?.querySelectorAll('.year-section')
  if (sections?.[idx]) (sections[idx] as HTMLElement).scrollIntoView({ block: 'start', behavior: 'smooth' })
}

function checkTodayVisible() {
  const container = scrollRef.value
  if (!container) { todayVisible.value = false; return }
  const el = container.querySelector('.year-today') as HTMLElement
  if (!el) { todayVisible.value = false; return }
  const cRect = container.getBoundingClientRect()
  const tRect = el.getBoundingClientRect()
  todayVisible.value = tRect.bottom > cRect.top && tRect.top < cRect.bottom
}

function goToday() {
  const currentYearIdx = years.value.indexOf(today.value.getFullYear())
  if (currentYearIdx >= 0) {
    const sections = scrollRef.value?.querySelectorAll('.year-section')
    if (sections?.[currentYearIdx]) {
      (sections[currentYearIdx] as HTMLElement).scrollIntoView({ block: 'start', behavior: 'smooth' })
    }
  }
}

onMounted(() => {
  nextTick(() => {
    const currentYearIdx = years.value.indexOf(today.value.getFullYear())
    if (currentYearIdx >= 0) {
      const sections = scrollRef.value?.querySelectorAll('.year-section')
      if (sections?.[currentYearIdx]) {
        (sections[currentYearIdx] as HTMLElement).scrollIntoView({ block: 'start', behavior: 'instant' })
      }
    }
    scrollRef.value?.addEventListener('scroll', checkTodayVisible, { passive: true })
    scrollRef.value?.addEventListener('scroll', updateVisibleYear, { passive: true })
    checkTodayVisible()
    updateVisibleYear()
  })
})
onUnmounted(() => {
  scrollRef.value?.removeEventListener('scroll', checkTodayVisible)
  scrollRef.value?.removeEventListener('scroll', updateVisibleYear)
})

defineExpose({ goToday, todayVisible, prevYear, nextYear, navLabel, navUp: prevYear, navDown: nextYear })
</script>

<template>
  <div ref="scrollRef" class="flex-1 overflow-y-auto snap-y snap-mandatory">
    <div v-for="yr in years" :key="yr" class="year-section snap-start h-full min-h-full flex flex-col px-4 py-3">
      <div class="text-xl font-extrabold text-gray-800 px-2 mb-3 shrink-0">{{ yr }}</div>
      <div class="grid grid-cols-4 gap-3 flex-1 content-start">
        <div v-for="m in 12" :key="m" class="bg-white rounded-lg border border-gray-100 px-2 py-1.5">
          <div class="text-[11px] font-bold text-gray-600 mb-0.5 capitalize">{{ monthNames[m - 1] }}</div>
          <!-- Mini header -->
          <div class="year-grid text-[7px] text-gray-400 font-semibold">
            <div class="text-center">v</div>
            <div v-for="dh in dayHeaders" :key="dh" class="text-center">{{ dh }}</div>
          </div>
          <!-- Mini weeks -->
          <div
            v-for="(weekMon, wi) in weeksForMonth(yr, m - 1)" :key="wi"
            class="year-grid"
          >
            <div
              class="text-[7px] text-center leading-[18px]"
              :class="isCurrentWeek(weekMon) ? 'text-accent font-bold' : 'text-gray-300'"
            >
              {{ weekNumber(weekMon) }}
            </div>
            <div
              v-for="day in daysForWeek(weekMon)" :key="dateStr(day)"
              class="text-[10px] text-center leading-[18px] cursor-pointer rounded-sm hover:bg-gray-100 transition-colors"
              :class="{
                'opacity-20': day.getMonth() !== m - 1,
                'year-today bg-accent text-white font-bold rounded-sm': dateStr(day) === todayStr,
                'text-gray-600': dateStr(day) !== todayStr && day.getMonth() === m - 1,
                'font-semibold text-accent': eventDates.has(dateStr(day)) && day.getMonth() === m - 1 && dateStr(day) !== todayStr,
              }"
              @click="emit('selectDate', dateStr(day))"
            >
              {{ day.getDate() }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.year-grid {
  display: grid;
  grid-template-columns: 18px repeat(7, 1fr);
}
</style>
