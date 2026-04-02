<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '../composables/useStore'

const { db, assignments } = useStore()

const today = new Date().toISOString().slice(0, 10)
const selectedTaskId = ref<number | null>(null)

const todayEvents = computed(() =>
  db.events.filter(e => e.date === today).sort((a, b) => (a.time || '').localeCompare(b.time || ''))
)

// Get all people assigned today with their task
const assignedPeople = computed(() => {
  const result: { name: string; task: string }[] = []
  todayEvents.value.forEach(ev => {
    const asgn = assignments[ev.id] || {}
    for (const [tid, a] of Object.entries(asgn)) {
      if (selectedTaskId.value !== null && parseInt(tid) !== selectedTaskId.value) continue
      const task = db.tasks.find(t => t.id === parseInt(tid))
      if (!task) continue
      const ids = a.type === 'contact' ? (a.ids || []) :
        a.type === 'team' ? (db.teams.find(t => t.id === a.id)?.members || []) : []
      ids.forEach(id => {
        const c = db.contacts.find(x => x.id === id)
        if (c) result.push({ name: c.name, task: task.name })
      })
    }
  })
  return result
})
</script>

<template>
  <div class="flex-1 bg-[#111] text-white flex flex-col overflow-hidden">
    <div class="flex items-center gap-2 p-4 border-b border-gray-800 shrink-0">
      <button
        @click="selectedTaskId = null"
        class="px-3 py-1 rounded text-xs cursor-pointer border transition-colors"
        :class="selectedTaskId === null ? 'bg-white text-black border-white' : 'bg-transparent text-gray-400 border-gray-700 hover:border-gray-500'"
      >
        Alla
      </button>
      <button
        v-for="task in db.tasks" :key="task.id"
        @click="selectedTaskId = task.id"
        class="px-3 py-1 rounded text-xs cursor-pointer border transition-colors"
        :class="selectedTaskId === task.id ? 'bg-white text-black border-white' : 'bg-transparent text-gray-400 border-gray-700 hover:border-gray-500'"
      >
        {{ task.name }}
      </button>
    </div>

    <div class="flex-1 flex items-end justify-start p-[4vw]" v-if="assignedPeople.length > 0">
      <div>
        <div v-for="(p, i) in assignedPeople" :key="i" class="mb-6">
          <div class="text-[min(8vw,96px)] font-extrabold uppercase tracking-wider leading-none">{{ p.name }}</div>
          <hr class="border-2 border-white rounded-full my-2 w-full" />
          <div class="text-[min(3.5vw,42px)] font-light opacity-85 ml-1">{{ p.task }}</div>
        </div>
      </div>
    </div>
    <div v-else class="flex-1 flex items-center justify-center text-gray-600 text-sm">
      Inga tilldelade idag
    </div>
  </div>
</template>
