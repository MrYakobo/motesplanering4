<script setup lang="ts">
import { computed, ref, nextTick, onMounted } from 'vue'
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
const todayDirection = ref<'above' | 'below' | 'visible'>('below')

function updateTodayVisibility() {
  const container = scrollRef.value
  if (!container) return
  const el = container.querySelector('.today-row, .today-sep') as HTMLElement
  if (!el) { todayDirection.value = 'below'; return }
  const cRect = container.getBoundingClientRect()
  const eRect = el.getBoundingClientRect()
  if (eRect.bottom < cRect.top) todayDirection.value = 'above'
  else if (eRect.top > cRect.bottom) todayDirection.value = 'below'
  else todayDirection.value = 'visible'
}

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
  const el = scrollRef.value?.querySelector('.today-row, .today-sep') as HTMLElement
  if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' })
}

onMounted(() => {
  nextTick(() => {
    if (hasScrolled.value) return
    hasScrolled.value = true
    const el = scrollRef.value?.querySelector('.today-row, .today-sep') as HTMLElement
    if (el) el.scrollIntoView({ block: 'start', behavior: 'instant' })
    scrollRef.value?.addEventListener('scroll', updateTodayVisibility)
    updateTodayVisibility()
  })
})
</script>

<template>
  <div class="flex-1 overflow-hidden flex flex-col relative">
    <div ref="scrollRef" class="flex-1 overflow-auto">
      <table class="w-full border-collapse">
        <thead>
          <tr>
            <th class="sticky top-0 z-[3] bg-gray-50 border-b-2 border-gray-200 w-5 px-0" />
            <th class="sticky top-0 z-[3] bg-gray-50 border-b-2 border-gray-200 px-3.5 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Datum</th>
            <th class="sticky top-0 z-[3] bg-gray-50 border-b-2 border-gray-200 px-3.5 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Titel</th>
            <th class="sticky top-0 z-[3] bg-gray-50 border-b-2 border-gray-200 px-3.5 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Kategori</th>
            <th class="sticky top-0 z-[3] bg-gray-50 border-b-2 border-gray-200 px-3.5 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Beskrivning</th>
            <th class="sticky top-0 z-[3] bg-gray-50 border-b-2 border-gray-200 w-10" />
          </tr>
        </thead>
        <tbody>
          <template v-for="(ev, idx) in events" :key="ev.id">
            <!-- Today separator line when today has no events -->
            <tr v-if="todaySepIndex === idx" class="today-sep">
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
              :style="isToday(ev) ? 'scroll-margin-top: 60px' : ''"
            >
              <!-- Arrow column -->
              <td class="w-5 px-0 text-center align-middle">
                <ArrowRight v-if="isToday(ev)" :size="14" class="text-accent inline-block" />
              </td>
              <td class="px-3.5 py-2.5 text-sm" :class="{ 'shadow-[inset_3px_0_0_var(--accent)]': isToday(ev) }">
                <span class="text-xs whitespace-nowrap">{{ ev.date }} {{ ev.time || '' }}</span>
              </td>
              <td class="px-3.5 py-2.5 text-sm">{{ ev.title }}</td>
              <td class="px-3.5 py-2.5 text-sm">
                <span v-if="ev.category" class="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium" :style="catStyle(ev.category)">{{ ev.category }}</span>
                <span v-else class="text-gray-400">—</span>
              </td>
              <td class="px-3.5 py-2.5 text-sm">
                <span v-if="ev.description">{{ ev.description }}</span>
                <span v-else class="text-gray-400">—</span>
              </td>
              <td class="w-10 text-center px-1">
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
    <button
      v-show="todayDirection !== 'visible'"
      @click="scrollToToday"
      class="absolute bottom-4 right-4 bg-accent text-white text-xs px-3 py-1.5 rounded-full shadow-lg cursor-pointer hover:bg-accent-hover transition-colors z-20"
    >
      {{ todayDirection === 'above' ? '↑' : '↓' }} Idag
    </button>
  </div>
</template>
