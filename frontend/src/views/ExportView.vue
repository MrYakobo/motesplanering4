<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from '../composables/useStore'
import { useToast } from '../composables/useToast'

const { db } = useStore()
const { show: toast } = useToast()

const today = new Date().toISOString().slice(0, 10)
const monthNames = ['januari','februari','mars','april','maj','juni','juli','augusti','september','oktober','november','december']

const upcomingEvents = computed(() =>
  db.events
    .filter(e => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 60)
)

function monthLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return monthNames[d.getMonth()] + ' ' + d.getFullYear()
}

// Group by month
const byMonth = computed(() => {
  const groups: Record<string, typeof upcomingEvents.value> = {}
  upcomingEvents.value.forEach(ev => {
    const key = ev.date.slice(0, 7)
    if (!groups[key]) groups[key] = []
    groups[key].push(ev)
  })
  return Object.entries(groups)
})

function exportHtml() {
  toast('HTML-export — inte implementerat i Vue-versionen ännu', 'warn')
}
</script>

<template>
  <div class="flex-1 overflow-y-auto bg-gray-50 p-6 flex flex-col items-center">
    <div class="max-w-md w-full">
      <div class="flex items-center gap-3 mb-4">
        <h2 class="text-base font-semibold">Månadsblad</h2>
        <button @click="exportHtml" class="ml-auto bg-accent text-white rounded-md px-3 py-1.5 text-sm cursor-pointer hover:bg-accent-hover transition-colors">
          Exportera HTML
        </button>
      </div>

      <div class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div v-for="[month, events] in byMonth" :key="month" class="mb-6 last:mb-0">
          <h3 class="text-sm font-bold text-gray-800 mb-2 capitalize">{{ monthLabel(events[0].date) }}</h3>
          <div v-for="ev in events" :key="ev.id" class="flex gap-2 py-1 text-sm border-b border-gray-100 last:border-none">
            <span class="text-gray-400 min-w-[80px] text-xs">{{ ev.date }}</span>
            <span class="text-gray-400 min-w-[40px] text-xs">{{ ev.time }}</span>
            <span class="text-gray-800">{{ ev.title }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
