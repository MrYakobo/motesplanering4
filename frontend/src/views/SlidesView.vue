<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useStore } from '../composables/useStore'
import { useToday, localDateStr } from '../composables/useToday'
import { useFullscreen } from '../composables/useFullscreen'
import { Maximize, Minimize, Pause, Play } from 'lucide-vue-next'
import SlidesSidebar from '../components/SlidesSidebar.vue'

const { db, isAdmin, getPublicEvents } = useStore()
const { today } = useToday()
const { isFullscreen, toggle } = useFullscreen()

const dayLabels = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag']

function weekNumber(d: Date) {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

const weekEvents = computed(() => {
  const now = today.value
  const day = now.getDay()
  const mon = new Date(now)
  mon.setDate(now.getDate() - ((day + 6) % 7))
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  const monStr = localDateStr(mon)
  const sunStr = localDateStr(sun)
  return getPublicEvents()
    .filter(e => e.date >= monStr && e.date <= sunStr)
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
})

const weekNum = computed(() => {
  const now = today.value
  const day = now.getDay()
  const mon = new Date(now)
  mon.setDate(now.getDate() - ((day + 6) % 7))
  return weekNumber(mon)
})

const byDay = computed(() => {
  const groups: Record<string, typeof weekEvents.value> = {}
  weekEvents.value.forEach(ev => {
    if (!groups[ev.date]) groups[ev.date] = []
    groups[ev.date].push(ev)
  })
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
})

function dayLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const name = dayLabels[d.getDay()]
  return name.charAt(0).toUpperCase() + name.slice(1)
}

// ── Promo slides ─────────────────────────────────────────────────────────────
const promoUrls = computed(() => {
  const eventPromos = weekEvents.value.flatMap(e => (e.promoSlides || []).filter(Boolean))
  const globalPromos = (db.globalSlides || []).filter(s => s.active).map(s => s.url)
  return [...eventPromos, ...globalPromos]
})

const totalSlides = computed(() => 1 + promoUrls.value.length)
const hasMultiple = computed(() => totalSlides.value > 1)

// ── Slideshow state ──────────────────────────────────────────────────────────
function slideDuration(idx: number): number {
  if (idx === 0) {
    return Math.min(20, Math.max(10, 10 + (byDay.value.length - 3) * 2.5)) * 1000
  }
  return 10000
}

const slideIndex = ref(0)
const paused = ref(false)
const animating = ref(false)
let advanceTimer: ReturnType<typeof setTimeout> | null = null

function currentDuration(): number {
  return slideDuration(slideIndex.value)
}

function scheduleAdvance() {
  cancelAdvance()
  if (paused.value || totalSlides.value <= 1) return
  // Reset: set animating false, then on next frame start the CSS transition
  animating.value = false
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      animating.value = true
      advanceTimer = setTimeout(() => {
        slideIndex.value = (slideIndex.value + 1) % totalSlides.value
        scheduleAdvance()
      }, currentDuration())
    })
  })
}

function cancelAdvance() {
  if (advanceTimer) { clearTimeout(advanceTimer); advanceTimer = null }
  animating.value = false
}

function goToSlide(idx: number) {
  slideIndex.value = idx
  scheduleAdvance()
}

function nextSlide() {
  if (totalSlides.value <= 1) return
  goToSlide((slideIndex.value + 1) % totalSlides.value)
}

function prevSlide() {
  if (totalSlides.value <= 1) return
  goToSlide((slideIndex.value - 1 + totalSlides.value) % totalSlides.value)
}

function togglePause() {
  paused.value = !paused.value
  if (paused.value) {
    cancelAdvance()
  } else {
    scheduleAdvance()
  }
}

// Reset when slides change
watch(totalSlides, () => { slideIndex.value = 0; scheduleAdvance() })

function onKeydown(e: KeyboardEvent) {
  if ((e.target as HTMLElement)?.closest('input,textarea,select')) return
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); nextSlide() }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); prevSlide() }
  if (e.key === ' ') { e.preventDefault(); togglePause() }
}

onMounted(() => { scheduleAdvance(); window.addEventListener('keydown', onKeydown) })
onUnmounted(() => { cancelAdvance(); window.removeEventListener('keydown', onKeydown) })

// ── Clock ────────────────────────────────────────────────────────────────────
const clockText = ref('')
let clockTimer: ReturnType<typeof setInterval> | null = null

function updateClock() {
  const now = new Date()
  clockText.value = now.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
}

onMounted(() => { updateClock(); clockTimer = setInterval(updateClock, 10000) })
onUnmounted(() => { if (clockTimer) clearInterval(clockTimer) })
</script>

