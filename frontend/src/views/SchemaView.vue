<script setup lang="ts">
import { computed, ref, nextTick, onMounted, watch } from 'vue'
import { useStore } from '../composables/useStore'
import { useToday, localDateStr } from '../composables/useToday'
import { useToast } from '../composables/useToast'
import { Shuffle, Users, User, Table2 } from 'lucide-vue-next'
import RecordModal from '../components/RecordModal.vue'
import SchemaMobile from '../components/SchemaMobile.vue'
import type { Event, Task } from '../types'

const { db, assignments, persist, searchQuery, isAdmin } = useStore()
const { show: toast } = useToast()
const { todayStr } = useToday()
const gridRef = ref<HTMLElement | null>(null)
const schemaTableMode = ref(false)

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

const activePopEvent = computed(() => activePop.value ? db.events.find(e => e.id === activePop.value!.eid) : null)
const activePopTask = computed(() => activePop.value ? db.tasks.find(t => t.id === activePop.value!.tid) : null)
const pickerTitle = computed(() => {
  if (!activePopEvent.value || !activePopTask.value) return ''
  return `${activePopTask.value.name} — ${activePopEvent.value.date} ${activePopEvent.value.title}`
})

const pickerListRef = ref<HTMLElement | null>(null)

watch(activePop, (v) => {
  if (!v) return
  nextTick(() => {
    const el = pickerListRef.value?.querySelector('input:checked') as HTMLElement
    if (el) el.closest('label')?.scrollIntoView({ block: 'center', behavior: 'instant' })
  })
})

// (picker is a modal now, no document click needed)

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
    if (ev.date < todayStr.value) return n
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
  if (ev.date < todayStr.value) return false
  return (ev.expectedTasks || []).includes(task.id) && !assignments[ev.id]?.[task.id]
}

function missingNames(ev: Event): string {
  if (ev.date < todayStr.value) return ''
  const missing = (ev.expectedTasks || []).filter(tid => !assignments[ev.id]?.[tid])
  return missing.map(tid => db.tasks.find(t => t.id === tid)?.name).filter(Boolean).join(', ')
}

