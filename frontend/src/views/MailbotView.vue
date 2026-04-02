<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '../composables/useStore'
import { useToday, localDateStr } from '../composables/useToday'
import { useToast } from '../composables/useToast'
import { useApi } from '../composables/useApi'
import { Mail, AlertTriangle, CheckCircle, Zap, Send, X } from 'lucide-vue-next'

const { db, assignments } = useStore()
const { show: toast } = useToast()
const { today: todayDate, todayStr } = useToday()
const api = useApi()

const sending = ref(false)
const cronRunning = ref(false)

const upcomingEvents = computed(() =>
  db.events
    .filter(e => e.date >= todayStr.value && e.date <= futureDate(30) && (e.expectedTasks || []).length > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
)

function futureDate(days: number) {
  const d = new Date(todayDate.value)
  d.setDate(d.getDate() + days)
  return localDateStr(d)
}

function getAssignedPeople(eid: number) {
  const asgn = assignments[eid] || {}
  const people: { id: number; name: string; email: string; hasEmail: boolean; taskName: string }[] = []
  const seen = new Set<number>()
  for (const [tid, a] of Object.entries(asgn)) {
    const task = db.tasks.find(t => t.id === parseInt(tid))
    const ids = a.type === 'contact' ? (a.ids || []) :
      a.type === 'team' ? (db.teams.find(t => t.id === a.id)?.members || []) : []
    ids.forEach(id => {
      if (seen.has(id)) return
      seen.add(id)
      const c = db.contacts.find(x => x.id === id)
      if (c) people.push({ id: c.id, name: c.name, email: c.email, hasEmail: !!c.email, taskName: task?.name || '' })
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

// ── Email preview ────────────────────────────────────────────────────────────
const previewHtml = ref('')
const previewSubject = ref('')
const previewOpen = ref(false)

const DAY_NAMES = ['söndag','måndag','tisdag','onsdag','torsdag','fredag','lördag']

function findPersonTask(eventId: number, contactId: number) {
  const asgn = assignments[eventId] || {}
  for (const [tid, val] of Object.entries(asgn)) {
    const task = db.tasks.find(t => t.id === parseInt(tid))
    if (!task) continue
    if (val.type === 'contact' && (val.ids || []).includes(contactId)) return task
    if (val.type === 'team') {
      const team = db.teams.find(t => t.id === val.id)
      if (team && team.members.includes(contactId)) return task
    }
  }
  return null
}

function buildRosterRows(eventId: number) {
  const asgn = assignments[eventId] || {}
  let rows = ''
  for (const [tid, val] of Object.entries(asgn)) {
    const task = db.tasks.find(t => t.id === parseInt(tid))
    if (!task) continue
    if (val.type === 'contact') {
      for (const cid of (val.ids || [])) {
        const c = db.contacts.find(x => x.id === cid)
        if (c) rows += `<tr><td style="padding:4px 8px;border-bottom:1px solid #f0f0f0">${task.name}</td><td style="padding:4px 8px;border-bottom:1px solid #f0f0f0">${c.name}</td></tr>`
      }
    } else if (val.type === 'team') {
      const team = db.teams.find(t => t.id === val.id)
      if (!team) continue
      rows += `<tr><td colspan="2" style="padding:12px 8px 4px"><strong>${task.name} — Team ${team.number}</strong></td></tr>`
      for (const cid of team.members) {
        const c = db.contacts.find(x => x.id === cid)
        if (c) rows += `<tr><td style="padding:4px 8px;border-bottom:1px solid #f0f0f0"></td><td style="padding:4px 8px;border-bottom:1px solid #f0f0f0">${c.name}</td></tr>`
      }
    }
  }
  return rows
}

function previewEmail(eventId: number, contactId: number) {
  const ev = db.events.find(e => e.id === eventId)
  const contact = db.contacts.find(c => c.id === contactId)
  if (!ev || !contact) return

  const task = findPersonTask(eventId, contactId)
  const taskPhrase = task?.phrase || ('är ' + (task?.name || 'med'))
  const firstName = contact.name.split(' ')[0]
  const rosterHtml = buildRosterRows(eventId)
  const d = new Date(ev.date + 'T00:00:00')
  const orgName = db.settings?.orgName || ''
  const orgLogo = db.settings?.orgLogo || ''
  const subjectRole = task?.name ? task.name.toLowerCase() : 'med'

  previewSubject.value = `Du är ${subjectRole} på ${DAY_NAMES[d.getDay()]}`
  previewHtml.value = `<div style="font-family:system-ui,sans-serif;background:#fff;padding:20px;border-radius:3px">`
    + `<h1 style="font-size:35px;font-weight:300;text-align:center;margin-bottom:30px">Hej ${firstName}!</h1>`
    + `<p>Du ${taskPhrase} på "${ev.title}", ${DAY_NAMES[d.getDay()]} kl ${ev.time || ''}.</p>`
    + `<p>Alla som har ansvar då är:</p>`
    + `<table style="width:100%;border-top:1px solid #ccc;border-bottom:1px solid #ccc;padding:10px;margin-bottom:10px;border-collapse:collapse;font-size:13px"><tbody>${rosterHtml}</tbody></table>`
    + `<h3 style="font-weight:400">Ha en fortsatt fin vecka!</h3>`
    + (orgLogo ? `<img style="width:150px" src="${orgLogo}">` : '')
    + `</div>`
    + `<div style="text-align:center;margin-top:10px;font-size:12px;color:#999">${orgName}<br>Det här mailet avser ${ev.date} ${ev.time || ''}.</div>`
  previewOpen.value = true
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
      <h3 class="text-sm font-semibold text-gray-700 mb-3">Kommande händelser med förväntade uppgifter</h3>
      <div v-if="upcomingEvents.length === 0" class="text-sm text-gray-400 text-center py-8">
        Inga händelser med förväntade uppgifter de närmaste 30 dagarna
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
            <button
              v-for="p in getAssignedPeople(ev.id)" :key="p.name"
              @click="previewEmail(ev.id, p.id)"
              class="text-xs px-2 py-0.5 rounded inline-flex items-center gap-1 border-none cursor-pointer transition-colors"
              :class="p.hasEmail ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-red-100 text-red-800 hover:bg-red-200'"
              :title="p.hasEmail ? `${p.email} — ${p.taskName} (klicka för förhandsgranskning)` : `Saknar e-post — ${p.taskName}`"
            >
              <Mail v-if="p.hasEmail" :size="10" />
              <AlertTriangle v-else :size="10" />
              {{ p.name }}
            </button>
          </div>
          <div v-else class="px-4 py-2 text-xs text-gray-400">Inga tilldelade</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Email preview modal -->
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="previewOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/35 backdrop-blur-sm"
        @click.self="previewOpen = false"
      >
        <div class="bg-gray-100 rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
          <div class="flex items-center px-5 py-3 border-b border-gray-200 bg-white shrink-0">
            <div class="flex-1 min-w-0">
              <div class="text-[11px] text-gray-400 uppercase tracking-wider">Ämne</div>
              <div class="text-sm font-semibold truncate">{{ previewSubject }}</div>
            </div>
            <button @click="previewOpen = false" class="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors shrink-0 bg-transparent border-none cursor-pointer">
              <X :size="16" />
            </button>
          </div>
          <div class="flex-1 overflow-y-auto p-4">
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden" v-html="previewHtml" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active { transition: opacity 0.18s ease; }
.modal-leave-active { transition: opacity 0.15s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-active > div { transition: transform 0.2s cubic-bezier(0.34, 1.2, 0.64, 1); }
.modal-leave-active > div { transition: transform 0.15s ease; }
.modal-enter-from > div { transform: translateY(12px) scale(0.98); }
.modal-leave-to > div { transform: translateY(8px) scale(0.98); }
</style>
