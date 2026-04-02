import { ref, computed } from 'vue'

// ── Local date helper ────────────────────────────────────────────────────────
/** Format a Date as YYYY-MM-DD in local timezone (not UTC) */
export function localDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ── Simulated date ───────────────────────────────────────────────────────────
// Global reactive state — shared across all components
const simDate = ref<string | null>(localStorage.getItem('simDate'))

export function useToday() {
  /** The effective "today" as a Date object */
  const today = computed(() =>
    simDate.value ? new Date(simDate.value + 'T00:00:00') : new Date()
  )

  const todayStr = computed(() => localDateStr(today.value))

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
