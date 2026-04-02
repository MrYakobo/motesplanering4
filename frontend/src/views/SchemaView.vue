<script setup lang="ts">
import { computed, ref, nextTick, onMounted, onUnmounted } from 'vue'
import { useStore } from '../composables/useStore'
import { useToday } from '../composables/useToday'
import { useToast } from '../composables/useToast'
import { Shuffle, Users, User } from 'lucide-vue-next'
import RecordModal from '../components/RecordModal.vue'
import type { Event, Task, Team } from '../types'

const { db, assignments, persist, searchQuery, isAdmin } = useStore()
const { show: toast } = useToast()
const { todayStr } = useToday()
const gridRef = ref<HTMLElement | null>(null)

// ── Active popup state ───────────────────────────────────────────────────────
const activePop = ref<{ eid: number; tid: number } | null>(null)

function togglePop(eid: number, tid: number) {
  if (activePop.value?.eid === eid && activePop.value?.tid === tid) {
    activePop.value = null
  } else {
    activePop.value = { eid, tid }
    popSearch.value = ''
  }
}

function closePops() { activePop.value = null }

function onDocClick(e: MouseEvent) {
  if (!(e.target as HTMLElement).closest('.pop-cell')) closePops()
}
onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))

// ── Filtered events ──────────────────────────────────────────────────────────
const visibleEvents = computed(() => {
  const q = searchQuery.value.toLowerCase()
  return [...db.events]
    .filter(ev => (ev.expectedTasks || []).length > 0)
    .filter(ev => !q || ev.title.toLowerCase().includes(q) || ev.date.includes(q) || (ev.category || '').toLowerCase().includes(q))
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
})

// ── Stats ────────────────────────────────────────────────────────────────────
const warnCount = computed(() =>
  visibleEvents.value.reduce((n, ev) => {
    if (ev.date < today) return n
    return n + (ev.expectedTasks || []).filter(tid => !assignments[ev.id]?.[tid]).length
  }, 0)
)

// ── Cell helpers ─────────────────────────────────────────────────────────────
function cellLabel(ev: Event, task: Task): string {
  const asgn = assignments[ev.id]?.[task.id]
  if (!asgn) return '—'
  if (task.teamTask) {
    const t = db.teams.find(t => t.id === asgn.id)
    return t ? `Team ${t.number}` : '—'
  }
  const ids = asgn.ids || []
  return ids.length === 0 ? '—' : ids.map(id => db.contacts.find(c => c.id === id)?.name?.split(' ')[0]).filter(Boolean).join(', ')
}

function isUnset(ev: Event, task: Task): boolean {
  return !assignments[ev.id]?.[task.id]
}

function isCellWarn(ev: Event, task: Task): boolean {
  if (ev.date < today) return false
  return (ev.expectedTasks || []).includes(task.id) && !assignments[ev.id]?.[task.id]
}

function missingNames(ev: Event): string {
  if (ev.date < today) return ''
  const missing = (ev.expectedTasks || []).filter(tid => !assignments[ev.id]?.[tid])
  return missing.map(tid => db.tasks.find(t => t.id === tid)?.name).filter(Boolean).join(', ')
}

function missingCount(ev: Event): number {
  if (ev.date < today) return 0
  return (ev.expectedTasks || []).filter(tid => !assignments[ev.id]?.[tid]).length
}

function teamMembers(ev: Event, task: Task): string {
  const asgn = assignments[ev.id]?.[task.id]
  if (!asgn || asgn.type !== 'team') return ''
  const team = db.teams.find(t => t.id === asgn.id)
  if (!team) return ''
  return (team.members || []).map(mid => db.contacts.find(c => c.id === mid)?.name).filter(Boolean).join(', ')
}

// ── Team assignment ──────────────────────────────────────────────────────────
function pickTeam(eid: number, tid: number, teamId: number | null) {
  if (!assignments[eid]) assignments[eid] = {}
  if (!teamId) { delete assignments[eid][tid] }
  else { assignments[eid][tid] = { type: 'team', id: teamId } }
  persistAssignments()
  closePops()
}

// ── Person assignment ────────────────────────────────────────────────────────
const popSearch = ref('')

function isPersonChecked(eid: number, tid: number, cid: number): boolean {
  return (assignments[eid]?.[tid]?.ids || []).includes(cid)
}

