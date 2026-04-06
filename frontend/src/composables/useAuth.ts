import { ref, computed } from 'vue'
import type { UserRole } from '../types'
import { useApi } from './useApi'
import { useDb } from './useDb'

// ── Singleton state ──────────────────────────────────────────────────────────
const role = ref<UserRole>('viewer')
const memberContactId = ref<number | null>(null)
const loading = ref(true)
const needsSetup = ref(false)

// ── Derived state ────────────────────────────────────────────────────────────
const isAdmin = computed(() => role.value === 'admin')
const isMember = computed(() => role.value === 'member')
const isViewer = computed(() => role.value === 'viewer')

// ── Actions ──────────────────────────────────────────────────────────────────
const api = useApi()

async function loadApp() {
  const { db, loadAssignments } = useDb()
  loading.value = true
  try {
    const me = await api.checkRole() as any
    if (me.setup) {
      needsSetup.value = true
      loading.value = false
      return
    }
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

export function useAuth() {
  return {
    role, memberContactId, loading, needsSetup,
    isAdmin, isMember, isViewer,
    loadApp,
  }
}
