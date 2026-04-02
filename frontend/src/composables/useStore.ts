import { reactive, ref, computed } from 'vue'
import type {
  Database, Event, Contact, Task, Team, Category,
  Assignments, Assignment, TabId, EventView, UserRole,
} from '../types'
import { useApi } from './useApi'

// ── Singleton state ──────────────────────────────────────────────────────────
const db = reactive<Database>({
  events: [],
  contacts: [],
  tasks: [],
  teams: [],
  categories: [],
  schedules: {},
  recurring_events: {},
  globalSlides: [],
  slideLogo: '',
  slideBackground: { color: '#111', image: '' },
  settings: {},
  _version: 0,
})

const assignments = reactive<Assignments>({})
const currentTab = ref<TabId>('events')
const currentView = ref<EventView>('list')
const selectedId = ref<number | null>(null)
const role = ref<UserRole>('viewer')
const memberContactId = ref<number | null>(null)
const loading = ref(true)
const searchQuery = ref('')
const toastMessage = ref<{ msg: string; type: string } | null>(null)

// ── Badge colors ─────────────────────────────────────────────────────────────
const BADGE_COLORS = [
  { id: 'blue', bg: '#dbeafe', fg: '#1d4ed8' },
  { id: 'green', bg: '#d1fae5', fg: '#065f46' },
  { id: 'amber', bg: '#fef3c7', fg: '#92400e' },
  { id: 'gray', bg: '#f3f4f6', fg: '#6b7280' },
  { id: 'red', bg: '#fee2e2', fg: '#991b1b' },
  { id: 'purple', bg: '#ede9fe', fg: '#5b21b6' },
  { id: 'pink', bg: '#fce7f3', fg: '#9d174d' },
  { id: 'teal', bg: '#ccfbf1', fg: '#115e59' },
] as const

function getCatColor(catName: string) {
  const cat = db.categories.find(c => c.name === catName)
  const colorId = cat?.color
  return BADGE_COLORS.find(c => c.id === colorId) ?? BADGE_COLORS[3]
}

// ── Derived state ────────────────────────────────────────────────────────────
const isAdmin = computed(() => role.value === 'admin')
const isMember = computed(() => role.value === 'member')
const isViewer = computed(() => role.value === 'viewer')

const selectedRecord = computed(() => {
  if (!selectedId.value) return null
  const tab = currentTab.value as keyof Pick<Database, 'events' | 'contacts' | 'tasks' | 'teams'>
  const collection = db[tab]
  if (!Array.isArray(collection)) return null
  return (collection as Array<{ id: number }>).find(r => r.id === selectedId.value) ?? null
})

// ── Actions ──────────────────────────────────────────────────────────────────
const api = useApi()

function loadAssignments() {
  const saved = db.schedules || {}
  db.events.forEach(e => {
    if (!assignments[e.id]) assignments[e.id] = {}
  })
  Object.entries(saved).forEach(([eid, tasks]) => {
    const numEid = parseInt(eid)
    if (!assignments[numEid]) assignments[numEid] = {}
    Object.entries(tasks as Record<string, Assignment>).forEach(([tid, asgn]) => {
      assignments[numEid][parseInt(tid)] = asgn
    })
  })
}

async function loadApp() {
  loading.value = true
  try {
    const me = await api.checkRole()
    role.value = me.role
    if (me.contactId) memberContactId.value = me.contactId
    const data = await api.fetchDb()
    Object.assign(db, data)
    loadAssignments()
  } catch (err) {
    console.error('Failed to load app:', err)
  } finally {
    loading.value = false
  }
}

async function persist(key: string) {
  try {
    const data = db[key as keyof Database]
    db._version = await api.save(key, data, db._version)
  } catch (err: any) {
    console.error('Save failed:', err)
    showToast('Kunde inte spara: ' + err.message, 'error')
  }
}

function selectRecord(id: number | null) {
  selectedId.value = id
}

function switchTab(tab: TabId) {
  currentTab.value = tab
  selectedId.value = null
  searchQuery.value = ''
}

function setView(view: EventView) {
  currentView.value = view
  selectedId.value = null
}

function showToast(msg: string, type: string = 'ok') {
  toastMessage.value = { msg, type }
  setTimeout(() => { toastMessage.value = null }, 3500)
}

function nextId(collection: Array<{ id: number }>): number {
  return collection.reduce((m, r) => Math.max(m, r.id), 0) + 1
}

function getAssignmentLabel(eid: number, tid: number): string {
  const a = assignments[eid]?.[tid]
  if (!a) return '—'
  if (a.type === 'team') {
    const t = db.teams.find(t => t.id === a.id)
    return t ? `Team ${t.number}` : '?'
  }
  return (a.ids || []).map(id => db.contacts.find(c => c.id === id)?.name).filter(Boolean).join(', ') || '—'
}

function isCatPublic(catName: string): boolean {
  const cat = db.categories.find(c => c.name === catName)
  return !cat || !cat.hidden
}

function getPublicEvents(): Event[] {
  return db.events.filter(e => isCatPublic(e.category))
}

export function useStore() {
  return {
    db, assignments, currentTab, currentView, selectedId,
    role, memberContactId, loading, searchQuery, toastMessage,
    isAdmin, isMember, isViewer, selectedRecord,
    BADGE_COLORS, getCatColor,
    loadApp, persist, selectRecord, switchTab, setView,
    loadAssignments, showToast, nextId, getAssignmentLabel,
    isCatPublic, getPublicEvents,
  }
}