function missingCount(ev: Event): number {
  if (ev.date < todayStr.value) return 0
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
  activePop.value = null
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

// Suggested contacts: people assigned to this task in the last 6 months
function suggestedContactIds(tid: number): Set<number> {
  const sixAgo = new Date(todayStr.value + 'T00:00:00')
  sixAgo.setMonth(sixAgo.getMonth() - 6)
  const cutoff = localDateStr(sixAgo)
  const ids = new Set<number>()
  db.events.forEach(ev => {
    if (ev.date < cutoff || ev.date >= todayStr.value) return
    const asgn = assignments[ev.id]?.[tid]
    if (asgn?.type === 'contact') (asgn.ids || []).forEach(id => ids.add(id))
  })
  return ids
}

function suggestedContacts() {
  if (!activePop.value) return []
  const suggested = suggestedContactIds(activePop.value.tid)
  const q = popSearch.value.toLowerCase()
  return db.contacts
    .filter(c => suggested.has(c.id) && (!q || c.name.toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function otherContacts() {
  if (!activePop.value) return []
  const suggested = suggestedContactIds(activePop.value.tid)
  const q = popSearch.value.toLowerCase()
  return db.contacts
    .filter(c => !suggested.has(c.id) && (!q || c.name.toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name))
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
  const sixAgo = new Date(todayStr.value + 'T00:00:00')
  sixAgo.setMonth(sixAgo.getMonth() - 6)
  const cutoff = localDateStr(sixAgo)
  const recentIds = new Set<number>()
  db.events.forEach(ev => {
    if (ev.date < cutoff || ev.date >= todayStr.value) return
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
    .filter(ev => ev.date >= todayStr.value && (ev.expectedTasks || []).includes(distTaskId.value!) && !assignments[ev.id]?.[distTaskId.value!])
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
      if (text >= todayStr.value) { (row as HTMLElement).scrollIntoView({ block: 'start', behavior: 'instant' }); break }
    }
  })
})
</script>

<template>
  <div class="flex flex-col flex-1 overflow-hidden">
    <!-- Card view (was mobile-only, now default) -->
    <div v-if="!schemaTableMode" class="flex flex-col flex-1 overflow-hidden">
      <div class="skeu-toolbar hidden sm:flex">
        <span class="flex-1" />
        <button @click="schemaTableMode = true" class="skeu-icon-btn" title="Tabellvy">
          <Table2 :size="13" />
        </button>
      </div>
      <SchemaMobile class="flex-1" @pick="(eid, tid) => togglePop(eid, tid)" @distribute="(tid) => { const t = db.tasks.find(x => x.id === tid); t?.teamTask ? autoDistributeTeams(tid) : autoDistributePersons(tid) }" />
    </div>

    <!-- Table view (desktop option) -->
    <div :class="schemaTableMode ? 'flex flex-col flex-1 overflow-hidden' : 'hidden'">
    <!-- Stats bar -->
    <div class="skeu-toolbar">
      <button @click="schemaTableMode = false" class="skeu-icon-btn" title="Kortvy">
        <User :size="13" />
      </button>
      <span class="skeu-toolbar-label">
        Totalt: <strong>{{ visibleEvents.length }}</strong>
      </span>
      <span v-if="warnCount > 0" class="skeu-badge-warn">⚠ {{ warnCount }} saknas</span>
      <input
        v-model="searchQuery"
        type="search"
        placeholder="Sök..."
        class="skeu-search ml-auto"
      />
    </div>

    <!-- Grid -->
    <div ref="gridRef" class="flex-1 overflow-auto min-w-0" style="-webkit-overflow-scrolling:touch">
      <table class="border-collapse" style="width:max-content;min-width:100%">
        <thead>
          <tr>
            <th class="skeu-th sticky left-0 z-[5]" style="max-width:45vw">
              Datum / Händelse
            </th>
            <th
              v-for="task in db.tasks"
              :key="task.id"
              class="skeu-th min-w-[120px]"
            >
              <div class="flex items-center gap-1 text-xs font-semibold">
                {{ task.name }}
                <button
                  v-if="isAdmin"
                  @click.stop="task.teamTask ? autoDistributeTeams(task.id) : autoDistributePersons(task.id)"
                  class="skeu-dist-btn"
                  :title="task.teamTask ? 'Fördela team jämnt' : 'Fördela personer jämnt'"
                >
                  <Shuffle :size="10" /> Fördela
                </button>
              </div>
              <div class="text-[10px] text-[#888] mt-0.5 flex items-center gap-1">
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
            class="skeu-grid-row"
            :style="{ opacity: ev.date < todayStr ? 0.5 : 1 }"
          >
            <td class="sticky left-0 z-[1] font-medium px-2 py-1.5 td-event skeu-grid-sticky" style="max-width:45vw;white-space:normal;word-break:break-word">
              <span class="text-xs">{{ ev.date }} {{ ev.time || '' }}</span><br />
              <span class="text-xs text-gray-500">{{ ev.title }}</span>
              <span v-if="missingCount(ev) > 0" class="text-xs text-amber-500 font-semibold ml-1" :title="'Saknas: ' + missingNames(ev)">
                ⚠ {{ missingCount(ev) }}
              </span>
            </td>
            <td
              v-for="task in db.tasks"
              :key="task.id"
              class="px-1.5 py-1"
              @click.stop
            >
              <div class="pop-cell relative">
                <div
                  class="skeu-cell"
                  :class="{
                    'skeu-cell-set': !isUnset(ev, task) && !isCellWarn(ev, task),
                    'skeu-cell-empty': isUnset(ev, task) && !isCellWarn(ev, task),
                    'skeu-cell-warn': isCellWarn(ev, task),
                  }"
                  :title="task.teamTask ? teamMembers(ev, task) : ''"
                  @click="togglePop(ev.id, task.id)"
                >
                  {{ cellLabel(ev, task) }}
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
    </div><!-- end desktop wrapper -->

    <!-- Assignment picker modal -->
    <RecordModal :open="activePop !== null" :title="pickerTitle" @close="closePops">
      <!-- Team picker -->
      <template v-if="activePopTask?.teamTask">
        <div class="space-y-1">
          <label class="flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer text-sm text-gray-400 hover:bg-gray-100">
            <input
              type="radio"
              :name="'tpick'"
              :checked="!assignments[activePop!.eid]?.[activePop!.tid]"
              @change="pickTeam(activePop!.eid, activePop!.tid, null)"
            /> —
          </label>
          <label
            v-for="team in db.teams.filter(t => t.taskId === activePop!.tid)"
            :key="team.id"
            class="flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer text-sm text-gray-700 hover:bg-gray-100"
          >
            <input
              type="radio"
              :name="'tpick'"
              :checked="assignments[activePop!.eid]?.[activePop!.tid]?.id === team.id"
              @change="pickTeam(activePop!.eid, activePop!.tid, team.id)"
              class="accent-accent"
            />
            <span class="flex-1">
              Team {{ team.number }}
              <span class="text-xs text-gray-400 ml-1">
                {{ (team.members || []).map(mid => db.contacts.find(c => c.id === mid)?.name).filter(Boolean).join(', ') }}
              </span>
            </span>
          </label>
        </div>
      </template>

      <!-- Person picker -->
      <template v-else-if="activePop">
        <input
          v-model="popSearch"
          type="text"
          placeholder="Sök person…"
          class="w-full border border-gray-300 rounded-md px-2.5 py-2 text-sm outline-none focus:border-accent mb-3"
        />
        <div ref="pickerListRef" class="min-h-[40vh] max-h-[50vh] overflow-y-auto space-y-0.5">
          <!-- Suggested contacts (recent 6 months) -->
          <template v-if="suggestedContacts().length > 0 && !popSearch">
            <div class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 pt-1 pb-0.5">Förslag</div>
            <label
              v-for="c in suggestedContacts()"
              :key="'s-' + c.id"
              class="flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer text-sm text-gray-700 hover:bg-gray-100 bg-accent/5"
            >
              <input
                type="checkbox"
                :checked="isPersonChecked(activePop.eid, activePop.tid, c.id)"
                @change="togglePerson(activePop.eid, activePop.tid, c.id, ($event.target as HTMLInputElement).checked)"
                class="accent-accent"
              />
              {{ c.name }}
            </label>
            <div class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 pt-2 pb-0.5">Alla</div>
          </template>
          <label
            v-for="c in (suggestedContacts().length > 0 && !popSearch ? otherContacts() : filteredContacts())"
            :key="c.id"
            class="flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer text-sm text-gray-700 hover:bg-gray-100"
          >
            <input
              type="checkbox"
              :checked="isPersonChecked(activePop.eid, activePop.tid, c.id)"
              @change="togglePerson(activePop.eid, activePop.tid, c.id, ($event.target as HTMLInputElement).checked)"
              class="accent-accent"
            />
            {{ c.name }}
          </label>
        </div>
        <div class="border-t border-gray-200 mt-3 pt-3">
          <div v-if="!addingPerson">
            <button @click="startAddPerson" class="text-xs text-accent hover:underline cursor-pointer bg-transparent border-none">+ Lägg till ny person</button>
          </div>
          <div v-else class="flex gap-2">
            <input
              v-model="newPersonName"
              type="text"
              placeholder="Fullständigt namn"
              class="flex-1 border border-gray-300 rounded-md px-2 py-1.5 text-sm outline-none focus:border-accent"
              @keydown.enter="commitAddPerson(activePop.eid, activePop.tid)"
            />
            <button @click="commitAddPerson(activePop.eid, activePop.tid)" class="px-3 py-1.5 text-sm rounded-md bg-accent text-white cursor-pointer border-none">Spara</button>
          </div>
        </div>
      </template>
    </RecordModal>

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

<style scoped>
.skeu-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  flex-shrink: 0;
  background: linear-gradient(180deg, #e8e8e8 0%, #d4d4d4 100%);
  border-bottom: 1px solid #bbb;
  box-shadow: 0 1px 0 rgba(255,255,255,.4) inset;
}
.skeu-toolbar-label {
  font-size: 11px;
  color: #666;
  text-shadow: 0 1px 0 rgba(255,255,255,.7);
}
.skeu-toolbar-label strong { color: #333; }
.skeu-badge-warn {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 4px;
  color: #7c5a00;
  background: linear-gradient(180deg, #fff4cc 0%, #ffe699 100%);
  border: 1px solid #d4a800;
  box-shadow: 0 1px 0 rgba(255,255,255,.5) inset;
  text-shadow: 0 1px 0 rgba(255,255,255,.4);
}
.skeu-search {
  width: 180px;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  outline: none;
  color: #333;
  background: linear-gradient(180deg, #e0e0e0 0%, #fff 3px);
  border: 1px solid #aaa;
  box-shadow: 0 1px 2px rgba(0,0,0,.06) inset;
}
.skeu-search:focus {
  border-color: #6a5aed;
  box-shadow: 0 1px 2px rgba(0,0,0,.06) inset, 0 0 0 2px rgba(106,90,237,.15);
}
.skeu-th {
  position: sticky;
  top: 0;
  z-index: 3;
  padding: 7px 6px;
  text-align: left;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #555;
  background: linear-gradient(180deg, #eee 0%, #ddd 100%);
  border-bottom: 1px solid #bbb;
  box-shadow: 0 1px 0 rgba(255,255,255,.5) inset;
  text-shadow: 0 1px 0 rgba(255,255,255,.7);
}
.skeu-dist-btn {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 3px;
  cursor: pointer;
  color: #fff;
  border: 1px solid rgba(0,0,0,.15);
  background: linear-gradient(180deg, #6a5aed 0%, #4a3cc9 100%);
  box-shadow: 0 1px 0 rgba(255,255,255,.15) inset;
  text-shadow: 0 -1px 0 rgba(0,0,0,.15);
  text-transform: none;
  letter-spacing: 0;
}
.skeu-dist-btn:hover { background: linear-gradient(180deg, #7b6cf5 0%, #5544d4 100%); }
.skeu-grid-row {
  border-bottom: 1px solid #d8d8d8;
  background: linear-gradient(180deg, #f8f8f8 0%, #f0f0f0 100%);
}
.skeu-grid-sticky {
  background: linear-gradient(180deg, #f0f0f0 0%, #e8e8e8 100%);
  border-bottom: 1px solid #d0d0d0;
  border-right: 1px solid #ccc;
}
.skeu-cell {
  padding: 4px 6px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
  transition: all 0.1s ease;
}
.skeu-cell-set {
  color: #333;
  background: linear-gradient(180deg, #fff 0%, #f0f0f0 100%);
  border: 1px solid #c0c0c0;
  box-shadow: 0 1px 0 rgba(255,255,255,.5) inset;
}
.skeu-cell-set:hover { border-color: #6a5aed; }
.skeu-cell-empty {
  color: #aaa;
  background: linear-gradient(180deg, #f0f0f0 0%, #e8e8e8 100%);
  border: 1px solid #ccc;
  box-shadow: 0 1px 2px rgba(0,0,0,.04) inset;
}
.skeu-cell-empty:hover { border-color: #6a5aed; }
.skeu-cell-warn {
  color: #7c5a00;
  background: linear-gradient(180deg, #fff8e0 0%, #ffefb0 100%);
  border: 1px solid #d4a800;
  box-shadow: 0 1px 0 rgba(255,255,255,.4) inset;
}
.skeu-cell-warn:hover { border-color: #b08900; }
</style>
