<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from '../composables/useStore'

const { db } = useStore()

const dayLabels = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag']

// Get this week's events (Mon-Sun)
const weekEvents = computed(() => {
  const now = new Date()
  const day = now.getDay()
  const mon = new Date(now)
  mon.setDate(now.getDate() - ((day + 6) % 7))
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)

  const monStr = mon.toISOString().slice(0, 10)
  const sunStr = sun.toISOString().slice(0, 10)

  return db.events
    .filter(e => e.date >= monStr && e.date <= sunStr)
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
})

// Group by day
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
  return dayLabels[d.getDay()]
}
</script>

<template>
  <div class="flex-1 bg-[#111] text-gray-300 flex flex-col overflow-hidden">
    <div class="text-center py-6">
      <h2 class="text-3xl font-extrabold text-white tracking-tight">Veckans program</h2>
    </div>
    <div class="flex flex-1 px-6 pb-6 gap-4 overflow-x-auto">
      <div v-for="[date, events] in byDay" :key="date" class="flex-1 min-w-[140px]">
        <div class="text-lg font-bold text-white mb-3 pb-2 border-b-2 border-gray-700 capitalize">
          {{ dayLabel(date) }}
        </div>
        <div class="space-y-3">
          <div v-for="ev in events" :key="ev.id">
            <div class="text-base font-bold text-gray-200 leading-tight">{{ ev.title }}</div>
            <div class="text-sm text-gray-500 mt-0.5">
              <span v-if="ev.time" class="text-gray-400 font-semibold">{{ ev.time }}</span>
            </div>
          </div>
        </div>
      </div>
      <div v-if="byDay.length === 0" class="flex-1 flex items-center justify-center text-gray-600 text-sm">
        Inga händelser denna vecka
      </div>
    </div>
  </div>
</template>
