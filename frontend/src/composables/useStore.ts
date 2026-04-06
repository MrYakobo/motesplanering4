/**
 * Facade — re-exports from useDb, useAuth, and useUi.
 *
 * Existing consumers can keep importing { useStore } unchanged.
 * New code should import the specific composable directly:
 *   import { useDb } from './useDb'
 *   import { useAuth } from './useAuth'
 *   import { useUi } from './useUi'
 */
import { useDb } from './useDb'
import { useAuth } from './useAuth'
import { useUi } from './useUi'

export function useStore() {
  const dbStore = useDb()
  const authStore = useAuth()
  const uiStore = useUi()

  return {
    // useDb
    db: dbStore.db,
    assignments: dbStore.assignments,
    BADGE_COLORS: dbStore.BADGE_COLORS,
    getCatColor: dbStore.getCatColor,
    loadAssignments: dbStore.loadAssignments,
    persist: dbStore.persist,
    nextId: dbStore.nextId,
    getAssignmentLabel: dbStore.getAssignmentLabel,
    isCatPublic: dbStore.isCatPublic,
    getPublicEvents: dbStore.getPublicEvents,
    effectiveTasks: dbStore.effectiveTasks,

    // useAuth
    role: authStore.role,
    memberContactId: authStore.memberContactId,
    loading: authStore.loading,
    needsSetup: authStore.needsSetup,
    isAdmin: authStore.isAdmin,
    isMember: authStore.isMember,
    isViewer: authStore.isViewer,
    loadApp: authStore.loadApp,

    // useUi
    currentTab: uiStore.currentTab,
    currentView: uiStore.currentView,
    selectedId: uiStore.selectedId,
    searchQuery: uiStore.searchQuery,
    selectedRecord: uiStore.selectedRecord,
    selectRecord: uiStore.selectRecord,
    switchTab: uiStore.switchTab,
    setView: uiStore.setView,

    // Legacy — kept for backward compat, unused by components
    toastMessage: null as any,
    showToast: (() => {}) as any,
  }
}
