<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '../composables/useStore'
import { useToast } from '../composables/useToast'
import RecordModal from '../components/RecordModal.vue'
import { PlusCircle, X, Search } from 'lucide-vue-next'
import type { Team } from '../types'

const { db, persist } = useStore()
const { show: toast } = useToast()

const activeTaskId = ref<number | null>(null)
const poolSearch = ref('')
const pickerTeamId = ref<number | null>(null)
const pickerSearch = ref('')

const teamTasks = computed(() => db.tasks.filter(t => t.teamTask))

// Auto-select first task
if (!activeTaskId.value && teamTasks.value.length > 0) {
  activeTaskId.value = teamTasks.value[0].id
}

const teams = computed(() =>
  db.teams.filter(t => t.taskId === activeTaskId.value).sort((a, b) => a.number - b.number)
)

const allInTeams = computed(() => {
  const s = new Set<number>()
  teams.value.forEach(t => t.members.forEach(m => s.add(m)))
  return s
})

const poolContacts = computed(() => {
  const q = poolSearch.value.toLowerCase()
  return db.contacts
    .filter(c => !q || c.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name))
})

const pickerContacts = computed(() => {
  if (!pickerTeamId.value) return []
  const team = db.teams.find(t => t.id === pickerTeamId.value)
  if (!team) return []
  const existing = new Set(team.members)
  const q = pickerSearch.value.toLowerCase()
  return db.contacts
    .filter(c => !existing.has(c.id) && (!q || c.name.toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name))
})

function selectTask(id: number) { activeTaskId.value = id }

async function createTeam() {
  if (!activeTaskId.value) return
  const maxId = db.teams.reduce((m, t) => Math.max(m, t.id), 0) + 1
  const nextNum = teams.value.length > 0 ? Math.max(...teams.value.map(t => t.number)) + 1 : 1
  db.teams.push({ id: maxId, taskId: activeTaskId.value, number: nextNum, members: [] })
  await persist('teams')
}

async function deleteTeam(id: number) {
  db.teams = db.teams.filter(t => t.id !== id)
  await persist('teams')
  toast('Team borttaget')
}

async function removeMember(teamId: number, contactId: number) {
  const team = db.teams.find(t => t.id === teamId)
  if (!team) return
  team.members = team.members.filter(id => id !== contactId)
  await persist('teams')
}

async function addMember(teamId: number, contactId: number) {
  const team = db.teams.find(t => t.id === teamId)
  if (!team) return
  if (!team.members.includes(contactId)) team.members.push(contactId)
  await persist('teams')
  pickerTeamId.value = null
  pickerSearch.value = ''
}

function contactName(id: number) {
  return db.contacts.find(c => c.id === id)?.name ?? '?'
}

function initials(name: string) {
  const parts = name.split(' ').filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (parts[0] || '?').slice(0, 2).toUpperCase()
}

// Drag and drop
const dragContactId = ref<number | null>(null)
const dragFromTeamId = ref<string | null>(null)
const dragOverTeamId = ref<string | null>(null)

function onDragStart(contactId: number, fromTeamId: string) {
  dragContactId.value = contactId
  dragFromTeamId.value = fromTeamId
}

function onDragOver(e: DragEvent, teamId: string) {
  e.preventDefault()
  dragOverTeamId.value = teamId
}

function onDragLeave() {
  dragOverTeamId.value = null
}

async function onDrop(toTeamId: string) {
  dragOverTeamId.value = null
  if (dragContactId.value === null || dragFromTeamId.value === toTeamId) return

  // Remove from old team
  if (dragFromTeamId.value !== 'pool') {
    const from = db.teams.find(t => t.id === parseInt(dragFromTeamId.value!))
    if (from) from.members = from.members.filter(id => id !== dragContactId.value)
  }
  // Add to new team
  if (toTeamId !== 'pool') {
    const to = db.teams.find(t => t.id === parseInt(toTeamId))
    if (to && !to.members.includes(dragContactId.value!)) to.members.push(dragContactId.value!)
  }

  await persist('teams')
  dragContactId.value = null
  dragFromTeamId.value = null
}
</script>

