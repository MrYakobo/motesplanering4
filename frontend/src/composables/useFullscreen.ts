import { ref, readonly, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const isFullscreen = ref(false)

export function useFullscreen() {
  const router = useRouter()
  const route = useRoute()

  function enter() {
    isFullscreen.value = true
    if (!route.path.includes('/fullscreen')) router.replace(route.path + '/fullscreen')
  }

  function exit() {
    isFullscreen.value = false
    const base = route.path.replace(/\/fullscreen.*$/, '')
    router.replace(base)
  }

  function toggle() {
    isFullscreen.value ? exit() : enter()
  }

  // Sync state from route on mount (for direct URL access)
  function syncFromRoute() {
    isFullscreen.value = route.path.includes('/fullscreen')
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && isFullscreen.value) {
      e.preventDefault()
      exit()
    }
    if (e.key === 'f' && !isFullscreen.value && !(e.target as HTMLElement)?.closest('input,textarea,select')) {
      const fsViews = ['/slides', '/sunday', '/namnskyltar']
      if (fsViews.some(v => route.path.startsWith(v))) {
        e.preventDefault()
        enter()
      }
    }
  }

  onMounted(() => {
    syncFromRoute()
    window.addEventListener('keydown', onKeydown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', onKeydown)
    isFullscreen.value = false
  })

  return {
    isFullscreen: readonly(isFullscreen),
    enter,
    exit,
    toggle,
    syncFromRoute,
  }
}

// Exported for AppNav to read without lifecycle hooks
export const fullscreenState = isFullscreen
