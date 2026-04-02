import { ref, computed } from 'vue'

// ── Simulated date ───────────────────────────────────────────────────────────
// Global reactive state — shared across all components
const simDate = ref<string | null>(localStorage.getItem('simDate'))

export function useToday() {
  /** The effective "today" as a Date object */
  const today = computed(() =>
    simDate.value ? new Date(simDate.value + 'T00:00:00') : new Date()
  )

  /** The effective "today" as YYYY-MM-DD string */
  const todayStr = computed(() => {
    const d = today.value
    return d.toISOString().slice(0, 10)
  })

  /** Whether a simulated date is active */
  const isSimulated = computed(() => !!simDate.value)

  /** Set a simulated date (YYYY-MM-DD string) or null to clear */
  function setSimDate(date: string | null) {
    simDate.value = date || null
    if (simDate.value) {
      localStorage.setItem('simDate', simDate.value)
    } else {
      localStorage.removeItem('simDate')
    }
  }

  /** Clear the simulated date back to real today */
  function clearSimDate() {
    setSimDate(null)
  }

  return { today, todayStr, isSimulated, simDate, setSimDate, clearSimDate }
}