function togglePerson(eid: number, tid: number, cid: number, checked: boolean) {
  if (!assignments[eid]) assignments[eid] = {}
  if (!assignments[eid][tid]) assignments[eid][tid] = { type: 'contact', ids: [] }
  const ids = assignments[eid][tid].ids!
  if (checked && !ids.includes(cid)) ids.push(cid)
  if (!checked) assignments[eid][tid].ids = ids.filter(i => i !== cid)
  if (assignments[eid][tid].ids!.length === 0) delete assignments[eid][tid]
  persistAssignments()
}

function filteredContacts() {
  const q = popSearch.value.toLowerCase()
  return db.contacts.filter(c => !q || c.name.toLowerCase().includes(q))
}

// ── Inline add person ────────────────────────────────────────────────────────
const addingPerson = ref(false)
const newPersonName = ref('')

function startAddPerson() { addingPerson.value = true; newPersonName.value = '' }

async function commitAddPerson(eid: number, tid: number) {
  const name = newPersonName.value.trim()
  if (!name) return
  let contact = db.contacts.find(c => c.name.toLowerCase() === name.toLowerCase())
  if (!contact) {
    const maxId = db.contacts.reduce((m, c) => Math.max(m, c.id), 0) + 1
    contact = { id: maxId, name, email: '', phone: '' }
    db.contacts.push(contact)
    await persist('contacts')
  }
  if (!assignments[eid]) assignments[eid] = {}
  if (!assignments[eid][tid]) assignments[eid][tid] = { type: 'contact', ids: [] }
  if (!assignments[eid][tid].ids!.includes(contact.id)) assignments[eid][tid].ids!.push(contact.id)
  persistAssignments()
  addingPerson.value = false
}

// ── Persist ──────────────────────────────────────────────────────────────────
function persistAssignments() {
  db.schedules = { ...assignments } as any
  persist('schedules')
}

// ── Auto-distribute teams ────────────────────────────────────────────────────
const distModal = ref(false)
const distTaskId = ref<number | null>(null)
const distStartIdx = ref(0)
const distMode = ref<'team' | 'person'>('team')

// Person distribute pool
const personPool = ref<{ id: number; name: string; checked: boolean }[]>([])
const personStartIdx = ref(0)

function autoDistributeTeams(taskId: number) {
  distTaskId.value = taskId
  distStartIdx.value = 0
  distMode.value = 'team'
  distModal.value = true
}

function autoDistributePersons(taskId: number) {
  distTaskId.value = taskId
  distMode.value = 'person'
  personStartIdx.value = 0

  // Build pool from recent 6 months
  const sixAgo = new Date()
  sixAgo.setMonth(sixAgo.getMonth() - 6)
  const cutoff = sixAgo.toISOString().slice(0, 10)
  const recentIds = new Set<number>()
  db.events.forEach(ev => {
    if (ev.date < cutoff || ev.date >= today) return
    const asgn = assignments[ev.id]?.[taskId]
    if (asgn?.type === 'contact') (asgn.ids || []).forEach(id => recentIds.add(id))
  })

  const pool = [...recentIds].map(cid => {
    const c = db.contacts.find(x => x.id === cid)
    return c ? { id: c.id, name: c.name, checked: true } : null
  }).filter(Boolean) as { id: number; name: string; checked: boolean }[]

  if (pool.length === 0) {
    personPool.value = db.contacts.map(c => ({ id: c.id, name: c.name, checked: false }))
      .sort((a, b) => a.name.localeCompare(b.name))
  } else {
    personPool.value = pool.sort((a, b) => a.name.localeCompare(b.name))
  }

  distModal.value = true
}

const distTask = computed(() => db.tasks.find(t => t.id === distTaskId.value))
const distTeams = computed(() => db.teams.filter(t => t.taskId === distTaskId.value).sort((a, b) => a.number - b.number))

const distCandidates = computed(() =>
  visibleEvents.value
    .filter(ev => ev.date >= today && (ev.expectedTasks || []).includes(distTaskId.value!) && !assignments[ev.id]?.[distTaskId.value!])
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
)

const teamPlan = computed(() =>
  distCandidates.value.map((ev, i) => ({
    ev,
    team: distTeams.value[(i + distStartIdx.value) % distTeams.value.length],
  }))
)

const selectedPersons = computed(() => personPool.value.filter(p => p.checked))

const personPlan = computed(() =>
  selectedPersons.value.length > 0
    ? distCandidates.value.map((ev, i) => ({
        ev,
        person: selectedPersons.value[(i + personStartIdx.value) % selectedPersons.value.length],
      }))
    : []
)

