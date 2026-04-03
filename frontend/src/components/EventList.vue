<script setup lang="ts">
import { computed, ref, nextTick, onMounted, onUnmounted } from 'vue'
import { useToday } from '../composables/useToday'
import { useCategories } from '../composables/useCategories'
import { ArrowRight, Ellipsis } from 'lucide-vue-next'
import type { Event } from '../types'

const props = defineProps<{
  events: Event[]
  selectedId?: number | null
}>()

const emit = defineEmits<{
  select: [id: number]
}>()

const { todayStr } = useToday()
const { catStyle } = useCategories()

const scrollRef = ref<HTMLElement | null>(null)
const hasScrolled = ref(false)
const todayVisible = ref(true)

const hasTodayEvent = computed(() => props.events.some(e => e.date === todayStr.value))

const todaySepIndex = computed(() => {
  if (hasTodayEvent.value) return -1
  const t = todayStr.value
  for (let i = 0; i < props.events.length; i++) {
    if (props.events[i].date > t) return i > 0 ? i : -1
  }
  return -1
})

function isPast(ev: Event) { return ev.date < todayStr.value }
function isToday(ev: Event) { return ev.date === todayStr.value }

function checkTodayVisible() {
  const container = scrollRef.value
  if (!container) { todayVisible.value = false; return }
  const el = (container.querySelector('.today-row') || container.querySelector('.today-sep')) as HTMLElement
  if (!el) { todayVisible.value = false; return }
  const cRect = container.getBoundingClientRect()
  const tRect = el.getBoundingClientRect()
  todayVisible.value = tRect.bottom >= cRect.top && tRect.top <= cRect.bottom
}

function scrollToToday() {
  const container = scrollRef.value
  if (!container) return
  const el = (container.querySelector('.today-row') || container.querySelector('.today-sep')) as HTMLElement
  if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

function navDown() {
  const idx = props.events.findIndex(e => e.id === props.selectedId)
  const next = Math.min(props.events.length - 1, idx + 1)
  if (props.events[next]) {
    emit('select', props.events[next].id)
    nextTick(() => {
      const rows = scrollRef.value?.querySelectorAll('.skeu-row')
      if (rows?.[next]) (rows[next] as HTMLElement).scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }
}
function navUp() {
  const idx = props.events.findIndex(e => e.id === props.selectedId)
  const prev = Math.max(0, idx <= 0 ? 0 : idx - 1)
  if (props.events[prev]) {
    emit('select', props.events[prev].id)
    nextTick(() => {
      const rows = scrollRef.value?.querySelectorAll('.skeu-row')
      if (rows?.[prev]) (rows[prev] as HTMLElement).scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }
}

defineExpose({ goToday: scrollToToday, todayVisible, navUp, navDown })

onMounted(() => {
  nextTick(() => {
    if (hasScrolled.value) return
    hasScrolled.value = true
    const container = scrollRef.value
    if (!container) return
    const el = (container.querySelector('.today-row') || container.querySelector('.today-sep')) as HTMLElement
    if (el) el.scrollIntoView({ block: 'center', behavior: 'instant' })
    container.addEventListener('scroll', checkTodayVisible, { passive: true })
    checkTodayVisible()
  })
})
onUnmounted(() => {
  scrollRef.value?.removeEventListener('scroll', checkTodayVisible)
})
</script>

<template>
  <div class="flex-1 overflow-hidden flex flex-col relative">
    <div ref="scrollRef" class="flex-1 overflow-auto">
      <table class="w-full border-collapse">
        <thead>
          <tr>
            <th class="skeu-th w-5 px-0 hidden sm:table-cell" />
            <th class="skeu-th">Datum</th>
            <th class="skeu-th">Titel</th>
            <th class="skeu-th hidden sm:table-cell">Kategori</th>
            <th class="skeu-th hidden sm:table-cell">Beskrivning</th>
            <th class="skeu-th w-10 hidden sm:table-cell" />
          </tr>
        </thead>
        <tbody>
          <template v-for="(ev, idx) in events" :key="ev.id">
            <tr v-if="todaySepIndex === idx" class="today-sep" style="scroll-margin-top: 40px">
              <td colspan="6" class="p-0 h-0.5 bg-accent relative">
                <span class="absolute left-2 -top-2 text-[10px] font-semibold text-accent pointer-events-none">idag</span>
              </td>
            </tr>
            <tr
              @click="emit('select', ev.id)"
              class="skeu-row group"
              :class="{
                'skeu-row-selected': selectedId === ev.id,
                'skeu-row-today today-row': isToday(ev),
                'opacity-50': isPast(ev) && !isToday(ev),
              }"
              :style="isToday(ev) ? 'scroll-margin-top: 40px' : ''"
            >
              <td class="w-5 px-0 text-center align-middle hidden sm:table-cell">
                <ArrowRight v-if="isToday(ev)" :size="14" class="text-accent inline-block" />
              </td>
              <td class="px-3.5 py-2.5 text-sm" :class="{ 'shadow-[inset_3px_0_0_var(--accent)]': isToday(ev) }">
                <span class="text-xs whitespace-nowrap">{{ ev.date }} {{ ev.time || '' }}</span>
              </td>
              <td class="px-3.5 py-2.5 text-sm">{{ ev.title }}</td>
              <td class="px-3.5 py-2.5 text-sm hidden sm:table-cell">
                <span v-if="ev.category" class="skeu-badge" :style="catStyle(ev.category)">{{ ev.category }}</span>
                <span v-else class="text-gray-400">—</span>
              </td>
              <td class="px-3.5 py-2.5 text-sm hidden sm:table-cell">
                <span v-if="ev.description">{{ ev.description }}</span>
                <span v-else class="text-gray-400">—</span>
              </td>
              <td class="w-10 text-center px-1 hidden sm:table-cell">
                <button class="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-white/60 transition-all">
                  <Ellipsis :size="16" />
                </button>
              </td>
            </tr>
          </template>
          <tr v-if="events.length === 0">
            <td colspan="6" class="py-6 text-center text-gray-400 text-sm">Inga resultat</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.skeu-th {
  position: sticky;
  top: 0;
  z-index: 3;
  padding: 7px 14px;
  text-align: left;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
  color: #666;
  background: linear-gradient(180deg, #eee 0%, #ddd 100%);
  border-bottom: 1px solid #bbb;
  box-shadow: 0 1px 0 rgba(255,255,255,.5) inset;
  text-shadow: 0 1px 0 rgba(255,255,255,.7);
}
.skeu-row {
  cursor: pointer;
  transition: background 0.1s ease;
  border-bottom: 1px solid #d8d8d8;
  background: linear-gradient(180deg, #f8f8f8 0%, #f0f0f0 100%);
}
.skeu-row:hover {
  background: linear-gradient(180deg, #fff 0%, #f4f4f4 100%);
}
.skeu-row-selected {
  background: linear-gradient(180deg, #e8e0ff 0%, #ddd5f8 100%) !important;
}
.skeu-row-today {
  background: linear-gradient(180deg, #ede9fe 0%, #e0d8f8 100%) !important;
}
.skeu-badge {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid rgba(0,0,0,.08);
  box-shadow: 0 1px 0 rgba(255,255,255,.5) inset;
}
</style>
