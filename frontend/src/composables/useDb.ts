import { reactive } from 'vue'
import type {
  Database, Event,
  Assignments, Assignment,
} from '../types'
import { useApi } from './useApi'
import { useToast } from './useToast'

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
  lateWithdrawals: [],
  _version: 0,
})

const assignments = reactive<Assignments>({})

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

// ── Data actions ─────────────────────────────────────────────────────────────
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

async function persist(key: string) {
  try {
    const data = db[key as keyof Database]
    db._version = await api.save(key, data, db._version)
  } catch (err: any) {
    console.error('Save failed:', err)
    useToast().show('Kunde inte spara: ' + err.message, 'error')
  }
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

function effectiveTasks(event: Event): number[] {
  if (event.expectedTasks && event.expectedTasks.length > 0) return event.expectedTasks
  const cat = db.categories.find(c => c.name === event.category)
  return cat?.defaultTasks || []
}

export function useDb() {
  return {
    db, assignments,
    BADGE_COLORS, getCatColor,
    loadAssignments, persist, nextId, getAssignmentLabel,
    isCatPublic, getPublicEvents, effectiveTasks,
  }
}
