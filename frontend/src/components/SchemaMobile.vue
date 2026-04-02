<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '../composables/useStore'
import { useToday } from '../composables/useToday'
import { AlertTriangle } from 'lucide-vue-next'
import type { Event } from '../types'

const { db, assignments } = useStore()
const { todayStr } = useToday()

const emit = defineEmits<{ pick: [eid: number, tid: number]; distribute: [tid: number] }>()

const selectedTaskId = ref<number | null>(db.tasks[0]?.id ?? null)

const selectedTask = computed(() => db.tasks.find(t => t.id === selectedTaskId.value))

const events = computed(() =>
  [...db.events]
    .filter(ev => (ev.expectedTasks || []).includes(selectedTaskId.value!))
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
)

const futureEvents = computed(() => events.value.filter(e => e.date >= todayStr.value))
const pastEvents = computed(() => events.value.filter(e => e.date < todayStr.value))

function assignmentLabel(ev: Event): string {
  const task = selectedTask.value
  if (!task) return '—'
  const asgn = assignments[ev.id]?.[task.id]
  if (!asgn) return ''
  if (task.teamTask) {
    const t = db.teams.find(t => t.id === asgn.id)
    return t ? `Team ${t.number}` : '—'
  }
  const ids = asgn.ids || []
  return ids.map(id => db.contacts.find(c => c.id === id)?.name).filter(Boolean).join(', ')
}

function unassignedCount(taskId: number): number {
  return db.events
    .filter(ev => ev.date >= todayStr.value && (ev.expectedTasks || []).includes(taskId) && !assignments[ev.id]?.[taskId])
    .length
}
</script>

<template>
  <div class="flex flex-col flex-1 overflow-hidden">
    <!-- Task tabs -->
    <div class="flex gap-1 px-3 py-2 bg-white border-b border-gray-200 overflow-x-auto shrink-0" style="-webkit-overflow-scrolling:touch">
      <button
        v-for="task in db.tasks" :key="task.id"
        @click="selectedTaskId = task.id"
        class="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border-none cursor-pointer transition-colors shrink-0"
        :class="selectedTaskId === task.id
          ? 'bg-accent text-white'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
      >
        {{ task.name }}
        <span
          v-if="unassignedCount(task.id) > 0"
          class="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold"
          :class="selectedTaskId === task.id ? 'bg-white/30 text-white' : 'bg-amber-100 text-amber-700'"
        >{{ unassignedCount(task.id) }}</span>
      </button>
    </div>

    <!-- Task info + distribute -->
    <div v-if="selectedTask && unassignedCount(selectedTask.id) > 0" class="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-100 shrink-0">
      <AlertTriangle :size="14" class="text-amber-500 shrink-0" />
      <span class="text-xs text-amber-700 flex-1">{{ unassignedCount(selectedTask.id) }} otilldelade</span>
      <button
        @click="emit('distribute', selectedTask.id)"
        class="text-xs font-semibold px-2.5 py-1 rounded-md bg-accent text-white border-none cursor-pointer hover:bg-accent-hover transition-colors"
      >
        Fördela
      </button>
    </div>

    <!-- Event list for selected task -->
    <div class="flex-1 overflow-y-auto">
      <!-- Future events -->
      <div v-if="futureEvents.length > 0" class="divide-y divide-gray-100">
        <div
          v-for="ev in futureEvents" :key="ev.id"
          @click="emit('pick', ev.id, selectedTaskId!)"
          class="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors"
        >
          <div class="min-w-0 flex-1">
            <div class="text-xs text-gray-400 font-mono">{{ ev.date }} {{ ev.time || '' }}</div>
            <div class="text-sm font-medium text-gray-800 truncate">{{ ev.title }}</div>
          </div>
          <div class="shrink-0 text-right">
            <div v-if="assignmentLabel(ev)" class="text-sm text-accent font-medium max-w-[140px] truncate">
              {{ assignmentLabel(ev) }}
            </div>
            <div v-else class="flex items-center gap-1 text-xs text-amber-500">
              <AlertTriangle :size="12" /> Ej tilldelad
            </div>
          </div>
        </div>
      </div>
      <div v-else class="px-4 py-8 text-center text-sm text-gray-400">
        Inga kommande händelser med denna uppgift
      </div>

      <!-- Past events (collapsed) -->
      <details v-if="pastEvents.length > 0" class="border-t border-gray-200">
        <summary class="px-4 py-2 text-xs text-gray-400 cursor-pointer hover:text-gray-600">
          {{ pastEvents.length }} tidigare händelser
        </summary>
        <div class="divide-y divide-gray-50">
          <div
            v-for="ev in pastEvents" :key="ev.id"
            class="flex items-center gap-3 px-4 py-2 opacity-50"
          >
            <div class="min-w-0 flex-1">
              <div class="text-xs text-gray-400 font-mono">{{ ev.date }}</div>
              <div class="text-xs text-gray-500 truncate">{{ ev.title }}</div>
            </div>
            <div class="text-xs text-gray-400 shrink-0 max-w-[120px] truncate">
              {{ assignmentLabel(ev) || '—' }}
            </div>
          </div>
        </div>
      </details>
    </div>
  </div>
</template>
