<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '../composables/useStore'
import { useToday } from '../composables/useToday'
import { useToast } from '../composables/useToast'
import RecordModal from '../components/RecordModal.vue'
import { HandHelping, UserCheck, UserMinus } from 'lucide-vue-next'
import type { Event, Task } from '../types'

const { db, assignments, effectiveTasks, persist, isMember, isAdmin, memberContactId } = useStore()
const { todayStr } = useToday()
const { show: toast } = useToast()

const guideTask = ref<Task | null>(null)
const guideEvent = ref<Event | null>(null)

// 4 weeks ahead
const horizonDate = computed(() => {
  const d = new Date(todayStr.value + 'T00:00:00')
  d.setDate(d.getDate() + 28)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
})

const upcomingEvents = computed(() =>
  [...db.events]
    .filter(e => e.date >= todayStr.value && e.date <= horizonDate.value)
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
)

// Events with open slots (non-team, non-locked, unassigned)
const eventsWithSlots = computed(() =>
  upcomingEvents.value
    .map(ev => {
      const tasks = effectiveTasks(ev)
      const openTasks = tasks
        .map(tid => db.tasks.find(t => t.id === tid))
        .filter((t): t is Task => !!t && !t.teamTask && !t.locked && !assignments[ev.id]?.[t.id])
      return { ev, openTasks }
    })
    .filter(x => x.openTasks.length > 0)
)

// Events without tasks (info items for sidebar)
const infoEvents = computed(() =>
  upcomingEvents.value.filter(ev => effectiveTasks(ev).length === 0)
)

const totalSlots = computed(() => eventsWithSlots.value.reduce((n, x) => n + x.openTasks.length, 0))

function isSignedUp(eventId: number, taskId: number): boolean {
  if (!memberContactId.value) return false
  const asgn = assignments[eventId]?.[taskId]
  return asgn?.type === 'contact' && (asgn.ids || []).includes(memberContactId.value)
}

async function signUp(ev: Event, task: Task) {
  if (!memberContactId.value && !isAdmin.value) return
  const contactId = memberContactId.value!
  if (!assignments[ev.id]) assignments[ev.id] = {}
  assignments[ev.id][task.id] = { type: 'contact', ids: [contactId] }
  db.schedules = assignments as any
  await persist('schedules')
  toast(`Du är anmäld till ${task.name} — ${ev.title} ${ev.date}`)
}

async function withdraw(ev: Event, task: Task) {
  if (!memberContactId.value) return
  const contactId = memberContactId.value

  // Check if within 24h
  const eventTime = new Date(ev.date + 'T' + (ev.time || '00:00') + ':00')
  const hoursUntil = (eventTime.getTime() - Date.now()) / 3600000

  if (hoursUntil < 24) {
    if (!confirm(`Händelsen är inom 24 timmar.\n\nOm du avanmäler dig skickas en notifikation till ansvarig och ledare om att platsen är tom.\n\nVill du avanmäla dig ändå?`)) return
    // Record late withdrawal
    if (!db.lateWithdrawals) db.lateWithdrawals = []
    db.lateWithdrawals.push({
      eventId: ev.id,
      taskId: task.id,
      contactId,
      timestamp: new Date().toISOString(),
    })
    await persist('lateWithdrawals')
  }

  const asgn = assignments[ev.id]?.[task.id]
  if (asgn?.type === 'contact') {
    asgn.ids = (asgn.ids || []).filter(id => id !== contactId)
    if (asgn.ids.length === 0) delete assignments[ev.id][task.id]
  }
  db.schedules = assignments as any
  await persist('schedules')
  toast('Du är avanmäld')
}

function openGuide(task: Task, ev: Event) {
  guideTask.value = task
  guideEvent.value = ev
}

function responsibleName(task: Task): string {
  if (!task.responsibleId) return ''
  return db.contacts.find(c => c.id === task.responsibleId)?.name || ''
}

