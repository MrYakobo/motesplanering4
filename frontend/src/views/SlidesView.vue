<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from '../composables/useStore'
import { useToday, localDateStr } from '../composables/useToday'
import { useFullscreen } from '../composables/useFullscreen'
import { Maximize, Minimize } from 'lucide-vue-next'

const { db } = useStore()
const { today } = useToday()
const { isFullscreen, toggle } = useFullscreen()

const dayLabels = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag']

function weekNumber(d: Date) {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

const weekEvents = computed(() => {
  const now = today.value
  const day = now.getDay()
  const mon = new Date(now)
  mon.setDate(now.getDate() - ((day + 6) % 7))
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  const monStr = localDateStr(mon)
  const sunStr = localDateStr(sun)
  return db.events
    .filter(e => e.date >= monStr && e.date <= sunStr)
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
})

const weekNum = computed(() => {
  const now = today.value
  const day = now.getDay()
  const mon = new Date(now)
  mon.setDate(now.getDate() - ((day + 6) % 7))
  return weekNumber(mon)
})

const byDay = computed(() => {
  const groups: Record<string, typeof weekEvents.value> = {}
  weekEvents.value.forEach(ev => {
    if (!groups[ev.date]) groups[ev.date] = []
    groups[ev.date].push(ev)
  })
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
})

function dayLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const name = dayLabels[d.getDay()]
  return name.charAt(0).toUpperCase() + name.slice(1)
}
</script>

<template>
  <div class="slide-area">
    <!-- Fullscreen toggle -->
    <button
      @click="toggle"
      class="absolute top-[2vh] right-[2vw] p-1.5 rounded-md bg-white/10 text-white/50 hover:text-white hover:bg-white/20 border-none cursor-pointer transition-colors z-10"
      :title="isFullscreen ? 'Avsluta fullskärm (Esc)' : 'Fullskärm (F)'"
    >
      <component :is="isFullscreen ? Minimize : Maximize" :size="16" />
    </button>

    <!-- Week overview -->
    <div class="slide-week">
      <div class="slide-week-header">
        <h2>Händer i veckan (v{{ weekNum }})</h2>
      </div>
      <div class="slide-columns">
        <div v-if="byDay.length === 0" class="flex-1 flex items-center justify-center text-[clamp(14px,1.5vw,24px)] text-gray-500">
          Inga händelser denna vecka
        </div>
        <div v-for="([date, events], colIdx) in byDay" :key="date" class="slide-col">
          <div class="slide-col-day">{{ dayLabel(date) }}</div>
          <div class="slide-col-events">
            <div
              v-for="(ev, evIdx) in events" :key="ev.id"
              class="slide-ev"
              :style="{ animationDelay: `${(colIdx * 0.15 + evIdx * 0.08).toFixed(2)}s` }"
            >
              <div class="slide-ev-title">{{ ev.title }}</div>
              <div class="slide-ev-meta">{{ ev.category || '' }} · {{ ev.time || '' }}</div>
            </div>
          </div>
        </div>
      </div>
      <div class="slide-footer">
        <div class="slide-clock"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.slide-area {
  flex: 1;
  background: #111;
  color: #e5e5e5;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}
.slide-week {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}
.slide-week-header {
  padding: 2.5vh 3vw 0;
  flex-shrink: 0;
  text-align: center;
  margin-bottom: 40px;
}
.slide-week-header h2 {
  font-size: clamp(24px, 3.5vw, 56px);
  font-weight: 800;
  color: #fff;
  margin: 0;
  letter-spacing: -0.01em;
}
.slide-columns {
  display: flex;
  flex: 1;
  padding: 0 2vw 2vh;
  gap: 1.5vw;
  overflow: hidden;
}
.slide-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}
.slide-col-day {
  font-size: clamp(16px, 2.2vw, 36px);
  font-weight: 700;
  color: #fff;
  padding-bottom: 0.5vh;
  border-bottom: 2px solid #444;
  margin-bottom: 1.5vh;
}
.slide-col-events {
  display: flex;
  flex-direction: column;
  gap: 1.2vh;
}
.slide-ev {
  animation: slideEvIn 0.5s ease both;
}
.slide-ev-title {
  font-size: clamp(14px, 1.8vw, 30px);
  font-weight: 700;
  color: #e5e5e5;
  line-height: 1.15;
  overflow-wrap: break-word;
  word-break: break-word;
  hyphens: auto;
}
.slide-ev-meta {
  font-size: clamp(11px, 1.1vw, 20px);
  color: #777;
  margin-top: 0.2vh;
}
.slide-footer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 1.5vh 3vw;
}
.slide-clock {
  color: #fff;
  font-size: clamp(20px, 2.5vw, 42px);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
@keyframes slideEvIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
