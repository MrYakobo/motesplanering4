<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from '../composables/useStore'
import { useToday } from '../composables/useToday'
import { CalendarDays } from 'lucide-vue-next'

const { db, assignments, memberContactId } = useStore()
const { todayStr } = useToday()

const me = computed(() =>
  memberContactId.value ? db.contacts.find(c => c.id === memberContactId.value) : null
)

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
    </div>
  </div>
</template>
