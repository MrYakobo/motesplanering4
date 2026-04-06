<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '../composables/useStore'
import { useToast } from '../composables/useToast'
import DataTable from '../components/DataTable.vue'
import RecordModal from '../components/RecordModal.vue'
import TaskForm from '../components/TaskForm.vue'
import { PlusCircle } from 'lucide-vue-next'
import type { Task } from '../types'

const { db, selectedId, searchQuery, persist, assignments, effectiveTasks } = useStore()
const { show: toast } = useToast()

const editing = ref<Task | null>(null)
const modalOpen = computed(() => editing.value !== null)

// Delete-preview state
const deletePreview = ref<{
  task: Task
  affectedEvents: { date: string; title: string }[]
  affectedTeams: { number: number; memberCount: number }[]
  affectedPersonCount: number
} | null>(null)

const filtered = computed(() => {
  const q = searchQuery.value.toLowerCase()
  let data = [...db.tasks]
  if (q) data = data.filter(t => t.name.toLowerCase().includes(q))
  return data
})

const mailbotCount = computed(() => db.tasks.filter(t => t.mailbot).length)

const badge = (v: boolean) => v
  ? '<span class="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">Ja</span>'
  : '<span class="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-500">Nej</span>'

const columns = [
  { key: 'name', label: 'Namn', render: (r: Task) => r.name },
  { key: 'teamTask', label: 'Teamuppgift', render: (r: Task) => badge(r.teamTask) },
  { key: 'mailbot', label: 'Mailbot', render: (r: Task) => badge(r.mailbot) },
  { key: 'phrase', label: 'Påminnelsefras', render: (r: Task) => r.phrase ? `"${r.phrase}"` : '<span class="text-gray-400">—</span>' },
]

function onSelect(id: number) {
  const t = db.tasks.find(x => x.id === id)
  if (t) editing.value = { ...t }
}

function newTask() {
  const maxId = db.tasks.reduce((m, t) => Math.max(m, t.id), 0) + 1
  editing.value = { id: maxId, name: '', teamTask: false, mailbot: false, phrase: '' }
}

async function onSave(t: Task) {
  const idx = db.tasks.findIndex(x => x.id === t.id)
  if (idx >= 0) db.tasks[idx] = t
  else db.tasks.push(t)
  await persist('tasks')
  editing.value = null
  toast('Uppgift sparad')
}

function onDelete(id: number) {
  const task = db.tasks.find(t => t.id === id)
  if (!task) return

  // Find affected events (expected or assigned)
  const affectedEvents = db.events.filter(ev => {
    const hasExpected = effectiveTasks(ev).includes(id)
    const hasAssigned = !!assignments[ev.id]?.[id]
    return hasExpected || hasAssigned
  })

  // Find affected teams
  const affectedTeams = db.teams.filter(t => t.taskId === id)
  const persons = new Set<number>()
  affectedTeams.forEach(t => t.members.forEach(m => persons.add(m)))
  affectedEvents.forEach(ev => {
    const asgn = assignments[ev.id]?.[id]
    if (asgn?.type === 'contact') (asgn.ids || []).forEach(cid => persons.add(cid))
    if (asgn?.type === 'team') {
      const team = db.teams.find(t => t.id === asgn.id)
      if (team) team.members.forEach(m => persons.add(m))
    }
  })

  deletePreview.value = {
    task,
    affectedEvents: affectedEvents.map(ev => ({ date: ev.date, title: ev.title })),
    affectedTeams: affectedTeams.map(t => ({ number: t.number, memberCount: t.members.length })),
    affectedPersonCount: persons.size,
  }
}

