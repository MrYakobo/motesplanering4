<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '../composables/useStore'
import { useToday } from '../composables/useToday'
import { useApi } from '../composables/useApi'
import { useToast } from '../composables/useToast'
import { CalendarDays, Save } from 'lucide-vue-next'

const { db, assignments, memberContactId } = useStore()
const { todayStr } = useToday()
const { updateMyContact, joinTeam, leaveTeam } = useApi()
const { show: toast } = useToast()

const me = computed(() =>
  memberContactId.value ? db.contacts.find(c => c.id === memberContactId.value) : null
)

// Editable contact fields
const editName = ref('')
const editEmail = ref('')
const editPhone = ref('')
const saving = ref(false)
const teamsOpen = ref(false)

function initEditFields() {
  if (me.value) {
    editName.value = me.value.name || ''
    editEmail.value = me.value.email || ''
    editPhone.value = me.value.phone || ''
  }
}
initEditFields()

async function saveContact() {
  saving.value = true
  try {
    await updateMyContact({ name: editName.value, email: editEmail.value, phone: editPhone.value })
    if (me.value) {
      me.value.name = editName.value
      me.value.email = editEmail.value
      me.value.phone = editPhone.value
    }
    toast('Uppgifter sparade')
  } catch (e: any) { toast(e.message) }
  saving.value = false
}

// Team self-service
const teamTasks = computed(() => db.tasks.filter((t: any) => t.teamTask))

function myTeamsForTask(taskId: number) {
  return db.teams.filter(t => t.taskId === taskId && t.members.includes(memberContactId.value!))
}
function teamMemberNames(team: { members: number[] }) {
  return team.members
    .filter(id => id !== memberContactId.value)
    .map(id => db.contacts.find(c => c.id === id)?.name)
    .filter(Boolean) as string[]
}
function availableTeamsForTask(taskId: number) {
  return db.teams.filter(t => t.taskId === taskId && !t.members.includes(memberContactId.value!))
}

async function doJoinTeam(teamId: number) {
  try {
    await joinTeam(teamId)
    const team = db.teams.find(t => t.id === teamId)
    if (team && !team.members.includes(memberContactId.value!)) team.members.push(memberContactId.value!)
    toast('Gick med i teamet')
  } catch (e: any) { toast(e.message) }
}

async function doLeaveTeam(teamId: number) {
  try {
    await leaveTeam(teamId)
    const team = db.teams.find(t => t.id === teamId)
    if (team) team.members = team.members.filter(id => id !== memberContactId.value)
    toast('Lämnade teamet')
  } catch (e: any) { toast(e.message) }
}

const myEvents = computed(() => {
  const cid = memberContactId.value
  if (!cid) return []
  return db.events
    .filter(e => e.date >= todayStr.value)
    .filter(e => {
      const asgn = assignments[e.id] || {}
      return Object.values(asgn).some(val => {
        if (val.type === 'contact') return (val.ids || []).includes(cid)
        if (val.type === 'team') {
          const team = db.teams.find(t => t.id === val.id)
          return team ? team.members.includes(cid) : false
        }
        return false
      })
    })
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
    .slice(0, 30)
})

function getMyTasks(eventId: number): string[] {
  const cid = memberContactId.value
  if (!cid) return []
  const asgn = assignments[eventId] || {}
  return Object.entries(asgn)
    .filter(([_, val]) => {
      if (val.type === 'contact') return (val.ids || []).includes(cid)
      if (val.type === 'team') {
        const team = db.teams.find(t => t.id === val.id)
        return team ? team.members.includes(cid) : false
      }
      return false
    })
    .map(([tid]) => db.tasks.find(t => t.id === parseInt(tid))?.name)
    .filter(Boolean) as string[]
}

// Group by month
const byMonth = computed(() => {
  const groups: Record<string, typeof myEvents.value> = {}
  myEvents.value.forEach(ev => {
    const key = ev.date.slice(0, 7)
    if (!groups[key]) groups[key] = []
    groups[key].push(ev)
  })
  return Object.entries(groups)
})

const monthNames = ['januari','februari','mars','april','maj','juni','juli','augusti','september','oktober','november','december']
const dayNames = ['söndag','måndag','tisdag','onsdag','torsdag','fredag','lördag']

