<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useStore } from './composables/useStore'
import { fullscreenState } from './composables/useFullscreen'
import AppNav from './components/AppNav.vue'
import ToastContainer from './components/ToastContainer.vue'

const ACCENT_COLORS: Record<string, { color: string; hover: string; light: string; mid: string }> = {
  indigo: { color: '#4f46e5', hover: '#4338ca', light: '#ede9fe', mid: '#a78bfa' },
  purple: { color: '#7c3aed', hover: '#6d28d9', light: '#f5f3ff', mid: '#c4b5fd' },
  blue:   { color: '#2563eb', hover: '#1d4ed8', light: '#dbeafe', mid: '#93c5fd' },
  teal:   { color: '#0d9488', hover: '#0f766e', light: '#ccfbf1', mid: '#5eead4' },
  green:  { color: '#16a34a', hover: '#15803d', light: '#dcfce7', mid: '#86efac' },
  amber:  { color: '#d97706', hover: '#b45309', light: '#fef3c7', mid: '#fcd34d' },
  red:    { color: '#dc2626', hover: '#b91c1c', light: '#fee2e2', mid: '#fca5a5' },
  pink:   { color: '#db2777', hover: '#be185d', light: '#fce7f3', mid: '#f9a8d4' },
  slate:  { color: '#475569', hover: '#334155', light: '#f1f5f9', mid: '#94a3b8' },
}

function applyTheme(id: string) {
  const t = ACCENT_COLORS[id] || ACCENT_COLORS.indigo
  document.documentElement.style.setProperty('--accent', t.color)
  document.documentElement.style.setProperty('--accent-hover', t.hover)
  document.documentElement.style.setProperty('--accent-light', t.light)
  document.documentElement.style.setProperty('--accent-mid', t.mid)
  document.documentElement.style.setProperty('--accent-text', t.color)
}

const { loading, loadApp, isViewer, db } = useStore()
const router = useRouter()

onMounted(async () => {
  await loadApp()
  applyTheme(db.settings?.accentColor || 'indigo')
  if (isViewer.value && router.currentRoute.value.path.startsWith('/events')) {
    router.replace('/home')
  }
})
</script>

<template>
  <div class="flex flex-col sm:flex-row h-dvh overflow-hidden bg-[#e0e0e0] text-gray-900">
    <AppNav v-if="!loading && !fullscreenState && !isViewer" />
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <p class="text-gray-400 text-sm">Laddar...</p>
    </div>
    <router-view v-else class="flex-1 overflow-hidden" />
    <ToastContainer />
  </div>
</template>
