<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useStore } from '../composables/useStore'
import { useToday } from '../composables/useToday'
import { useFullscreen } from '../composables/useFullscreen'
import { useRoute, useRouter } from 'vue-router'
import { Maximize, Minimize } from 'lucide-vue-next'

const { db, assignments } = useStore()
const { isFullscreen, syncFromRoute } = useFullscreen()
const route = useRoute()
const router = useRouter()

const { todayStr: today } = useToday()
const selectedTaskId = ref<number | null>(null)

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-zåäö0-9]+/g, '-').replace(/^-|-$/g, '')
}

// Sync task + fullscreen from URL on mount
onMounted(() => {
  const taskSlug = route.params.task as string | undefined
  if (taskSlug && taskSlug !== 'fullscreen') {
    const task = db.tasks.find(t => slugify(t.name) === taskSlug)
    if (task) selectedTaskId.value = task.id
  }
  syncFromRoute()
})

// When task selection changes, update the URL
function selectTask(taskId: number | null) {
  selectedTaskId.value = taskId
  const slug = taskId ? slugify(db.tasks.find(t => t.id === taskId)?.name || '') : null
  const fs = isFullscreen.value ? '/fullscreen' : ''
  const path = slug ? `/namnskyltar/${slug}${fs}` : `/namnskyltar${fs}`
  router.replace(path)
}

// Keep fullscreen URL in sync when toggling
function toggleFullscreen() {
  toggle()
  // After toggle, update URL to reflect new state
  const slug = selectedTaskId.value
    ? slugify(db.tasks.find(t => t.id === selectedTaskId.value)?.name || '')
    : null
  const fs = !isFullscreen.value ? '/fullscreen' : '' // inverted because toggle already flipped
  const path = slug ? `/namnskyltar/${slug}${fs}` : `/namnskyltar${fs}`
  router.replace(path)
}

const todayEvents = computed(() =>
  db.events.filter(e => e.date === today.value).sort((a, b) => (a.time || '').localeCompare(b.time || ''))
)

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
  <div class="flex-1 bg-[#111] text-white flex flex-col overflow-hidden relative">
    <button
      @click="toggleFullscreen"
      class="absolute top-3 right-3 p-1.5 rounded-md bg-white/10 text-white/50 hover:text-white hover:bg-white/20 border-none cursor-pointer transition-colors z-10"
      :title="isFullscreen ? 'Avsluta fullskärm (Esc)' : 'Fullskärm (F)'"
    >
      <component :is="isFullscreen ? Minimize : Maximize" :size="16" />
    </button>

    <div class="flex items-center gap-2 p-4 border-b border-gray-800 shrink-0">
      <button
        @click="selectTask(null)"
        class="px-3 py-1 rounded text-xs cursor-pointer border transition-colors"
        :class="selectedTaskId === null ? 'bg-white text-black border-white' : 'bg-transparent text-gray-400 border-gray-700 hover:border-gray-500'"
      >
        Alla
      </button>
      <button
        v-for="task in db.tasks" :key="task.id"
        @click="selectTask(task.id)"
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