<template>
  <div class="flex flex-1 overflow-hidden">
    <div
      class="slide-area"
      :style="{
        background: db.slideBackground?.image
          ? `url(${db.slideBackground.image}) center/cover no-repeat`
          : (db.slideBackground?.color || '#111'),
      }"
    >
      <!-- Progress bar -->
      <div
        v-if="hasMultiple"
        class="slide-progress-bar"
        :class="{ animating }"
        :style="{ transitionDuration: animating ? currentDuration() + 'ms' : '0ms' }"
      />

      <!-- Fullscreen toggle -->
      <button
        @click="toggle"
        class="absolute top-[2vh] right-[2vw] p-1.5 rounded-md bg-white/10 text-white/50 hover:text-white hover:bg-white/20 border-none cursor-pointer transition-colors z-10"
        :title="isFullscreen ? 'Avsluta fullskärm (Esc)' : 'Fullskärm (F)'"
      >
        <component :is="isFullscreen ? Minimize : Maximize" :size="16" />
      </button>

      <!-- Slide 0: Week overview -->
      <div class="slide-panel" :class="{ active: slideIndex === 0 }">
        <div class="slide-week">
          <div class="slide-week-header">
            <h2>Händer i veckan (v{{ weekNum }})</h2>
          </div>
          <div class="slide-columns">
            <div v-if="byDay.length === 0" class="flex-1 flex items-center justify-center text-[clamp(14px,1.5vw,24px)] text-gray-500">
              Inga händelser denna vecka
            </div>
            <div v-for="([date, events], colIdx) in byDay" :key="date" class="slide-col">
              <div class="slide-col-day">{{ dayLabel(date) }}</div>
              <div class="slide-col-events">
                <div
                  v-for="(ev, evIdx) in events" :key="ev.id"
                  class="slide-ev"
                  :style="{ animationDelay: `${(colIdx * 0.15 + evIdx * 0.08).toFixed(2)}s` }"
                >
                  <div class="slide-ev-title">{{ ev.title }}</div>
                  <div class="slide-ev-meta">{{ ev.category || '' }} · {{ ev.time || '' }}</div>
                </div>
              </div>
            </div>
          </div>
          <div class="slide-footer">
            <div class="slide-clock">{{ clockText }}</div>
            <span class="flex-1" />
            <img v-if="db.slideLogo" :src="db.slideLogo" class="h-[clamp(24px,3vw,48px)] w-auto opacity-80" />
          </div>
        </div>
      </div>

      <!-- Promo slides -->
      <div
        v-for="(url, i) in promoUrls" :key="'promo-' + i"
        class="slide-panel flex items-center justify-center"
        :class="{ active: slideIndex === i + 1 }"
      >
        <img :src="url" class="max-w-full max-h-full object-contain" alt="Promo" />
      </div>

      <!-- Controls -->
      <div v-if="hasMultiple" class="slide-controls">
        <button
          v-for="i in totalSlides" :key="i"
          @click="goToSlide(i - 1)"
          class="slide-dot"
          :class="{ active: slideIndex === i - 1 }"
        />
        <button
          @click="togglePause"
          class="slide-pause"
        >
          <component :is="paused ? Play : Pause" :size="16" />
        </button>
      </div>
    </div>

    <!-- Sidebar (admin only, not in fullscreen) -->
    <SlidesSidebar v-if="isAdmin && !isFullscreen" />
  </div>
</template>

<style scoped>
.slide-area {
  flex: 1;
  color: #e5e5e5;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}
.slide-panel {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.6s ease;
}
.slide-panel.active {
  opacity: 1;
  pointer-events: auto;
}
.slide-week {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}
.slide-week-header {
  padding: 2.5vh 3vw 0;
  flex-shrink: 0;
  text-align: center;
  margin-bottom: 40px;
}
.slide-week-header h2 {
  font-size: clamp(24px, 3.5vw, 56px);
  font-weight: 800;
  color: #fff;
  margin: 0;
  letter-spacing: -0.01em;
}
.slide-columns {
  display: flex;
  flex: 1;
  padding: 0 2vw 2vh;
  gap: 1.5vw;
  overflow: hidden;
}
.slide-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}
.slide-col-day {
  font-size: clamp(16px, 2.2vw, 36px);
  font-weight: 700;
  color: #fff;
  padding-bottom: 0.5vh;
  border-bottom: 2px solid #444;
  margin-bottom: 1.5vh;
}
.slide-col-events {
  display: flex;
  flex-direction: column;
  gap: 1.2vh;
}
.slide-ev {
  animation: slideEvIn 0.5s ease both;
}
.slide-ev-title {
  font-size: clamp(14px, 1.8vw, 30px);
  font-weight: 700;
  color: #e5e5e5;
  line-height: 1.15;
  overflow-wrap: break-word;
  word-break: break-word;
  hyphens: auto;
}
.slide-ev-meta {
  font-size: clamp(11px, 1.1vw, 20px);
  color: #777;
  margin-top: 0.2vh;
}
.slide-footer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 1.5vh 3vw;
}
.slide-clock {
  color: #fff;
  font-size: clamp(20px, 2.5vw, 42px);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
@keyframes slideEvIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
.slide-controls {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 6px;
  align-items: center;
  z-index: 2;
}
.slide-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255,255,255,.2);
  cursor: pointer;
  border: none;
  padding: 0;
  transition: all .2s;
}
.slide-dot.active {
  background: #fff;
  width: 20px;
  border-radius: 4px;
}
.slide-pause {
  background: none;
  border: none;
  color: rgba(255,255,255,.3);
  cursor: pointer;
  margin-left: 8px;
  display: inline-flex;
  align-items: center;
}
.slide-pause:hover { color: #fff; }
.slide-progress-bar {
  position: absolute;
  top: 0;
  left: 0;
  height: 3px;
  width: 0;
  background: rgba(255,255,255,.5);
  z-index: 3;
  transition: none;
}
.slide-progress-bar.animating {
  width: 100%;
  transition: width linear;
}
</style>
