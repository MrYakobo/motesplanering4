<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '../composables/useStore'
import { useToday } from '../composables/useToday'
import { AlertTriangle } from 'lucide-vue-next'
import type { Event } from '../types'

const { db, assignments, effectiveTasks } = useStore()
const { todayStr } = useToday()

const emit = defineEmits<{ pick: [eid: number, tid: number]; distribute: [tid: number] }>()

const selectedTaskId = ref<number | null>(db.tasks[0]?.id ?? null)

const selectedTask = computed(() => db.tasks.find(t => t.id === selectedTaskId.value))

const events = computed(() =>
  [...db.events]
    .filter(ev => effectiveTasks(ev).includes(selectedTaskId.value!))
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
    .filter(ev => ev.date >= todayStr.value && effectiveTasks(ev).includes(taskId) && !assignments[ev.id]?.[taskId])
    .length
}
</script>

<template>
  <div class="flex flex-col flex-1 overflow-hidden">
    <!-- Task tabs -->
    <div class="mob-task-bar">
      <button
        v-for="task in db.tasks" :key="task.id"
        @click="selectedTaskId = task.id"
        class="mob-task-pill"
        :class="{ 'mob-task-active': selectedTaskId === task.id }"
      >
        {{ task.name }}
        <span
          v-if="unassignedCount(task.id) > 0"
          class="mob-task-badge"
          :class="{ 'mob-task-badge-active': selectedTaskId === task.id }"
        >{{ unassignedCount(task.id) }}</span>
      </button>
    </div>

    <!-- Distribute bar -->
    <div v-if="selectedTask && unassignedCount(selectedTask.id) > 0" class="mob-warn-bar">
      <AlertTriangle :size="14" class="text-amber-600 shrink-0" />
      <span class="text-xs text-amber-800 flex-1">{{ unassignedCount(selectedTask.id) }} otilldelade</span>
      <button @click="emit('distribute', selectedTask.id)" class="mob-dist-btn">Fördela</button>
    </div>

    <!-- Event list -->
    <div class="flex-1 overflow-y-auto" style="background: linear-gradient(180deg, #e0e0e0 0%, #d4d4d4 100%)">
      <div v-if="futureEvents.length > 0">
        <div
          v-for="ev in futureEvents" :key="ev.id"
          @click="emit('pick', ev.id, selectedTaskId!)"
          class="mob-event-card"
        >
          <div class="min-w-0 flex-1">
            <div class="text-xs text-[#999] font-mono">{{ ev.date }} {{ ev.time || '' }}</div>
            <div class="text-sm font-medium text-[#333] truncate">{{ ev.title }}</div>
          </div>
          <div class="shrink-0 text-right">
            <div v-if="assignmentLabel(ev)" class="text-sm text-[#5b4fc7] font-medium max-w-[140px] truncate">
              {{ assignmentLabel(ev) }}
            </div>
            <div v-else class="flex items-center gap-1 text-xs text-amber-600">
              <AlertTriangle :size="12" /> Ej tilldelad
            </div>
          </div>
        </div>
      </div>
      <div v-else class="px-4 py-8 text-center text-sm text-[#999]">
        Inga kommande händelser med denna uppgift
      </div>

      <details v-if="pastEvents.length > 0" class="border-t border-[#ccc]">
        <summary class="px-4 py-2 text-xs text-[#999] cursor-pointer hover:text-[#666]" style="text-shadow: 0 1px 0 rgba(255,255,255,.5)">
          {{ pastEvents.length }} tidigare händelser
        </summary>
        <div>
          <div
            v-for="ev in pastEvents" :key="ev.id"
            class="mob-event-card opacity-50"
          >
            <div class="min-w-0 flex-1">
              <div class="text-xs text-[#999] font-mono">{{ ev.date }}</div>
              <div class="text-xs text-[#666] truncate">{{ ev.title }}</div>
            </div>
            <div class="text-xs text-[#999] shrink-0 max-w-[120px] truncate">
              {{ assignmentLabel(ev) || '—' }}
            </div>
          </div>
        </div>
      </details>
    </div>
  </div>
</template>

<style scoped>
.mob-task-bar {
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  overflow-x: auto;
  flex-shrink: 0;
  -webkit-overflow-scrolling: touch;
  background: linear-gradient(180deg, #e8e8e8 0%, #d4d4d4 100%);
  border-bottom: 1px solid #bbb;
  box-shadow: 0 1px 0 rgba(255,255,255,.4) inset;
}
.mob-task-pill {
  padding: 5px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  flex-shrink: 0;
  color: #555;
  border: 1px solid #bbb;
  background: linear-gradient(180deg, #f4f4f4 0%, #ddd 100%);
  box-shadow: 0 1px 0 rgba(255,255,255,.5) inset, 0 1px 2px rgba(0,0,0,.06);
  text-shadow: 0 1px 0 rgba(255,255,255,.7);
  transition: all 0.1s ease;
}
.mob-task-active {
  color: #fff !important;
  border-color: rgba(0,0,0,.2) !important;
  background: linear-gradient(180deg, #6a5aed 0%, #4a3cc9 100%) !important;
  box-shadow: 0 1px 0 rgba(255,255,255,.2) inset, 0 1px 3px rgba(59,47,186,.3) !important;
  text-shadow: 0 -1px 0 rgba(0,0,0,.2) !important;
}
.mob-task-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  font-size: 9px;
  font-weight: 700;
  margin-left: 4px;
  color: #7c5a00;
  background: linear-gradient(180deg, #fff4cc 0%, #ffe699 100%);
  border: 1px solid #d4a800;
}
.mob-task-badge-active {
  color: #fff;
  background: rgba(255,255,255,.25);
  border-color: rgba(255,255,255,.3);
}

.mob-warn-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  flex-shrink: 0;
  background: linear-gradient(180deg, #fff4cc 0%, #ffe699 100%);
  border-bottom: 1px solid #d4a800;
  box-shadow: 0 1px 0 rgba(255,255,255,.4) inset;
}
.mob-dist-btn {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 5px;
  cursor: pointer;
  color: #fff;
  border: 1px solid rgba(0,0,0,.2);
  background: linear-gradient(180deg, #6a5aed 0%, #4a3cc9 100%);
  box-shadow: 0 1px 0 rgba(255,255,255,.2) inset;
  text-shadow: 0 -1px 0 rgba(0,0,0,.15);
}

.mob-event-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  margin: 0 8px 4px;
  border-radius: 8px;
  background: linear-gradient(180deg, #f7f7f7 0%, #eaeaea 100%);
  border: 1px solid #c0c0c0;
  box-shadow: 0 1px 0 rgba(255,255,255,.6) inset, 0 1px 3px rgba(0,0,0,.06);
  transition: all 0.1s ease;
}
.mob-event-card:first-child { margin-top: 8px; }
.mob-event-card:active {
  background: linear-gradient(180deg, #f0ecff 0%, #e8e0ff 100%);
  border-color: #6a5aed;
}
</style>
