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
  <div class="flex-1 overflow-y-auto">
    <div class="max-w-2xl mx-auto px-4 py-6">
      <!-- Header -->
      <div class="mb-6">
        <h1 class="text-lg font-extrabold text-[#333]" style="text-shadow: 0 1px 0 rgba(255,255,255,.7)">
          {{ me ? `Hej ${me.name.split(' ')[0]}` : 'Mitt schema' }}
        </h1>
        <p class="text-xs text-[#999]">Dina kommande tilldelningar</p>
      </div>

      <!-- Subscribe -->
      <div v-if="icalUrl && memberContactId" class="mt-6 p-3 rounded-lg border border-[#d8d8d8] bg-gradient-to-b from-[#f8f8f8] to-[#f0f0f0]">
        <div class="flex items-center gap-2 mb-1.5">
          <CalendarDays :size="14" class="text-accent shrink-0" />
          <span class="text-xs font-semibold text-[#555]">Prenumerera på ditt schema</span>
        </div>
        <p class="text-[10px] text-[#999] mb-2">Lägg till i din kalenderapp (Google, Apple, Outlook).</p>
        <div class="flex items-center gap-2">
          <a :href="webcalUrl"
            class="inline-flex items-center gap-1.5 bg-accent text-white text-[11px] font-semibold px-3 py-1.5 rounded-md no-underline hover:bg-accent-hover transition-colors">
            <CalendarDays :size="12" /> Öppna i kalenderapp
          </a>
          <button @click="copyIcal"
            class="text-[11px] text-[#888] bg-transparent border border-[#ccc] rounded-md px-2.5 py-1.5 cursor-pointer hover:bg-white transition-colors">
            Kopiera länk
          </button>
        </div>
      </div>

      <br>

      <div v-if="!memberContactId" class="text-[#aaa] text-sm text-center py-12">Logga in för att se ditt schema</div>
      <div v-else-if="myEvents.length === 0" class="text-[#aaa] text-sm text-center py-12">Inga kommande tilldelningar</div>

      <!-- Events grouped by month -->
      <div v-else class="space-y-6">
        <div v-for="[month, events] in byMonth" :key="month">
          <h2 class="text-[11px] font-semibold text-[#999] uppercase tracking-wider mb-2 capitalize">{{ monthLabel(month) }}</h2>
          <div class="space-y-1">
            <div v-for="ev in events" :key="ev.id"
              class="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-[#d8d8d8] bg-gradient-to-b from-[#f8f8f8] to-[#f0f0f0]">
              <div class="text-center min-w-[40px] shrink-0">
                <div class="text-[9px] text-[#999] uppercase">{{ dayLabel(ev.date) }}</div>
                <div class="text-xl font-bold text-[#333] leading-none">{{ dayNum(ev.date) }}</div>
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-semibold text-[#333] leading-tight">{{ ev.title }}</div>
                <div v-if="ev.time" class="text-[11px] text-[#999] font-mono mt-0.5">{{ ev.time }}</div>
              </div>
              <div class="flex flex-wrap gap-1 shrink-0">
                <span v-for="task in getMyTasks(ev.id)" :key="task"
                  class="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-semibold border border-accent/20">
                  {{ task }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
