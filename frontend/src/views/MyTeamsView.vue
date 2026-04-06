<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from '../composables/useStore'
import { useApi } from '../composables/useApi'
import { useToast } from '../composables/useToast'

const { db, memberContactId } = useStore()
const { joinTeam, leaveTeam } = useApi()
const { show: toast } = useToast()

const teamTasks = computed(() => db.tasks.filter((t: any) => t.teamTask))

function myTeamsForTask(taskId: number) {
  return db.teams.filter(t => t.taskId === taskId && t.members.includes(memberContactId.value!))
}
function teamMemberNames(team: { members: number[] }) {
  return team.members
    .filter(id => id !== memberContactId.value)
    .map(id => db.contacts.find(c => c.id === id)?.name)
    .filter(Boolean) as string[]
}
function availableTeamsForTask(taskId: number) {
  return db.teams.filter(t => t.taskId === taskId && !t.members.includes(memberContactId.value!))
}

async function doJoinTeam(teamId: number) {
  try {
    await joinTeam(teamId)
    const team = db.teams.find(t => t.id === teamId)
    if (team && !team.members.includes(memberContactId.value!)) team.members.push(memberContactId.value!)
    toast('Gick med i teamet')
  } catch (e: any) { toast(e.message) }
}

async function doLeaveTeam(teamId: number) {
  try {
    await leaveTeam(teamId)
    const team = db.teams.find(t => t.id === teamId)
    if (team) team.members = team.members.filter(id => id !== memberContactId.value)
    toast('Lämnade teamet')
  } catch (e: any) { toast(e.message) }
}
</script>

<template>
  <div class="flex-1 overflow-y-auto">
    <div class="max-w-2xl mx-auto px-4 py-6">
      <h1 class="text-lg font-extrabold text-[#333] mb-1" style="text-shadow: 0 1px 0 rgba(255,255,255,.7)">Mina team</h1>
      <p class="text-xs text-[#999] mb-6">Du kan vara med i ett team per uppgift. Teamet avgör vilka händelser du tilldelas.</p>

      <div v-if="teamTasks.length === 0" class="text-[#aaa] text-sm text-center py-12">Inga teamuppgifter</div>

      <div v-for="task in teamTasks" :key="task.id" class="mb-6">
        <div class="text-[11px] font-semibold text-[#888] uppercase tracking-wider mb-2">{{ task.name }}</div>

        <!-- Teams I'm in -->
        <div v-for="team in myTeamsForTask(task.id)" :key="team.id"
          class="px-3 py-2.5 mb-1.5 rounded-lg border border-accent/20 bg-accent/5">
          <div class="flex items-center justify-between mb-0.5">
            <span class="text-sm font-semibold text-[#333]">Team {{ team.number }}</span>
            <button @click="doLeaveTeam(team.id)"
              class="text-[10px] text-[#bbb] bg-transparent border border-[#ddd] rounded px-2 py-0.5 cursor-pointer hover:text-red-500 hover:border-red-300 transition-colors">
              Lämna
            </button>
          </div>
          <div v-if="teamMemberNames(team).length" class="text-[10px] text-[#999]">Övriga: {{ teamMemberNames(team).join(', ') }}</div>
          <div v-else class="text-[10px] text-[#ccc]">Du är ensam i detta team</div>
        </div>

        <!-- Not in any team -->
        <div v-if="myTeamsForTask(task.id).length === 0">
          <p class="text-[10px] text-[#aaa] mb-1.5">Välj ett team att gå med i:</p>
          <div class="space-y-1">
            <button v-for="team in availableTeamsForTask(task.id)" :key="team.id"
              @click="doJoinTeam(team.id)"
              class="w-full text-left px-3 py-2 rounded-lg border border-[#d8d8d8] bg-gradient-to-b from-[#f8f8f8] to-[#f0f0f0] cursor-pointer hover:border-accent/40 transition-colors">
              <div class="text-sm text-[#555]">Team {{ team.number }}
                <span class="text-[10px] text-[#bbb] ml-1">{{ team.members.length }} pers</span>
              </div>
              <div v-if="teamMemberNames(team).length" class="text-[10px] text-[#aaa] mt-0.5">{{ teamMemberNames(team).join(', ') }}</div>
            </button>
          </div>
          <div v-if="availableTeamsForTask(task.id).length === 0" class="text-[10px] text-[#ccc]">Inga team tillgängliga</div>
        </div>
      </div>
    </div>
  </div>
</template>
