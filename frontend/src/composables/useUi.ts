import { ref, computed } from 'vue'
import type { TabId, EventView } from '../types'
import { useDb } from './useDb'

// ── Singleton state ──────────────────────────────────────────────────────────
const currentTab = ref<TabId>('events')
const currentView = ref<EventView>('calendar')
const selectedId = ref<number | null>(null)
const searchQuery = ref('')

// ── Derived state ────────────────────────────────────────────────────────────
const selectedRecord = computed(() => {
  const { db } = useDb()
  if (!selectedId.value) return null
  const tab = currentTab.value as keyof Pick<
    import('../types').Database, 'events' | 'contacts' | 'tasks' | 'teams'
  >
  const collection = db[tab]
  if (!Array.isArray(collection)) return null
  return (collection as Array<{ id: number }>).find(r => r.id === selectedId.value) ?? null
})

// ── Actions ──────────────────────────────────────────────────────────────────
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

export function useUi() {
  return {
    currentTab, currentView, selectedId, searchQuery,
    selectedRecord,
    selectRecord, switchTab, setView,
  }
}