function executeTeamDist() {
  distCandidates.value.forEach((ev, i) => {
    const team = distTeams.value[(i + distStartIdx.value) % distTeams.value.length]
    if (!assignments[ev.id]) assignments[ev.id] = {}
    assignments[ev.id][distTaskId.value!] = { type: 'team', id: team.id }
  })
  persistAssignments()
  distModal.value = false
  toast(`${distCandidates.value.length} händelser tilldelade`)
}

function executePersonDist() {
  const sel = selectedPersons.value
  if (sel.length === 0) return
  distCandidates.value.forEach((ev, i) => {
    const person = sel[(i + personStartIdx.value) % sel.length]
    if (!assignments[ev.id]) assignments[ev.id] = {}
    assignments[ev.id][distTaskId.value!] = { type: 'contact', ids: [person.id] }
  })
  persistAssignments()
  distModal.value = false
  toast(`${distCandidates.value.length} händelser tilldelade`)
}

// ── Scroll to today on mount ─────────────────────────────────────────────────
onMounted(() => {
  nextTick(() => {
    const rows = gridRef.value?.querySelectorAll('tbody tr')
    if (!rows) return
    for (const row of rows) {
      const text = row.querySelector('.td-event')?.textContent || ''
      if (text >= today) { (row as HTMLElement).scrollIntoView({ block: 'start', behavior: 'instant' }); break }
    }
  })
})
</script>

