<script setup lang="ts">
import { computed, ref, nextTick, onMounted } from 'vue'
import { useToday } from '../composables/useToday'
import { useCategories } from '../composables/useCategories'
import { ArrowRight, Ellipsis } from 'lucide-vue-next'
import ScrollTodayButton from './ScrollTodayButton.vue'
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

const hasTodayEvent = computed(() => props.events.some(e => e.date === todayStr.value))

// Find the index where the today separator should go (between last past and first future)
const todaySepIndex = computed(() => {
  if (hasTodayEvent.value) return -1
  const t = todayStr.value
  for (let i = 0; i < props.events.length; i++) {
    if (props.events[i].date > t) {
      return i > 0 ? i : -1
    }
  }
  return -1
})

function isPast(ev: Event) {
  return ev.date < todayStr.value
}

function isToday(ev: Event) {
  return ev.date === todayStr.value
}

function scrollToToday() {
  const container = scrollRef.value
  if (!container) return
  // Prefer the today row, fall back to the separator
  const el = (container.querySelector('.today-row') || container.querySelector('.today-sep')) as HTMLElement
  if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

onMounted(() => {
  nextTick(() => {
    if (hasScrolled.value) return
    hasScrolled.value = true
    const container = scrollRef.value
    if (!container) return
    const el = (container.querySelector('.today-row') || container.querySelector('.today-sep')) as HTMLElement
    if (el) el.scrollIntoView({ block: 'center', behavior: 'instant' })
  })
})
</script>

<template>
  <div class="flex-1 overflow-hidden flex flex-col relative">
    <div ref="scrollRef" class="flex-1 overflow-auto">
      <table class="w-full border-collapse">
        <thead>
          <tr>
            <th class="sticky top-0 z-[3] bg-gray-50 border-b-2 border-gray-200 w-5 px-0 hidden sm:table-cell" />
            <th class="sticky top-0 z-[3] bg-gray-50 border-b-2 border-gray-200 px-3.5 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Datum</th>
            <th class="sticky top-0 z-[3] bg-gray-50 border-b-2 border-gray-200 px-3.5 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Titel</th>
            <th class="sticky top-0 z-[3] bg-gray-50 border-b-2 border-gray-200 px-3.5 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap hidden sm:table-cell">Kategori</th>
            <th class="sticky top-0 z-[3] bg-gray-50 border-b-2 border-gray-200 px-3.5 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap hidden sm:table-cell">Beskrivning</th>
            <th class="sticky top-0 z-[3] bg-gray-50 border-b-2 border-gray-200 w-10 hidden sm:table-cell" />
          </tr>
        </thead>
        <tbody>
          <template v-for="(ev, idx) in events" :key="ev.id">
            <!-- Today separator line when today has no events -->
            <tr v-if="todaySepIndex === idx" class="today-sep" style="scroll-margin-top: 40px">
              <td colspan="6" class="p-0 h-0.5 bg-accent relative">
                <span class="absolute left-2 -top-2 text-[10px] font-semibold text-accent pointer-events-none">idag</span>
              </td>
            </tr>
            <tr
              @click="emit('select', ev.id)"
              class="border-b border-gray-200 cursor-pointer transition-colors hover:bg-accent-light group"
              :class="{
                'bg-indigo-50/50': selectedId === ev.id,
                'today-row bg-accent-light': isToday(ev),
                'opacity-50': isPast(ev) && !isToday(ev),
              }"
              :style="isToday(ev) ? 'scroll-margin-top: 40px' : ''"
            >
              <!-- Arrow column -->
              <td class="w-5 px-0 text-center align-middle hidden sm:table-cell">
                <ArrowRight v-if="isToday(ev)" :size="14" class="text-accent inline-block" />
              </td>
              <td class="px-3.5 py-2.5 text-sm" :class="{ 'shadow-[inset_3px_0_0_var(--accent)]': isToday(ev) }">
                <span class="text-xs whitespace-nowrap">{{ ev.date }} {{ ev.time || '' }}</span>
              </td>
              <td class="px-3.5 py-2.5 text-sm">{{ ev.title }}</td>
              <td class="px-3.5 py-2.5 text-sm hidden sm:table-cell">
                <span v-if="ev.category" class="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium" :style="catStyle(ev.category)">{{ ev.category }}</span>
                <span v-else class="text-gray-400">—</span>
              </td>
              <td class="px-3.5 py-2.5 text-sm hidden sm:table-cell">
                <span v-if="ev.description">{{ ev.description }}</span>
                <span v-else class="text-gray-400">—</span>
              </td>
              <td class="w-10 text-center px-1 hidden sm:table-cell">
                <button class="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
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
    <!-- Floating scroll-to-today button -->
    <ScrollTodayButton :scroll-container="scrollRef" target-selector=".today-row, .today-sep" @click="scrollToToday" />
  </div>
</template>
