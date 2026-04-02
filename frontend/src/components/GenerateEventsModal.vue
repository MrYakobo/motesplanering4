<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { X, Plus, Trash2, RefreshCw } from 'lucide-vue-next'
import { useStore } from '../composables/useStore'
import { useToday } from '../composables/useToday'
import { useToast } from '../composables/useToast'
import type { RecurringPatterns, Event } from '../types'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; generated: [] }>()

const { db, persist, assignments } = useStore()
const { today: todayDate } = useToday()
const { show: toast } = useToast()

const dayLabels = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'] as const

const fromDate = ref(todayDate.value.toISOString().slice(0, 10))
const toDate = ref(new Date(todayDate.value.getFullYear(), todayDate.value.getMonth() + 3, todayDate.value.getDate()).toISOString().slice(0, 10))

const patterns = reactive<RecurringPatterns>({})

watch(() => props.open, (v) => {
  if (v) {
    Object.keys(patterns).forEach(k => delete patterns[k])
    const saved = db.recurring_events || {}
    Object.entries(saved).forEach(([k, v]) => {
      patterns[k] = JSON.parse(JSON.stringify(v))
    })
  }
})

function addEntry(day: string) {
  if (!patterns[day]) patterns[day] = []
  patterns[day].push({ title: '', time: '10:00' })
}

function removeEntry(day: string, idx: number) {
  patterns[day].splice(idx, 1)
  if (patterns[day].length === 0) delete patterns[day]
}

function weekNumber(d: Date): number {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7))
  const y = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  return Math.ceil(((tmp.getTime() - y.getTime()) / 86400000 + 1) / 7)
}

// JS getDay(): 0=Sun..6=Sat → map to our dayLabels index (0=Mån..6=Sön)
const jsToDayIdx = [6, 0, 1, 2, 3, 4, 5]

const preview = computed(() => {
  if (!fromDate.value || !toDate.value) return []
  const results: { date: string; time: string; title: string; category: string }[] = []
  const d = new Date(fromDate.value + 'T00:00:00')
  const end = new Date(toDate.value + 'T00:00:00')
  while (d <= end) {
    const dayLabel = dayLabels[jsToDayIdx[d.getDay()]]
    const entries = patterns[dayLabel] || []
    const wn = weekNumber(d)
    for (const e of entries) {
      if (!e.title) continue
      if (e.filter === 'ODD' && wn % 2 === 0) continue
      if (e.filter === 'EVEN' && wn % 2 !== 0) continue
      results.push({
        date: d.toISOString().slice(0, 10),
        time: e.time || '',
        title: e.title,
        category: e.category || '',
      })
    }
    d.setDate(d.getDate() + 1)
  }
  return results
})

const newCount = computed(() => {
  return preview.value.filter(p =>
    !db.events.some(x => x.date === p.date && x.time === p.time && x.title === p.title)
  ).length
})