<template>
  <div class="flex flex-col flex-1 overflow-hidden">
    <!-- Stats bar -->
    <div class="flex items-center gap-4 px-4 py-2 bg-white border-b border-gray-200 shrink-0">
      <span class="text-xs text-gray-500">
        Totalt: <strong class="text-gray-900">{{ visibleEvents.length }}</strong>
      </span>
      <span v-if="warnCount > 0" class="text-xs text-amber-500 font-semibold">⚠ {{ warnCount }} saknas</span>
      <input
        v-model="searchQuery"
        type="search"
        placeholder="Sök..."
        class="ml-auto border border-gray-300 rounded-md px-2.5 py-1 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 w-48"
      />
    </div>

    <!-- Grid -->
    <div ref="gridRef" class="flex-1 overflow-auto">
      <table class="border-collapse" style="width:auto;min-width:100%">
        <thead>
          <tr>
            <th class="sticky top-0 left-0 z-[5] bg-gray-50 border-b-2 border-gray-200 px-2 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
              Datum / Händelse
            </th>
            <th
              v-for="task in db.tasks"
              :key="task.id"
              class="sticky top-0 z-[3] bg-gray-50 border-b-2 border-gray-200 px-1.5 py-2 text-left min-w-[120px]"
            >
              <div class="flex items-center gap-1 text-xs font-semibold text-gray-700">
                {{ task.name }}
                <button
                  v-if="isAdmin"
                  @click.stop="task.teamTask ? autoDistributeTeams(task.id) : autoDistributePersons(task.id)"
                  class="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--accent-light)] border border-[var(--accent-mid)] text-[var(--accent)] cursor-pointer hover:opacity-80"
                  :title="task.teamTask ? 'Fördela team jämnt' : 'Fördela personer jämnt'"
                >
                  <Shuffle :size="11" /> Fördela
                </button>
              </div>
              <div class="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                <Users v-if="task.teamTask" :size="10" />
                <User v-else :size="10" />
                {{ task.teamTask ? 'team' : 'person' }}
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="ev in visibleEvents"
            :key="ev.id"
            :style="{ opacity: ev.date < today ? 0.5 : 1 }"
          >
            <td class="sticky left-0 bg-white z-[1] font-medium whitespace-nowrap px-2 py-1.5 border-b border-gray-100 td-event">
              <span class="text-xs">{{ ev.date }} {{ ev.time || '' }}</span><br />
              <span class="text-xs text-gray-500">{{ ev.title }}</span>
              <span v-if="missingCount(ev) > 0" class="text-xs text-amber-500 font-semibold ml-1" :title="'Saknas: ' + missingNames(ev)">
                ⚠ {{ missingCount(ev) }}
              </span>
            </td>
            <td
              v-for="task in db.tasks"
              :key="task.id"
              class="px-1.5 py-1 border-b border-gray-100"
              @click.stop
            >
              <div class="pop-cell relative">
                <div
                  class="pop-label px-1.5 py-1 border rounded text-xs cursor-pointer bg-white text-gray-700 whitespace-nowrap overflow-hidden text-ellipsis max-w-[140px] transition-colors"
                  :class="{
                    'border-gray-200 hover:border-[var(--accent)]': !isUnset(ev, task) && !isCellWarn(ev, task),
                    'text-gray-400 bg-gray-50 border-gray-200 hover:border-[var(--accent)]': isUnset(ev, task) && !isCellWarn(ev, task),
                    'border-amber-400 bg-amber-50': isCellWarn(ev, task),
                  }"
                  :title="task.teamTask ? teamMembers(ev, task) : ''"
                  @click="togglePop(ev.id, task.id)"
                >
                  {{ cellLabel(ev, task) }}
                </div>

                <!-- Team popup -->
                <div
                  v-if="activePop?.eid === ev.id && activePop?.tid === task.id && task.teamTask"
                  class="absolute top-full mt-1 left-0 z-20 bg-white border-2 border-[var(--accent)] rounded-lg shadow-lg min-w-[220px] max-h-[480px] flex flex-col"
                >
                  <div class="overflow-y-auto p-1">
                    <label class="flex items-center gap-2 px-1.5 py-1 rounded cursor-pointer text-sm text-gray-400 hover:bg-gray-100">
                      <input
                        type="radio"
                        :name="'tpick_' + ev.id + '_' + task.id"
                        :checked="!assignments[ev.id]?.[task.id]"
                        @change="pickTeam(ev.id, task.id, null)"
                      /> —
                    </label>
                    <label
                      v-for="team in db.teams.filter(t => t.taskId === task.id)"
                      :key="team.id"
                      class="flex items-center gap-2 px-1.5 py-1 rounded cursor-pointer text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <input
                        type="radio"
                        :name="'tpick_' + ev.id + '_' + task.id"
                        :checked="assignments[ev.id]?.[task.id]?.id === team.id"
                        @change="pickTeam(ev.id, task.id, team.id)"
                        class="accent-[var(--accent)]"
                      />
                      <span class="flex-1">
                        Team {{ team.number }}
                        <span class="text-[11px] text-gray-400 ml-1">
                          {{ (team.members || []).map(mid => db.contacts.find(c => c.id === mid)?.name).filter(Boolean).join(', ') }}
                        </span>
                      </span>
                    </label>
                  </div>
                </div>

                <!-- Person popup -->
                <div
                  v-if="activePop?.eid === ev.id && activePop?.tid === task.id && !task.teamTask"
                  class="absolute top-full mt-1 left-0 z-20 bg-white border-2 border-[var(--accent)] rounded-lg shadow-lg min-w-[220px] max-h-[480px] flex flex-col"
                >
                  <input
                    v-model="popSearch"
                    type="text"
                    placeholder="Sök person…"
                    class="border-none border-b-2 border-b-[var(--accent-light)] px-2.5 py-2 text-sm outline-none rounded-t-lg shrink-0 bg-[var(--accent-light)] focus:shadow-[inset_0_-2px_0_var(--accent)]"
                  />
                  <div class="overflow-y-auto p-1 flex-1">
                    <label
                      v-for="c in filteredContacts()"
                      :key="c.id"
                      class="flex items-center gap-2 px-1.5 py-1 rounded cursor-pointer text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <input
                        type="checkbox"
                        :checked="isPersonChecked(ev.id, task.id, c.id)"
                        @change="togglePerson(ev.id, task.id, c.id, ($event.target as HTMLInputElement).checked)"
                        class="accent-[var(--accent)]"
                      />
                      {{ c.name }}
                    </label>
                  </div>
                  <div class="border-t border-gray-200">
                    <div v-if="!addingPerson" class="px-2.5 py-2">
                      <button @click="startAddPerson" class="text-xs text-[var(--accent)] hover:underline cursor-pointer bg-transparent border-none">+ Lägg till ny person</button>
                    </div>
                    <div v-else class="flex gap-1 px-2 py-1.5">
                      <input
                        v-model="newPersonName"
                        type="text"
                        placeholder="Fullständigt namn"
                        class="flex-1 border border-gray-300 rounded px-2 py-1 text-xs outline-none"
                        @keydown.enter="commitAddPerson(ev.id, task.id)"
                      />
                      <button @click="commitAddPerson(ev.id, task.id)" class="px-2 py-1 text-xs rounded bg-[var(--accent)] text-white cursor-pointer border-none">Spara</button>
                    </div>
                  </div>
                </div>
              </div>
            </td>
          </tr>
          <tr v-if="visibleEvents.length === 0">
            <td :colspan="db.tasks.length + 1" class="py-6 text-center text-gray-400 text-sm">Inga resultat</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Auto-distribute modal -->
    <RecordModal :open="distModal" :title="'Fördela ' + (distTask?.name || '')" @close="distModal = false">
      <!-- Team distribute -->
      <template v-if="distMode === 'team'">
        <div v-if="distTeams.length === 0" class="text-sm text-gray-500 py-4">Inga team för denna uppgift</div>
        <div v-else-if="distCandidates.length === 0" class="text-sm text-gray-500 py-4">Inga otilldelade händelser att fördela</div>
        <div v-else>
          <div class="flex items-center gap-2 mb-3">
            <span class="text-sm text-gray-700">Börja med:</span>
            <select v-model.number="distStartIdx" class="border border-gray-300 rounded-md px-2 py-1 text-sm">
              <option v-for="(t, i) in distTeams" :key="t.id" :value="i">Team {{ t.number }}</option>
            </select>
            <span class="text-xs text-gray-400">{{ distCandidates.length }} händelser · {{ distTeams.length }} team</span>
          </div>
          <div class="max-h-[400px] overflow-y-auto border border-gray-200 rounded-md p-2">
            <div v-for="p in teamPlan" :key="p.ev.id" class="flex gap-2 py-1 border-b border-gray-100 text-xs items-baseline">
              <span class="min-w-[80px] text-gray-500">{{ p.ev.date }}</span>
              <span class="flex-1">{{ p.ev.title }}</span>
              <span class="text-[var(--accent)] font-semibold whitespace-nowrap">Team {{ p.team.number }}</span>
            </div>
          </div>
          <div class="flex justify-end gap-2 mt-4">
            <button @click="distModal = false" class="px-3 py-1.5 text-sm rounded border border-gray-300 bg-white text-gray-700 cursor-pointer hover:bg-gray-50">Avbryt</button>
            <button @click="executeTeamDist" class="px-3 py-1.5 text-sm rounded bg-[var(--accent)] text-white cursor-pointer border-none hover:opacity-90">
              Tilldela {{ distCandidates.length }} händelser
            </button>
          </div>
        </div>
      </template>

      <!-- Person distribute -->
      <template v-if="distMode === 'person'">
        <div v-if="distCandidates.length === 0" class="text-sm text-gray-500 py-4">Inga otilldelade händelser att fördela</div>
        <div v-else>
          <div class="mb-3">
            <div class="text-xs font-semibold text-gray-500 mb-1.5">Välj personer att rotera (senaste 6 mån):</div>
            <div class="max-h-[180px] overflow-y-auto border border-gray-200 rounded-md p-1.5">
              <label
                v-for="(p, i) in personPool"
                :key="p.id"
                class="flex items-center gap-1.5 px-1 py-0.5 rounded cursor-pointer text-xs hover:bg-gray-100"
              >
                <input type="checkbox" v-model="personPool[i].checked" class="accent-[var(--accent)]" />
                {{ p.name }}
              </label>
            </div>
          </div>
          <template v-if="selectedPersons.length > 0">
            <div class="flex items-center gap-2 mb-3">
              <span class="text-sm text-gray-700">Börja med:</span>
              <select v-model.number="personStartIdx" class="border border-gray-300 rounded-md px-2 py-1 text-sm">
                <option v-for="(p, i) in selectedPersons" :key="p.id" :value="i">{{ p.name }}</option>
              </select>
              <span class="text-xs text-gray-400">{{ distCandidates.length }} händelser · {{ selectedPersons.length }} personer</span>
            </div>
            <div class="max-h-[400px] overflow-y-auto border border-gray-200 rounded-md p-2">
              <div v-for="p in personPlan" :key="p.ev.id" class="flex gap-2 py-1 border-b border-gray-100 text-xs items-baseline">
                <span class="min-w-[80px] text-gray-500">{{ p.ev.date }}</span>
                <span class="flex-1">{{ p.ev.title }}</span>
                <span class="text-[var(--accent)] font-semibold whitespace-nowrap">{{ p.person.name }}</span>
              </div>
            </div>
          </template>
          <p v-else class="text-sm text-gray-400 mt-2">Välj minst en person för att se fördelning</p>
          <div class="flex justify-end gap-2 mt-4">
            <button @click="distModal = false" class="px-3 py-1.5 text-sm rounded border border-gray-300 bg-white text-gray-700 cursor-pointer hover:bg-gray-50">Avbryt</button>
            <button
              v-if="selectedPersons.length > 0"
              @click="executePersonDist"
              class="px-3 py-1.5 text-sm rounded bg-[var(--accent)] text-white cursor-pointer border-none hover:opacity-90"
            >
              Tilldela {{ distCandidates.length }} händelser
            </button>
          </div>
        </div>
      </template>
    </RecordModal>
  </div>
</template>
