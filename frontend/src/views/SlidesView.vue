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
