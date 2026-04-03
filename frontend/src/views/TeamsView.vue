<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '../composables/useStore'
import { useToast } from '../composables/useToast'
import RecordModal from '../components/RecordModal.vue'
import { PlusCircle, X, Search } from 'lucide-vue-next'

const { db, persist } = useStore()
const { show: toast } = useToast()

const activeTaskId = ref<number | null>(null)
const poolSearch = ref('')
const pickerTeamId = ref<number | null>(null)
const pickerSearch = ref('')

const teamTasks = computed(() => db.tasks.filter(t => t.teamTask))

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

function onDragLeave() { dragOverTeamId.value = null }

async function onDrop(toTeamId: string) {
  dragOverTeamId.value = null
  if (dragContactId.value === null || dragFromTeamId.value === toTeamId) return
  if (dragFromTeamId.value !== 'pool') {
    const from = db.teams.find(t => t.id === parseInt(dragFromTeamId.value!))
    if (from) from.members = from.members.filter(id => id !== dragContactId.value)
  }
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
    <div class="skeu-toolbar">
      <div class="skeu-segmented">
        <button
          v-for="task in teamTasks" :key="task.id"
          @click="selectTask(task.id)"
          class="skeu-seg-btn"
          :class="{ 'skeu-seg-active': task.id === activeTaskId }"
        >
          {{ task.name }}
        </button>
      </div>
      <span class="flex-1" />
      <span class="skeu-toolbar-label">{{ teams.length }} team · {{ allInTeams.size }} personer</span>
    </div>

    <!-- Board -->
    <div class="flex flex-1 overflow-x-auto gap-px sm:flex-row flex-col sm:overflow-y-hidden overflow-y-auto" style="background: linear-gradient(180deg, #d0d0d0 0%, #c0c0c0 100%)">
      <!-- Pool (desktop only) -->
      <div class="skeu-pool hidden sm:flex">
        <div class="skeu-pool-header">
          Alla personer <span>{{ db.contacts.length }}</span>
        </div>
        <div class="skeu-pool-search">
          <Search :size="13" class="text-[#999] shrink-0" />
          <input v-model="poolSearch" type="text" placeholder="Sök…" class="border-none outline-none text-sm flex-1 bg-transparent" />
        </div>
        <div
          class="flex-1 overflow-y-auto p-1.5"
          @dragover="onDragOver($event, 'pool')"
          @dragleave="onDragLeave"
          @drop="onDrop('pool')"
          :class="{ 'skeu-drop-target': dragOverTeamId === 'pool' }"
        >
          <div
            v-for="c in poolContacts" :key="c.id"
            class="skeu-pool-item"
            :class="{ 'opacity-35 italic': allInTeams.has(c.id) }"
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
        class="skeu-team-col"
      >
        <div class="skeu-team-header">
          Team {{ team.number }}
          <button @click="deleteTeam(team.id)" class="skeu-team-del">
            <X :size="14" />
          </button>
        </div>
        <div
          class="flex-1 overflow-y-auto p-1.5 transition-colors"
          @dragover="onDragOver($event, String(team.id))"
          @dragleave="onDragLeave"
          @drop="onDrop(String(team.id))"
          :class="{ 'skeu-drop-target': dragOverTeamId === String(team.id) }"
        >
          <div
            v-for="mid in team.members" :key="mid"
            class="skeu-member-card"
            draggable="true"
            @dragstart="onDragStart(mid, String(team.id))"
          >
            <div class="skeu-member-avatar">{{ initials(contactName(mid)) }}</div>
            {{ contactName(mid) }}
            <button @click="removeMember(team.id, mid)" class="skeu-team-del ml-auto">
              <X :size="12" />
            </button>
          </div>
        </div>
        <button
          @click="pickerTeamId = team.id; pickerSearch = ''"
          class="skeu-team-add"
        >
          <PlusCircle :size="12" /> Lägg till
        </button>
      </div>

      <!-- New team column -->
      <div @click="createTeam" class="skeu-new-team">
        <div class="text-center">
          <PlusCircle :size="24" class="mx-auto mb-1" />
          Nytt team
        </div>
      </div>
    </div>

    <!-- Member picker modal -->
    <RecordModal
      :open="pickerTeamId !== null"
      :title="pickerTeamId ? `Lägg till medlem i ${teamTasks.find(t => t.id === activeTaskId)?.name || ''} team ${db.teams.find(t => t.id === pickerTeamId)?.number || ''}` : ''"
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
          <div class="skeu-member-avatar">{{ initials(c.name) }}</div>
          {{ c.name }}
        </button>
      </div>
    </RecordModal>
  </div>
</template>

<style scoped>
.skeu-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  flex-shrink: 0;
  background: linear-gradient(180deg, #e8e8e8 0%, #d4d4d4 100%);
  border-bottom: 1px solid #bbb;
  box-shadow: 0 1px 0 rgba(255,255,255,.4) inset;
  overflow-x: auto;
}
.skeu-toolbar-label {
  font-size: 11px;
  color: #888;
  text-shadow: 0 1px 0 rgba(255,255,255,.7);
  white-space: nowrap;
}
.skeu-segmented {
  display: flex;
  align-items: center;
  border-radius: 5px;
  overflow: hidden;
  border: 1px solid #aaa;
  box-shadow: 0 1px 2px rgba(0,0,0,.06) inset;
  flex-shrink: 0;
}
.skeu-seg-btn {
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
  border: none;
  border-right: 1px solid #aaa;
  color: #555;
  background: linear-gradient(180deg, #f4f4f4 0%, #ddd 100%);
  text-shadow: 0 1px 0 rgba(255,255,255,.7);
  transition: all 0.1s ease;
  white-space: nowrap;
}
.skeu-seg-btn:last-child { border-right: none; }
.skeu-seg-btn:hover { background: linear-gradient(180deg, #fff 0%, #e8e8e8 100%); }
.skeu-seg-active {
  color: #fff !important;
  text-shadow: 0 -1px 0 rgba(0,0,0,.2) !important;
  background: linear-gradient(180deg, #6a5aed 0%, #4a3cc9 100%) !important;
  box-shadow: 0 1px 2px rgba(0,0,0,.15) inset;
}

/* Pool panel */
.skeu-pool {
  min-width: 240px;
  max-width: 280px;
  flex-direction: column;
  flex-shrink: 0;
  background: linear-gradient(180deg, #f0f0f0 0%, #e4e4e4 100%);
  border-right: 1px solid #bbb;
}
.skeu-pool-header {
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 700;
  color: #444;
  border-bottom: 1px solid #ccc;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(180deg, #e8e8e8 0%, #d8d8d8 100%);
  box-shadow: 0 1px 0 rgba(255,255,255,.4) inset;
  text-shadow: 0 1px 0 rgba(255,255,255,.7);
}
.skeu-pool-header span {
  font-size: 11px;
  font-weight: 400;
  color: #999;
}
.skeu-pool-search {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 6px 6px 0;
  padding: 4px 8px;
  border-radius: 4px;
  background: linear-gradient(180deg, #ddd 0%, #fff 3px);
  border: 1px solid #aaa;
  box-shadow: 0 1px 2px rgba(0,0,0,.06) inset;
}
.skeu-pool-item {
  padding: 4px 8px;
  margin-bottom: 2px;
  border-radius: 4px;
  font-size: 12px;
  cursor: grab;
  color: #555;
  background: linear-gradient(180deg, #fff 0%, #f0f0f0 100%);
  border: 1px solid #ccc;
  box-shadow: 0 1px 0 rgba(255,255,255,.5) inset, 0 1px 2px rgba(0,0,0,.04);
  transition: border-color 0.1s ease;
}
.skeu-pool-item:hover { border-color: #6a5aed; }

/* Team columns */
.skeu-team-col {
  min-width: 200px;
  flex: 1;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #eaeaea 0%, #e0e0e0 100%);
}
.skeu-team-header {
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 700;
  color: #444;
  border-bottom: 1px solid #ccc;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(180deg, #e8e8e8 0%, #d8d8d8 100%);
  box-shadow: 0 1px 0 rgba(255,255,255,.4) inset;
  text-shadow: 0 1px 0 rgba(255,255,255,.7);
}
.skeu-team-del {
  color: #bbb;
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  transition: color 0.1s ease;
}
.skeu-team-del:hover { color: #e74c3c; }

.skeu-member-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  margin-bottom: 4px;
  border-radius: 6px;
  font-size: 13px;
  cursor: grab;
  color: #444;
  background: linear-gradient(180deg, #fff 0%, #f0f0f0 100%);
  border: 1px solid #c0c0c0;
  box-shadow: 0 1px 0 rgba(255,255,255,.6) inset, 0 1px 3px rgba(0,0,0,.06);
  transition: all 0.1s ease;
}
.skeu-member-card:hover {
  border-color: #6a5aed;
  background: linear-gradient(180deg, #f0ecff 0%, #e8e0ff 100%);
}

.skeu-member-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
  background: linear-gradient(180deg, #6a5aed 0%, #3b2fba 100%);
  border: 1px solid rgba(0,0,0,.1);
  box-shadow: 0 1px 0 rgba(255,255,255,.2) inset;
}

.skeu-team-add {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
  color: #6a5aed;
  background: none;
  border: none;
  border-top: 1px solid #ccc;
  text-shadow: 0 1px 0 rgba(255,255,255,.5);
  transition: background 0.1s ease;
}
.skeu-team-add:hover {
  background: linear-gradient(180deg, #f0ecff 0%, #e8e0ff 100%);
}

.skeu-new-team {
  min-width: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 13px;
  cursor: pointer;
  flex-shrink: 0;
  padding: 0 24px;
  text-shadow: 0 1px 0 rgba(255,255,255,.5);
  transition: all 0.1s ease;
}
.skeu-new-team:hover {
  color: #6a5aed;
  background: rgba(106,90,237,.05);
}

.skeu-drop-target {
  background: linear-gradient(180deg, #ede9fe 0%, #e0d8f8 100%) !important;
}
</style>
