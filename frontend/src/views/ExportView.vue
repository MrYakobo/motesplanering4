<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '../composables/useStore'
import { useToday } from '../composables/useToday'
import { useToast } from '../composables/useToast'
import { useApi } from '../composables/useApi'

const { db } = useStore()
const { todayStr, today: todayDate } = useToday()
const { show: toast } = useToast()
const api = useApi()

const MONTH_NAMES = ['Januari','Februari','Mars','April','Maj','Juni','Juli','Augusti','September','Oktober','November','December']
const DAY_NAMES = ['Söndag','Måndag','Tisdag','Onsdag','Torsdag','Fredag','Lördag']

const numMonths = ref(2)
const publishing = ref(false)

const endDate = computed(() => {
  const d = new Date(todayDate.value)
  const end = new Date(d.getFullYear(), d.getMonth() + numMonths.value, 0)
  return end.toISOString().slice(0, 10)
})

const filteredEvents = computed(() =>
  db.events
    .filter(e => e.date >= todayStr.value && e.date <= endDate.value)
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
)

// Group by month
const byMonth = computed(() => {
  const groups: Record<number, typeof filteredEvents.value> = {}
  filteredEvents.value.forEach(ev => {
    const m = parseInt(ev.date.slice(5, 7)) - 1
    if (!groups[m]) groups[m] = []
    groups[m].push(ev)
  })
  return Object.entries(groups)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .map(([m, events]) => ({ month: parseInt(m), events }))
})

function dayName(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return DAY_NAMES[d.getDay()]
}

function dayNum(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').getDate()
}

function weekNumber(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

// Group events by date within a month, tracking first-in-date
function groupByDate(events: typeof filteredEvents.value) {
  const result: { ev: typeof events[0]; isFirst: boolean; dateStr: string }[] = []
  let lastDate = ''
  events.forEach(ev => {
    const isFirst = ev.date !== lastDate
    result.push({ ev, isFirst, dateStr: ev.date })
    lastDate = ev.date
  })
  return result
}

// Check if two dates are in the same ISO week
function _sameWeek(a: string, b: string) {
  return weekNumber(a) === weekNumber(b)
}

async function publishExport() {
  publishing.value = true
  try {
    // Build simple HTML from the preview
    const el = document.getElementById('export-preview')
    if (!el) return
    const html = el.innerHTML
    const res = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...Object.fromEntries(Object.entries(api.authHeader.value ? { Authorization: api.authHeader.value } : {})) },
      body: JSON.stringify({ html }),
    })
    if (!res.ok) throw new Error(`Serverfel (${res.status})`)
    const data = await res.json()
    toast(data.ok ? 'Publicerad!' : 'Fel: ' + (data.error || 'okänt'), data.ok ? 'ok' : 'error')
  } catch (err: any) {
    toast('Publicering misslyckades: ' + err.message, 'error')
  } finally {
    publishing.value = false
  }
}
</script>

<template>
  <div class="flex-1 overflow-y-auto bg-gray-50 p-6 flex flex-col items-center">
    <div class="max-w-2xl w-full">
      <!-- Toolbar -->
      <div class="flex items-center gap-3 mb-4 flex-wrap">
        <h2 class="text-base font-semibold">Månadsblad</h2>
        <label class="text-sm text-gray-500 flex items-center gap-1.5">
          Månader:
          <select
            v-model.number="numMonths"
            class="border border-gray-300 rounded-md px-2 py-1 text-sm outline-none focus:border-accent"
          >
            <option v-for="n in [1,2,3,4,6,9,12]" :key="n" :value="n">{{ n }}</option>
          </select>
        </label>
        <span class="text-xs text-gray-400">{{ filteredEvents.length }} händelser · {{ todayStr }} → {{ endDate }}</span>
        <button
          @click="publishExport"
          :disabled="publishing"
          class="ml-auto bg-accent text-white rounded-md px-3 py-1.5 text-sm cursor-pointer hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {{ publishing ? 'Publicerar…' : 'Publicera' }}
        </button>
      </div>

      <!-- Preview matching old app style -->
      <div id="export-preview" class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div v-for="mg in byMonth" :key="mg.month" class="export-month">
          <p class="export-month-title">{{ MONTH_NAMES[mg.month] }}</p>
          <table class="export-table">
            <tbody>
              <tr
                v-for="(row, i) in groupByDate(mg.events)" :key="i"
                :class="{
                  'export-weekday': row.isFirst,
                  'export-today': row.dateStr === todayStr,
                }"
              >
                <td class="export-td-day">
                  <template v-if="row.isFirst">{{ dayName(row.dateStr) }}&nbsp;{{ dayNum(row.dateStr) }}</template>
                </td>
                <td class="export-td-time">{{ row.ev.time || '' }}</td>
                <td class="export-td-title">{{ row.ev.title }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@100;300;400&display=swap');

.export-month {
  margin-bottom: 2em;
}
.export-month-title {
  font-family: 'Roboto', sans-serif;
  font-weight: 100;
  text-transform: none;
  text-align: center;
  font-size: 3em;
  color: #a30c0c;
  display: table;
  margin: 10px auto;
  padding: 10px 20px 20px;
}
.export-table {
  border-collapse: collapse;
  font-family: 'Roboto', sans-serif;
  font-weight: 300;
  margin: 10px auto;
  width: 90%;
}
.export-table td {
  padding: 2px 7px 4px 8px;
  font-size: 14px;
}
.export-td-day {
  white-space: nowrap;
  color: #555;
  min-width: 100px;
}
.export-td-time {
  white-space: nowrap;
  color: #888;
  min-width: 50px;
}
.export-td-title {
  color: #333;
}
tr.export-weekday {
  border-top: 1px solid rgba(0, 0, 0, 0.15);
}
tr.export-today {
  background-color: rgba(255, 255, 0, 0.1);
}
</style>