async function confirmDelete() {
  if (!deletePreview.value) return
  const taskId = deletePreview.value.task.id

  // Remove from expectedTasks on all events
  db.events.forEach(ev => {
    if (ev.expectedTasks) ev.expectedTasks = ev.expectedTasks.filter(id => id !== taskId)
  })
  // Remove from category defaultTasks
  db.categories.forEach(cat => {
    if (cat.defaultTasks) cat.defaultTasks = cat.defaultTasks.filter(id => id !== taskId)
  })
  // Remove assignments for this task
  Object.keys(assignments).forEach(eid => {
    delete assignments[parseInt(eid)][taskId]
  })
  // Remove teams for this task
  db.teams = db.teams.filter(t => t.taskId !== taskId)
  // Remove the task itself
  db.tasks = db.tasks.filter(t => t.id !== taskId)

  // Persist schedules (assignments) as well as tasks, events, teams
  db.schedules = assignments as any
  await persist('schedules')
  await persist('tasks')
  await persist('events')
  await persist('teams')

  deletePreview.value = null
  editing.value = null
  toast('Uppgift borttagen')
}
</script>

<template>
  <div class="flex flex-col flex-1 overflow-hidden">
    <div class="skeu-toolbar">
      <span class="skeu-toolbar-label">Totalt: <strong>{{ filtered.length }}</strong> uppgifter</span>
      <span class="skeu-toolbar-label">Mailbot aktiv: <strong>{{ mailbotCount }}</strong></span>
      <button @click="newTask" class="skeu-toolbar-btn">
        <PlusCircle :size="13" /> Ny uppgift
      </button>
      <input v-model="searchQuery" type="search" placeholder="Sök..." class="skeu-search ml-auto" />
    </div>
    <DataTable :columns="columns" :rows="filtered" :selected-id="selectedId" @select="onSelect" />
    <RecordModal :open="modalOpen" :title="editing?.name || 'Ny uppgift'" @close="editing = null">
      <TaskForm v-if="editing" :task="editing" @save="onSave" @delete="onDelete" />
    </RecordModal>

    <!-- Delete confirmation modal -->
    <RecordModal :open="deletePreview !== null" :title="'Ta bort &quot;' + (deletePreview?.task.name || '') + '&quot;?'" @close="deletePreview = null">
      <div v-if="deletePreview" class="space-y-4">
        <p v-if="deletePreview.affectedEvents.length === 0 && deletePreview.affectedTeams.length === 0" class="text-sm text-gray-700">
          Denna uppgift används inte av några händelser eller team.
        </p>
        <template v-else>
          <p class="text-sm text-gray-700">
            Detta påverkar <strong>{{ deletePreview.affectedEvents.length }}</strong> händelser
            och <strong>{{ deletePreview.affectedPersonCount }}</strong> personer:
          </p>
          <div class="max-h-[300px] overflow-y-auto border border-gray-200 rounded-md p-2">
            <div v-if="deletePreview.affectedEvents.length" class="mb-3">
              <div class="text-xs font-semibold text-gray-500 mb-1">{{ deletePreview.affectedEvents.length }} händelser</div>
              <div v-for="ev in deletePreview.affectedEvents.slice(0, 20)" :key="ev.date + ev.title" class="text-xs text-gray-700 py-0.5">
                {{ ev.date }} — {{ ev.title }}
              </div>
              <div v-if="deletePreview.affectedEvents.length > 20" class="text-[11px] text-gray-400">
                +{{ deletePreview.affectedEvents.length - 20 }} till
              </div>
            </div>
            <div v-if="deletePreview.affectedTeams.length">
              <div class="text-xs font-semibold text-gray-500 mb-1">{{ deletePreview.affectedTeams.length }} team tas bort</div>
              <div v-for="t in deletePreview.affectedTeams" :key="t.number" class="text-xs text-gray-700 py-0.5">
                Team {{ t.number }} ({{ t.memberCount }} medlemmar)
              </div>
            </div>
          </div>
        </template>
        <div class="flex gap-2 pt-4 border-t border-gray-200">
          <button @click="deletePreview = null" class="border border-gray-300 rounded-md px-4 py-1.5 text-sm cursor-pointer hover:bg-gray-50 transition-colors">Avbryt</button>
          <span class="flex-1" />
          <button @click="confirmDelete" class="bg-red-500 text-white rounded-md px-4 py-1.5 text-sm cursor-pointer hover:bg-red-600 transition-colors">Ta bort uppgift</button>
        </div>
      </div>
    </RecordModal>
  </div>
</template>

<style scoped>
</style>