<template>
  <div class="flex flex-col flex-1 overflow-hidden">
    <!-- Task tabs -->
    <div class="flex items-center gap-1 px-4 py-2.5 bg-white border-b border-gray-200 shrink-0 overflow-x-auto">
      <button
        v-for="task in teamTasks" :key="task.id"
        @click="selectTask(task.id)"
        class="px-3 py-1 rounded-md text-sm border cursor-pointer transition-colors shrink-0"
        :class="task.id === activeTaskId
          ? 'bg-accent text-white border-accent'
          : 'bg-transparent text-gray-500 border-gray-200 hover:bg-gray-50'"
      >
        {{ task.name }}
      </button>
      <span class="flex-1" />
      <span class="text-xs text-gray-400">{{ teams.length }} team · {{ allInTeams.size }} personer</span>
    </div>

    <!-- Board -->
    <div class="flex flex-1 overflow-x-auto gap-px bg-gray-200">
      <!-- Pool -->
      <div class="bg-white min-w-[240px] max-w-[280px] flex flex-col shrink-0">
        <div class="px-3 py-2.5 text-sm font-bold text-gray-700 border-b border-gray-200 flex items-center justify-between">
          Alla personer <span class="text-xs font-normal text-gray-400">{{ db.contacts.length }}</span>
        </div>
        <div class="px-2 py-1.5 border-b border-gray-200">
          <div class="flex items-center gap-1.5 border border-gray-200 rounded-md px-2 py-1">
            <Search :size="13" class="text-gray-400 shrink-0" />
            <input v-model="poolSearch" type="text" placeholder="Sök…" class="border-none outline-none text-sm flex-1 bg-transparent" />
          </div>
        </div>
        <div
          class="flex-1 overflow-y-auto p-1.5"
          @dragover="onDragOver($event, 'pool')"
          @dragleave="onDragLeave"
          @drop="onDrop('pool')"
          :class="{ 'bg-indigo-50': dragOverTeamId === 'pool' }"
        >
          <div
            v-for="c in poolContacts" :key="c.id"
            class="px-2.5 py-1 mb-0.5 rounded-md text-xs cursor-grab border border-gray-200"
            :class="allInTeams.has(c.id) ? 'opacity-35 italic text-gray-500' : 'text-gray-600'"
            draggable="true"
            @dragstart="onDragStart(c.id, 'pool')"
          >
            {{ c.name }}
          </div>
        </div>
      </div>

      <!-- Team columns -->
      <div
        v-for="team in teams" :key="team.id"
        class="bg-gray-50 min-w-[200px] flex-1 flex flex-col"
      >
        <div class="px-3 py-2.5 text-sm font-bold text-gray-700 border-b border-gray-200 flex items-center justify-between">
          Team {{ team.number }}
          <button @click="deleteTeam(team.id)" class="text-gray-300 hover:text-red-500 transition-colors cursor-pointer bg-transparent border-none p-0.5">
            <X :size="14" />
          </button>
        </div>
        <div
          class="flex-1 overflow-y-auto p-1.5 transition-colors"
          @dragover="onDragOver($event, String(team.id))"
          @dragleave="onDragLeave"
          @drop="onDrop(String(team.id))"
          :class="{ 'bg-indigo-50': dragOverTeamId === String(team.id) }"
        >
          <div
            v-for="mid in team.members" :key="mid"
            class="bg-white border border-gray-200 rounded-md px-2.5 py-1.5 mb-1 text-sm flex items-center gap-2 cursor-grab hover:border-accent hover:bg-indigo-50 transition-colors"
            draggable="true"
            @dragstart="onDragStart(mid, String(team.id))"
          >
            <div class="w-6 h-6 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center shrink-0">
              {{ initials(contactName(mid)) }}
            </div>
            {{ contactName(mid) }}
            <button @click="removeMember(team.id, mid)" class="ml-auto text-gray-300 hover:text-red-500 transition-colors cursor-pointer bg-transparent border-none p-0.5">
              <X :size="12" />
            </button>
          </div>
        </div>
        <button
          @click="pickerTeamId = team.id; pickerSearch = ''"
          class="border-none border-t border-gray-200 py-2 px-3 text-xs text-accent cursor-pointer bg-transparent flex items-center gap-1 hover:bg-indigo-50 transition-colors"
        >
          <PlusCircle :size="12" /> Lägg till
        </button>
      </div>

      <!-- New team column -->
      <div
        @click="createTeam"
        class="min-w-[120px] flex items-center justify-center text-gray-400 text-sm cursor-pointer hover:bg-gray-100 transition-colors shrink-0 px-6"
      >
        <div class="text-center">
          <PlusCircle :size="24" class="mx-auto mb-1" />
          Nytt team
        </div>
      </div>
    </div>

    <!-- Member picker modal -->
    <RecordModal
      :open="pickerTeamId !== null"
      :title="'Lägg till medlem'"
      @close="pickerTeamId = null"
    >
      <input
        v-model="pickerSearch"
        type="text"
        placeholder="Sök person…"
        class="w-full border border-gray-300 rounded-md px-2.5 py-2 text-sm outline-none focus:border-accent mb-3"
      />
      <div class="max-h-96 overflow-y-auto">
        <button
          v-for="c in pickerContacts" :key="c.id"
          @click="addMember(pickerTeamId!, c.id)"
          class="flex items-center gap-2 w-full bg-transparent border-none py-2.5 px-2 text-sm text-gray-700 cursor-pointer rounded-md hover:bg-gray-50 transition-colors text-left"
        >
          <div class="w-7 h-7 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center shrink-0">
            {{ initials(c.name) }}
          </div>
          {{ c.name }}
        </button>
      </div>
    </RecordModal>
  </div>
</template>
