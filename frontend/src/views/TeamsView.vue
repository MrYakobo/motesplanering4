<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useStore } from '../composables/useStore'
import { useToast } from '../composables/useToast'
import { useRoute } from 'vue-router'
import RecordModal from '../components/RecordModal.vue'
import PersonPicker from '../components/PersonPicker.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { PlusCircle, X } from 'lucide-vue-next'

const { db, persist } = useStore()
const { show: toast } = useToast()
const route = useRoute()

const activeTaskId = ref<number | null>(null)
const pickerTeamId = ref<number | null>(null)

const teamTasks = computed(() => db.tasks.filter(t => t.teamTask))

// Sync from route param
watch(() => route.params.taskId, (id) => {
  if (id) activeTaskId.value = Number(id)
  else if (teamTasks.value.length > 0) activeTaskId.value = teamTasks.value[0].id
}, { immediate: true })

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

const pickerContacts = computed(() => {
  if (!pickerTeamId.value) return []
  const team = db.teams.find(t => t.id === pickerTeamId.value)
  if (!team) return []
  const existing = new Set(team.members)
  return db.contacts
    .filter(c => !existing.has(c.id))
    .sort((a, b) => a.name.localeCompare(b.name))
})

async function createTeam() {
  if (!activeTaskId.value) return
  const maxId = db.teams.reduce((m, t) => Math.max(m, t.id), 0) + 1
  const nextNum = teams.value.length > 0 ? Math.max(...teams.value.map(t => t.number)) + 1 : 1
  db.teams.push({ id: maxId, taskId: activeTaskId.value, number: nextNum, members: [] })
  await persist('teams')
}

const confirmDeleteId = ref<number | null>(null)
const confirmDeleteTeam = computed(() => confirmDeleteId.value ? db.teams.find(t => t.id === confirmDeleteId.value) : null)

