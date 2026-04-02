<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from '../composables/useStore'
import { useToday } from '../composables/useToday'
import { useToast } from '../composables/useToast'
import { Mail, AlertTriangle, CheckCircle } from 'lucide-vue-next'

const { db, assignments } = useStore()
const { show: toast } = useToast()
const { today: todayDate, todayStr } = useToday()

const upcomingEvents = computed(() =>
  db.events
    .filter(e => e.date >= todayStr.value && e.date <= futureDate(14))
    .sort((a, b) => a.date.localeCompare(b.date))
)

function futureDate(days: number) {
  const d = new Date(todayDate.value)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function getAssignedPeople(eid: number) {
  const asgn = assignments[eid] || {}
  const people: { name: string; email: string; hasEmail: boolean }[] = []
  const seen = new Set<number>()
  for (const a of Object.values(asgn)) {
    const ids = a.type === 'contact' ? (a.ids || []) :
      a.type === 'team' ? (db.teams.find(t => t.id === a.id)?.members || []) : []
    ids.forEach(id => {
      if (seen.has(id)) return
      seen.add(id)
      const c = db.contacts.find(x => x.id === id)
      if (c) people.push({ name: c.name, email: c.email, hasEmail: !!c.email })
    })
  }
  return people
}

const stats = computed(() => {
  let total = 0, withEmail = 0, withoutEmail = 0
  upcomingEvents.value.forEach(ev => {
    const people = getAssignedPeople(ev.id)
    total += people.length
    withEmail += people.filter(p => p.hasEmail).length
    withoutEmail += people.filter(p => !p.hasEmail).length
  })
  return { events: upcomingEvents.value.length, total, withEmail, withoutEmail }
})

async function sendReminders() {
  toast('Påminnelsemail — inte implementerat i Vue-versionen ännu', 'warn')
}
</script>

<template>
  <div class="flex-1 overflow-y-auto bg-gray-50 p-6">
    <div class="max-w-2xl mx-auto">
      <h2 class="text-base font-semibold mb-4">Påminnelsemail</h2>

      <div class="grid grid-cols-3 gap-4 mb-6">
        <div class="bg-white border border-gray-200 rounded-lg p-4">
          <div class="text-2xl font-bold text-gray-700">{{ stats.events }}</div>
          <div class="text-xs text-gray-500 mt-1">Händelser (14 dagar)</div>
        </div>
        <div class="bg-white border border-gray-200 rounded-lg p-4">
          <div class="text-2xl font-bold text-emerald-600">{{ stats.withEmail }}</div>
          <div class="text-xs text-gray-500 mt-1">Med e-post</div>
        </div>
        <div class="bg-white border border-gray-200 rounded-lg p-4">
          <div class="text-2xl font-bold" :class="stats.withoutEmail > 0 ? 'text-red-500' : 'text-gray-400'">{{ stats.withoutEmail }}</div>
          <div class="text-xs text-gray-500 mt-1">Utan e-post</div>
        </div>
      </div>

      <button @click="sendReminders" class="bg-accent text-white rounded-md px-4 py-2 text-sm cursor-pointer hover:bg-accent-hover transition-colors flex items-center gap-2 mb-6">
        <Mail :size="14" /> Skicka påminnelser
      </button>

      <div class="space-y-3">
        <div v-for="ev in upcomingEvents" :key="ev.id" class="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div class="px-4 py-2.5 flex items-center gap-3 border-b border-gray-100">
            <span class="text-xs text-gray-500 font-mono min-w-[100px]">{{ ev.date }}</span>
            <span class="text-sm font-semibold text-gray-700 flex-1">{{ ev.title }}</span>
            <span v-if="getAssignedPeople(ev.id).every(p => p.hasEmail)" class="text-emerald-500"><CheckCircle :size="14" /></span>
            <span v-else class="text-amber-500"><AlertTriangle :size="14" /></span>
          </div>
          <div class="px-4 py-2 flex flex-wrap gap-1.5">
            <span
              v-for="p in getAssignedPeople(ev.id)" :key="p.name"
              class="text-xs px-2 py-0.5 rounded flex items-center gap-1"
              :class="p.hasEmail ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'"
            >
              {{ p.name }}
            </span>
            <span v-if="getAssignedPeople(ev.id).length === 0" class="text-xs text-gray-400">Inga tilldelade</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
