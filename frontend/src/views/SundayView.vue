<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from '../composables/useStore'
import { useToday } from '../composables/useToday'
import { useFullscreen } from '../composables/useFullscreen'
import { Maximize, Minimize } from 'lucide-vue-next'

const { db, assignments } = useStore()
const { isFullscreen, toggle } = useFullscreen()
const { todayStr: today } = useToday()

const todayEvents = computed(() =>
  db.events
    .filter(e => e.date === today.value)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
)

function getAssignments(eid: number) {
  const asgn = assignments[eid] || {}
  const result: { taskName: string; people: string[] }[] = []
  for (const [tid, a] of Object.entries(asgn)) {
    const task = db.tasks.find(t => t.id === parseInt(tid))
    if (!task) continue
    let people: string[] = []
    if (a.type === 'team') {
      const team = db.teams.find(t => t.id === a.id)
      if (team) people = team.members.map(mid => db.contacts.find(c => c.id === mid)?.name || '?')
    } else if (a.type === 'contact') {
      people = (a.ids || []).map(id => db.contacts.find(c => c.id === id)?.name || '?')
    }
    if (people.length > 0) result.push({ taskName: task.name, people })
  }
  return result
}
</script>

<template>
  <div class="flex-1 overflow-y-auto bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] text-white p-6 relative">
    <button @click="toggle" class="absolute top-4 right-4 p-1.5 rounded-md bg-white/10 text-white/50 hover:text-white hover:bg-white/20 border-none cursor-pointer transition-colors z-10" :title="isFullscreen ? 'Avsluta fullskärm (Esc)' : 'Fullskärm (F)'">
      <component :is="isFullscreen ? Minimize : Maximize" :size="16" />
    </button>
    <div class="max-w-2xl mx-auto">
      <h1 class="text-2xl font-extrabold mb-1">Tjänstgöring idag</h1>
      <p class="text-sm text-white/40 mb-8">{{ today }}</p>

      <div v-if="todayEvents.length === 0" class="text-white/30 text-sm">
        Inga händelser idag
      </div>

      <div v-for="ev in todayEvents" :key="ev.id" class="mb-8">
        <div class="flex items-baseline gap-3 mb-3">
          <span class="text-white/50 text-sm font-mono">{{ ev.time }}</span>
          <h2 class="text-lg font-bold">{{ ev.title }}</h2>
        </div>
        <div class="space-y-2 pl-4 border-l-2 border-white/10">
          <div v-for="a in getAssignments(ev.id)" :key="a.taskName">
            <div class="text-xs text-white/40 uppercase tracking-wider mb-0.5">{{ a.taskName }}</div>
            <div class="text-sm text-white/80">{{ a.people.join(', ') }}</div>
          </div>
          <div v-if="getAssignments(ev.id).length === 0" class="text-xs text-white/20">
            Inga tilldelningar
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
