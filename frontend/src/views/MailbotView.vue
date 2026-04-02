<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '../composables/useStore'
import { useToday, localDateStr } from '../composables/useToday'
import { useToast } from '../composables/useToast'
import { useApi } from '../composables/useApi'
import { Mail, AlertTriangle, CheckCircle, Zap, Send } from 'lucide-vue-next'

const { db, assignments } = useStore()
const { show: toast } = useToast()
const { today: todayDate, todayStr } = useToday()
const api = useApi()

const sending = ref(false)
const cronRunning = ref(false)

const upcomingEvents = computed(() =>
  db.events
    .filter(e => e.date >= todayStr.value && e.date <= futureDate(30))
    .sort((a, b) => a.date.localeCompare(b.date))
)

function futureDate(days: number) {
  const d = new Date(todayDate.value)
  d.setDate(d.getDate() + days)
  return localDateStr(d)
}

function getAssignedPeople(eid: number) {
  const asgn = assignments[eid] || {}
  const people: { name: string; email: string; hasEmail: boolean; taskName: string }[] = []
  const seen = new Set<number>()
  for (const [tid, a] of Object.entries(asgn)) {
    const task = db.tasks.find(t => t.id === parseInt(tid))
    const ids = a.type === 'contact' ? (a.ids || []) :
      a.type === 'team' ? (db.teams.find(t => t.id === a.id)?.members || []) : []
    ids.forEach(id => {
      if (seen.has(id)) return
      seen.add(id)
      const c = db.contacts.find(x => x.id === id)
      if (c) people.push({ name: c.name, email: c.email, hasEmail: !!c.email, taskName: task?.name || '' })
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

async function runCronNow() {
  cronRunning.value = true
  try {
    const result = await api.runCron()
    if (result.ok) {
      toast(`Cron kördes: ${result.sent || 0} mail skickade`)
    } else {
      toast('Fel: ' + (result.error || 'okänt'), 'error')
    }
  } catch (err: any) {
    toast('Kunde inte nå servern: ' + err.message, 'error')
  } finally {
    cronRunning.value = false
  }
}

async function sendReminders() {
  sending.value = true
  try {
    // Run the reminders cron jobs (6d + 1d)
    const r6 = await api.runCron('reminders_6d')
    const r1 = await api.runCron('reminders_1d')
    const total = (r6.sent || 0) + (r1.sent || 0)
    toast(`${total} påminnelsemail skickade`)
  } catch (err: any) {
    toast('Kunde inte skicka: ' + err.message, 'error')
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="flex-1 overflow-y-auto bg-gray-50 p-6">
    <div class="max-w-2xl mx-auto">
      <h2 class="text-base font-semibold mb-4">Påminnelsemail</h2>

      <!-- Stats -->
      <div class="grid grid-cols-3 gap-4 mb-6">
        <div class="bg-white border border-gray-200 rounded-lg p-4">
          <div class="text-2xl font-bold text-gray-700">{{ stats.events }}</div>
          <div class="text-xs text-gray-500 mt-1">Händelser (30 dagar)</div>
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

      <!-- Cron info + actions -->
      <div class="bg-white border border-gray-200 rounded-lg p-4 mb-6 text-sm text-gray-700">
        <div class="flex items-center gap-1.5 mb-2 font-semibold text-gray-800">
          <Mail :size="14" class="text-gray-500" /> Påminnelseschema (cron)
        </div>
        <div class="text-xs text-gray-500 space-y-0.5 mb-3">
          <div>• 6 dagar före kl 09:00 — första påminnelsen (personliga mail)</div>
          <div>• 6 dagar före kl 09:05 — mailchat (grupptråd)</div>
          <div>• 1 dag före kl 18:00 — sista påminnelsen (personliga mail)</div>
        </div>
        <div class="flex gap-2">
          <button
            @click="sendReminders"
            :disabled="sending"
            class="bg-accent text-white rounded-md px-3 py-1.5 text-xs cursor-pointer hover:bg-accent-hover transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <Send :size="12" /> {{ sending ? 'Skickar…' : 'Skicka påminnelser' }}
          </button>
          <button
            @click="runCronNow"
            :disabled="cronRunning"
            class="border border-gray-300 text-gray-700 rounded-md px-3 py-1.5 text-xs cursor-pointer hover:bg-gray-50 transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <Zap :size="12" /> {{ cronRunning ? 'Kör…' : 'Kör cron manuellt' }}
          </button>
        </div>
      </div>

      <!-- Event list -->
      <h3 class="text-sm font-semibold text-gray-700 mb-3">Kommande händelser med tilldelningar</h3>
      <div v-if="upcomingEvents.length === 0" class="text-sm text-gray-400 text-center py-8">
        Inga händelser med tilldelningar de närmaste 30 dagarna
      </div>
      <div class="space-y-3">
        <div v-for="ev in upcomingEvents" :key="ev.id" class="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div class="px-4 py-2.5 flex items-center gap-3 border-b border-gray-100">
            <span class="text-xs text-gray-500 font-mono min-w-[100px]">{{ ev.date }} {{ ev.time }}</span>
            <span class="text-sm font-semibold text-gray-700 flex-1">{{ ev.title }}</span>
            <span v-if="getAssignedPeople(ev.id).length > 0 && getAssignedPeople(ev.id).every(p => p.hasEmail)" class="text-emerald-500"><CheckCircle :size="14" /></span>
            <span v-else-if="getAssignedPeople(ev.id).some(p => !p.hasEmail)" class="text-amber-500"><AlertTriangle :size="14" /></span>
          </div>
          <div v-if="getAssignedPeople(ev.id).length > 0" class="px-4 py-2 flex flex-wrap gap-1.5">
            <span
              v-for="p in getAssignedPeople(ev.id)" :key="p.name"
              class="text-xs px-2 py-0.5 rounded flex items-center gap-1"
              :class="p.hasEmail ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'"
              :title="p.hasEmail ? `${p.email} — ${p.taskName}` : `Saknar e-post — ${p.taskName}`"
            >
              <Mail v-if="p.hasEmail" :size="10" />
              <AlertTriangle v-else :size="10" />
              {{ p.name }}
            </span>
          </div>
          <div v-else class="px-4 py-2 text-xs text-gray-400">Inga tilldelade</div>
        </div>
      </div>
    </div>
  </div>
</template>