const dayNames = ['sön', 'mån', 'tis', 'ons', 'tor', 'fre', 'lör']
function dayLabel(dateStr: string) {
  return dayNames[new Date(dateStr + 'T00:00:00').getDay()]
}
</script>

<template>
  <div class="flex-1 overflow-y-auto bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] text-white">
    <div class="max-w-2xl mx-auto px-4 py-8">
      <div class="mb-6">
        <h1 class="text-2xl font-extrabold mb-1">Platsbank</h1>
        <p class="text-sm text-white/40">{{ totalSlots }} {{ totalSlots === 1 ? 'ledig plats' : 'lediga platser' }} de närmaste 4 veckorna</p>
      </div>

      <div v-if="eventsWithSlots.length === 0" class="text-white/30 text-sm text-center py-12">
        Alla platser är fyllda — snyggt jobbat!
      </div>

      <div class="space-y-4">
        <div v-for="{ ev, openTasks } in eventsWithSlots" :key="ev.id"
          class="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
          <!-- Event header -->
          <div class="px-4 py-3 border-b border-white/5">
            <div class="text-xs text-white/40">{{ dayLabel(ev.date) }} {{ ev.date }} · {{ ev.time || 'heldag' }}</div>
            <div class="text-sm font-semibold text-white/90">{{ ev.title }}</div>
          </div>
          <!-- Open task slots -->
          <div class="p-3 flex flex-wrap gap-2">
            <button
              v-for="task in openTasks" :key="task.id"
              @click="openGuide(task, ev)"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all border"
              :class="isSignedUp(ev.id, task.id)
                ? 'bg-accent/20 border-accent/40 text-accent-light'
                : 'bg-white/5 border-white/10 text-white/70 hover:border-accent/30 hover:bg-accent/5'"
            >
              <HandHelping :size="13" />
              {{ task.name }}
            </button>
          </div>
        </div>
      </div>

      <!-- Info events (no tasks) -->
      <div v-if="infoEvents.length > 0" class="mt-8">
        <h2 class="text-xs font-semibold text-white/30 uppercase tracking-wider mb-2">Kommande</h2>
        <div class="space-y-1">
          <div v-for="ev in infoEvents" :key="ev.id" class="text-xs text-white/30 px-1">
            {{ ev.date }} · {{ ev.title }}
          </div>
        </div>
      </div>
    </div>

    <!-- Task guide modal -->
    <RecordModal :open="guideTask !== null" :title="guideTask?.name || ''" @close="guideTask = null; guideEvent = null">
      <div v-if="guideTask">
        <p v-if="guideTask.description" class="text-sm text-gray-600 mb-3">{{ guideTask.description }}</p>
        <div v-if="responsibleName(guideTask)" class="text-xs text-gray-400 mb-3">
          Ansvarig: <span class="text-gray-600 font-medium">{{ responsibleName(guideTask) }}</span>
        </div>
        <div v-if="guideTask.manual" class="prose prose-sm max-w-none mb-4 text-gray-700 whitespace-pre-wrap text-xs leading-relaxed border-t border-gray-200 pt-3">{{ guideTask.manual }}</div>
        <div v-if="guideEvent" class="border-t border-gray-200 pt-3 mt-3">
          <div class="text-xs text-gray-400 mb-2">{{ guideEvent.title }} · {{ guideEvent.date }} {{ guideEvent.time }}</div>
          <button v-if="isSignedUp(guideEvent.id, guideTask.id)"
            @click="withdraw(guideEvent!, guideTask!); guideTask = null; guideEvent = null"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors">
            <UserMinus :size="13" /> Avanmäl mig
          </button>
          <button v-else-if="isMember || isAdmin"
            @click="signUp(guideEvent!, guideTask!); guideTask = null; guideEvent = null"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer bg-accent text-white border-none hover:bg-accent-hover transition-colors">
            <UserCheck :size="13" /> Anmäl mig till {{ guideTask.name }}
          </button>
          <p v-else class="text-xs text-gray-400">Logga in för att anmäla dig</p>
        </div>
      </div>
    </RecordModal>
  </div>
</template>