async function doDeleteTeam() {
  if (!confirmDeleteId.value) return
  db.teams = db.teams.filter(t => t.id !== confirmDeleteId.value)
  confirmDeleteId.value = null
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
    <!-- Header -->
    <div class="skeu-toolbar">
      <span class="text-[18px] font-extrabold text-[#333]" style="text-shadow: 0 1px 0 rgba(255,255,255,.7)">
        {{ teamTasks.find(t => t.id === activeTaskId)?.name || 'Team' }}
      </span>
      <span class="text-[11px] text-[#888] ml-2">{{ teams.length }} team · {{ allInTeams.size }} personer</span>
      <span class="flex-1" />
      <button @click="createTeam" class="skeu-create-btn">
        <PlusCircle :size="13" /> Nytt team
      </button>
      <!-- Task switcher for when sidebar sub-items aren't visible (mobile) -->
      <div class="flex sm:hidden gap-1">
        <button v-for="task in teamTasks" :key="task.id"
          @click="activeTaskId = task.id"
          class="px-2 py-0.5 text-[11px] rounded border cursor-pointer transition-all"
          :class="task.id === activeTaskId
            ? 'bg-accent text-white border-accent/30'
            : 'bg-transparent text-[#666] border-[#bbb] hover:bg-white/50'">
          {{ task.name }}
        </button>
      </div>
    </div>

    <!-- Board -->
    <div class="flex flex-1 overflow-x-auto gap-px sm:flex-row flex-col sm:overflow-y-hidden overflow-y-auto" style="background: linear-gradient(180deg, #d0d0d0 0%, #c0c0c0 100%)">
      <!-- Pool (hidden for now) -->
      <!--
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
      -->

      <!-- Team columns -->
      <div
        v-for="team in teams" :key="team.id"
        class="skeu-team-col"
      >
        <div class="skeu-team-header">
          Team {{ team.number }}
          <button @click="confirmDeleteId = team.id" class="skeu-team-del">
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
          <!-- Ghost "add" card -->
          <button
            @click="pickerTeamId = team.id"
            class="skeu-member-ghost"
          >
            <PlusCircle :size="14" class="opacity-50" />
            <span>Lägg till person</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Member picker modal -->
    <RecordModal
      :open="pickerTeamId !== null"
      :title="pickerTeamId ? `Lägg till medlem i ${teamTasks.find(t => t.id === activeTaskId)?.name || ''} team ${db.teams.find(t => t.id === pickerTeamId)?.number || ''}` : ''"
      @close="pickerTeamId = null"
    >
      <PersonPicker :contacts="pickerContacts" @pick="(id) => addMember(pickerTeamId!, id)" />
    </RecordModal>

    <!-- Delete confirmation -->
    <ConfirmDialog
      :open="confirmDeleteId !== null"
      title="Ta bort team"
      :message="`Är du säker på att du vill ta bort Team ${confirmDeleteTeam?.number}?`"
      warning="Denna åtgärd kan inte ångras"
      confirm-label="Ta bort"
      :danger="true"
      @confirm="doDeleteTeam"
      @cancel="confirmDeleteId = null"
    />
  </div>
</template>

<style scoped>
@reference "../style.css";

.skeu-create-btn {
  @apply flex items-center gap-1 px-2.5 py-1 rounded-[5px] text-xs font-semibold cursor-pointer text-white border border-black/20 transition-all;
  background: var(--skeu-gradient-primary);
  box-shadow: 0 1px 0 rgba(255,255,255,.2) inset;
  text-shadow: 0 -1px 0 rgba(0,0,0,.15);
}
.skeu-create-btn:hover { background: var(--skeu-gradient-primary-hover); }

.skeu-pool { @apply min-w-60 max-w-70 flex-col shrink-0 border-r border-[#bbb]; background: linear-gradient(180deg, #f0f0f0 0%, #e4e4e4 100%); }
.skeu-pool-header {
  @apply px-3 py-2 text-[13px] font-bold text-[#444] border-b border-[#ccc] flex items-center justify-between;
  background: var(--skeu-gradient-chrome);
  box-shadow: var(--skeu-shadow-inset);
  text-shadow: var(--skeu-text-shadow);
}
.skeu-pool-header span { @apply text-[11px] font-normal text-[#999]; }
.skeu-pool-search {
  @apply flex items-center gap-1.5 mx-1.5 mt-1.5 px-2 py-1 rounded border border-[#aaa];
  background: var(--skeu-gradient-input);
  box-shadow: 0 1px 2px rgba(0,0,0,.06) inset;
}
.skeu-pool-item {
  @apply px-2 py-1 mb-0.5 rounded text-xs cursor-grab text-[#555] border border-[#ccc] transition-colors;
  background: linear-gradient(180deg, #fff 0%, #f0f0f0 100%);
  box-shadow: 0 1px 0 rgba(255,255,255,.5) inset, 0 1px 2px rgba(0,0,0,.04);
}
.skeu-pool-item:hover { @apply border-accent; }

.skeu-team-col {
  @apply min-w-50 flex-1 flex flex-col;
  background: linear-gradient(180deg, #eaeaea 0%, #e0e0e0 100%);
}
.skeu-team-header {
  @apply px-3 py-2 text-[13px] font-bold text-[#444] border-b border-[#ccc] flex items-center justify-between;
  background: var(--skeu-gradient-chrome);
  box-shadow: var(--skeu-shadow-inset);
  text-shadow: var(--skeu-text-shadow);
}
.skeu-team-del { @apply text-[#bbb] bg-transparent border-none cursor-pointer p-0.5 transition-colors; }
.skeu-team-del:hover { @apply text-red-500; }

.skeu-member-card {
  @apply flex items-center gap-2 px-2 py-1.5 mb-1 rounded-md text-[13px] cursor-grab text-[#444] border border-[#c0c0c0] transition-all;
  background: linear-gradient(180deg, #fff 0%, #f0f0f0 100%);
  box-shadow: 0 1px 0 rgba(255,255,255,.6) inset, 0 1px 3px rgba(0,0,0,.06);
}
.skeu-member-card:hover { @apply border-accent; background: linear-gradient(180deg, #f0ecff 0%, #e8e0ff 100%); }

.skeu-member-avatar {
  @apply w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0;
  background: var(--skeu-gradient-primary);
  border: 1px solid rgba(0,0,0,.1);
  box-shadow: 0 1px 0 rgba(255,255,255,.2) inset;
}

.skeu-member-ghost {
  @apply flex items-center gap-1.5 px-2 py-1.5 mb-0.5 rounded-md text-xs text-[#aaa] cursor-pointer border-2 border-dashed border-[#ccc] bg-transparent w-full text-left transition-all;
}
.skeu-member-ghost:hover { @apply border-accent text-accent bg-accent/5; }

.skeu-drop-target { background: linear-gradient(180deg, #ede9fe 0%, #e0d8f8 100%) !important; }
</style>