function monthLabel(key: string) {
  const m = parseInt(key.slice(5, 7)) - 1
  const y = key.slice(0, 4)
  return monthNames[m] + ' ' + y
}

function dayLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return dayNames[d.getDay()]
}

function dayNum(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').getDate()
}

// iCal link
const icalUrl = computed(() => {
  if (!me.value?.email) return ''
  const slug = me.value.email.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return location.origin + '/api/cal/' + slug + '.ics'
})
const webcalUrl = computed(() => icalUrl.value.replace(/^https?:/, 'webcal:'))

function copyIcal() {
  navigator.clipboard.writeText(icalUrl.value)
}
</script>

<template>
  <div class="flex-1 overflow-y-auto bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] text-white">
    <div class="max-w-2xl mx-auto px-4 py-8">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-2xl font-extrabold mb-1">
          {{ me ? `Hej ${me.name.split(' ')[0]}` : 'Mitt schema' }}
        </h1>
        <p class="text-sm text-white/40">Dina kommande tilldelningar</p>
      </div>

      <!-- No assignments -->
      <div v-if="!memberContactId" class="text-white/30 text-sm text-center py-12">
        Logga in för att se ditt schema
      </div>

      <div v-else-if="myEvents.length === 0" class="text-white/30 text-sm text-center py-12">
        Inga kommande tilldelningar
      </div>

      <!-- Events grouped by month -->
      <div v-else class="space-y-8">
        <div v-for="[month, events] in byMonth" :key="month">
          <h2 class="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3 capitalize">
            {{ monthLabel(month) }}
          </h2>
          <div class="space-y-2">
            <div
              v-for="ev in events" :key="ev.id"
              class="bg-white/5 border border-white/10 rounded-lg px-4 py-3 flex items-start gap-4"
            >
              <!-- Date block -->
              <div class="text-center min-w-[48px] shrink-0">
                <div class="text-[10px] text-white/40 uppercase">{{ dayLabel(ev.date) }}</div>
                <div class="text-2xl font-bold text-white leading-none">{{ dayNum(ev.date) }}</div>
              </div>
              <!-- Event info -->
              <div class="flex-1 min-w-0">
                <div class="text-sm font-semibold text-white/90 leading-tight">{{ ev.title }}</div>
                <div class="text-xs text-white/40 mt-0.5">
                  <span v-if="ev.time" class="text-white/50 font-mono">{{ ev.time }}</span>
                </div>
              </div>
              <!-- My tasks -->
              <div class="flex flex-wrap gap-1 shrink-0">
                <span
                  v-for="task in getMyTasks(ev.id)" :key="task"
                  class="text-[10px] px-2 py-0.5 rounded-full bg-accent/20 text-accent-light font-medium"
                >
                  {{ task }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Subscribe to calendar -->
      <div v-if="icalUrl && memberContactId" class="mt-8 bg-white/5 border border-white/10 rounded-lg p-4">
        <div class="flex items-center gap-2 mb-2">
          <CalendarDays :size="16" class="text-accent shrink-0" />
          <span class="text-sm font-semibold text-white/80">Prenumerera på ditt schema</span>
        </div>
        <p class="text-xs text-white/40 mb-3">Lägg till dina tilldelningar i din kalenderapp (Google, Apple, Outlook).</p>
        <div class="flex items-center gap-2">
          <a
            :href="webcalUrl"
            class="inline-flex items-center gap-1.5 bg-accent text-white text-xs font-semibold px-3 py-1.5 rounded-md no-underline hover:bg-accent-hover transition-colors"
          >
            <CalendarDays :size="13" /> Öppna i kalenderapp
          </a>
          <button
            @click="copyIcal"
            class="text-[11px] text-white/40 bg-transparent border border-white/15 rounded-md px-2.5 py-1.5 cursor-pointer hover:text-white/70 transition-colors"
          >
            Kopiera länk
          </button>
        </div>
      </div>

      <!-- ═══ Mina team ═══ -->
      <div v-if="memberContactId && teamTasks.length > 0" class="mt-8">
        <button @click="teamsOpen = !teamsOpen"
          class="flex items-center gap-2 w-full bg-transparent border-none cursor-pointer text-left p-0 mb-1">
          <span class="text-[10px] text-white/30 transition-transform" :class="teamsOpen ? 'rotate-90' : ''">▶</span>
          <h2 class="text-sm font-semibold text-white/50 uppercase tracking-wider">Mina team</h2>
          <span class="text-[11px] text-white/20">{{ myTeamsForTask(teamTasks[0]?.id).length ? 'Medlem' : 'Inget team' }}</span>
        </button>
        <div v-if="teamsOpen">
        <p class="text-xs text-white/30 mb-4 ml-4">Du kan vara med i ett team per uppgift. Teamet avgör vilka händelser du tilldelas.</p>

        <div v-for="task in teamTasks" :key="task.id" class="mb-6">
          <div class="text-xs font-semibold text-white/50 mb-2">{{ task.name }}</div>

          <!-- Teams I'm in -->
          <div v-for="team in myTeamsForTask(task.id)" :key="team.id"
            class="bg-accent/10 border border-accent/20 rounded-lg px-4 py-3 mb-2">
            <div class="flex items-center justify-between mb-1">
              <span class="text-sm font-semibold text-white/90">Team {{ team.number }}</span>
              <button @click="doLeaveTeam(team.id)"
                class="text-[11px] text-white/30 bg-transparent border border-white/10 rounded px-2 py-0.5 cursor-pointer hover:text-red-400 hover:border-red-400/30 transition-colors">
                Lämna team
              </button>
            </div>
            <div v-if="teamMemberNames(team).length" class="text-[11px] text-white/40">
              Övriga: {{ teamMemberNames(team).join(', ') }}
            </div>
            <div v-else class="text-[11px] text-white/25">Du är ensam i detta team</div>
          </div>

          <!-- Not in any team for this task -->
          <div v-if="myTeamsForTask(task.id).length === 0">
            <p class="text-xs text-white/30 mb-2">Du är inte med i något team för {{ task.name }}. Välj ett team att gå med i:</p>
            <div class="space-y-1.5">
              <button v-for="team in availableTeamsForTask(task.id)" :key="team.id"
                @click="doJoinTeam(team.id)"
                class="w-full text-left bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 cursor-pointer hover:border-accent/40 hover:bg-accent/5 transition-colors">
                <div class="text-sm text-white/70">Team {{ team.number }}
                  <span class="text-[11px] text-white/30 ml-1">{{ team.members.length }} {{ team.members.length === 1 ? 'person' : 'personer' }}</span>
                </div>
                <div v-if="teamMemberNames(team).length" class="text-[11px] text-white/30 mt-0.5">
                  {{ teamMemberNames(team).join(', ') }}
                </div>
              </button>
            </div>
            <div v-if="availableTeamsForTask(task.id).length === 0" class="text-xs text-white/20">Inga team tillgängliga</div>
          </div>
        </div>
        </div>
      </div>

      <!-- ═══ Mitt konto ═══ -->
      <div v-if="memberContactId && me" class="mt-8 bg-white/5 border border-white/10 rounded-lg p-4">
        <h2 class="text-sm font-semibold text-white/80 mb-3">Mitt konto</h2>
        <div class="space-y-3">
          <div>
            <label class="text-[11px] text-white/40 block mb-0.5">Namn</label>
            <input v-model="editName" type="text"
              class="w-full bg-white/5 border border-white/15 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-accent" />
          </div>
          <div>
            <label class="text-[11px] text-white/40 block mb-0.5">E-post</label>
            <input v-model="editEmail" type="email"
              class="w-full bg-white/5 border border-white/15 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-accent" />
          </div>
          <div>
            <label class="text-[11px] text-white/40 block mb-0.5">Telefon</label>
            <input v-model="editPhone" type="tel"
              class="w-full bg-white/5 border border-white/15 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-accent" />
          </div>
          <button @click="saveContact" :disabled="saving"
            class="flex items-center gap-1.5 bg-accent text-white text-xs font-semibold px-3 py-1.5 rounded-md border-none cursor-pointer hover:bg-accent-hover transition-colors disabled:opacity-50">
            <Save :size="13" /> Spara
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