async function execute() {
  const list = preview.value
  if (list.length === 0) return
  let maxId = db.events.reduce((m, e) => Math.max(m, e.id), 0)
  let added = 0
  for (const p of list) {
    if (db.events.some(x => x.date === p.date && x.time === p.time && x.title === p.title)) continue
    maxId++
    const ev: Event = {
      id: maxId,
      title: p.title,
      category: p.category,
      date: p.date,
      time: p.time,
      description: '',
      infoLink: '',
      promoSlides: [],
      expectedTasks: [],
      volunteers: 0,
    }
    db.events.push(ev)
    assignments[ev.id] = {}
    added++
  }
  // Save patterns + events
  db.recurring_events = JSON.parse(JSON.stringify(patterns))
  await persist('recurring_events')
  await persist('events')
  toast(`${added} händelser genererade`)
  emit('generated')
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/35 backdrop-blur-sm"
        @click.self="emit('close')"
      >
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          <!-- Header -->
          <div class="flex items-center px-5 py-3 border-b border-gray-200 shrink-0">
            <h3 class="flex-1 text-sm font-semibold">Generera händelser</h3>
            <button @click="emit('close')" class="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600">
              <X :size="16" />
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-5 space-y-4">
            <!-- Date range -->
            <div class="flex gap-4">
              <div class="flex-1">
                <label class="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Från</label>
                <input v-model="fromDate" type="date" class="field-input" />
              </div>
              <div class="flex-1">
                <label class="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Till</label>
                <input v-model="toDate" type="date" class="field-input" />
              </div>
            </div>

            <!-- Day patterns -->
            <div v-for="day in dayLabels" :key="day" class="border border-gray-200 rounded-lg overflow-hidden">
              <div class="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-200">
                <span class="text-xs font-semibold text-gray-700">{{ day }}</span>
                <button @click="addEntry(day)" class="flex items-center gap-1 text-[11px] text-accent hover:underline bg-transparent border-none cursor-pointer">
                  <Plus :size="12" /> Lägg till
                </button>
              </div>
              <div v-if="patterns[day]?.length" class="divide-y divide-gray-100">
                <div v-for="(entry, idx) in patterns[day]" :key="idx" class="flex items-center gap-2 px-3 py-1.5">
                  <select v-model="entry.filter" class="text-xs border border-gray-300 rounded px-1.5 py-1">
                    <option :value="undefined">Varje</option>
                    <option value="ODD">Udda v.</option>
                    <option value="EVEN">Jämn v.</option>
                  </select>
                  <input v-model="entry.time" type="text" placeholder="HH:MM" class="w-14 text-xs border border-gray-300 rounded px-1.5 py-1" />
                  <input v-model="entry.title" type="text" placeholder="Titel" class="flex-1 text-xs border border-gray-300 rounded px-1.5 py-1" />
                  <select v-model="entry.category" class="text-xs border border-gray-300 rounded px-1.5 py-1 max-w-[100px]">
                    <option value="">Kategori…</option>
                    <option v-for="c in db.categories" :key="c.name" :value="c.name">{{ c.name }}</option>
                  </select>
                  <button @click="removeEntry(day, idx)" class="text-gray-400 hover:text-red-500 bg-transparent border-none cursor-pointer">
                    <Trash2 :size="13" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Preview -->
            <div class="border border-gray-200 rounded-lg overflow-hidden">
              <div class="px-3 py-1.5 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                <RefreshCw :size="12" class="text-gray-400" />
                <span class="text-xs font-semibold text-gray-700">
                  Förhandsgranskning: {{ preview.length }} händelser
                  <template v-if="newCount < preview.length"> ({{ newCount }} nya)</template>
                </span>
              </div>
              <div v-if="preview.length" class="max-h-48 overflow-y-auto divide-y divide-gray-50">
                <div v-for="(p, i) in preview" :key="i" class="flex items-center gap-3 px-3 py-1 text-xs">
                  <span class="text-gray-500 w-20 shrink-0">{{ p.date }}</span>
                  <span class="text-gray-400 w-10 shrink-0">{{ p.time }}</span>
                  <span class="text-gray-800 flex-1">{{ p.title }}</span>
                </div>
              </div>
              <div v-else class="px-3 py-3 text-xs text-gray-400">Inga händelser att generera</div>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-5 py-3 border-t border-gray-200 flex gap-2 justify-end shrink-0">
            <button @click="emit('close')" class="px-3 py-1.5 text-xs rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer">Avbryt</button>
            <button
              @click="execute"
              :disabled="newCount === 0"
              class="px-3 py-1.5 text-xs rounded-md text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              :class="newCount > 0 ? 'bg-accent hover:bg-accent/90' : 'bg-gray-400'"
            >
              Generera {{ newCount }} händelser
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active { transition: opacity 0.18s ease; }
.modal-leave-active { transition: opacity 0.15s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-active > div { transition: transform 0.2s cubic-bezier(0.34, 1.2, 0.64, 1); }
.modal-leave-active > div { transition: transform 0.15s ease; }
.modal-enter-from > div { transform: translateY(12px) scale(0.98); }
.modal-leave-to > div { transform: translateY(8px) scale(0.98); }
</style>
