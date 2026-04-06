<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useStore } from '../composables/useStore'
import { useToday, localDateStr } from '../composables/useToday'
import QRCode from 'qrcode'
import type { Event } from '../types'

const { db, assignments, effectiveTasks } = useStore()
const { todayStr } = useToday()

const now = ref(new Date())
let timer: ReturnType<typeof setInterval>
onMounted(() => { timer = setInterval(() => { now.value = new Date() }, 1000) })
onUnmounted(() => clearInterval(timer))

const orgName = computed(() => db.settings?.orgName || 'Mötesplanering')

// This week's Sunday (or today if Sunday)
const thisWeekEvents = computed(() => {
  const mon = getMonday(todayStr.value)
  const sun = addDays(mon, 6)
  return db.events
    .filter(e => e.date == sun)
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
})

const nextWeekEvents = computed(() => {
  const mon = addDays(getMonday(todayStr.value), 7)
  const sun = addDays(mon, 6)
  return db.events
    .filter(e => e.date == sun)
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
})

function getMonday(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return localDateStr(d)
}
function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return localDateStr(d)
}

const dayNames = ['sön', 'mån', 'tis', 'ons', 'tor', 'fre', 'lör']
function dayLabel(dateStr: string) { return dayNames[new Date(dateStr + 'T00:00:00').getDay()] }

function eventAssignments(ev: Event) {
  const tasks = effectiveTasks(ev)
  return tasks.map(tid => {
    const task = db.tasks.find(t => t.id === tid)
    if (!task) return null
    const asgn = assignments[ev.id]?.[tid]
    let who = ''
    if (asgn?.type === 'contact') {
      who = (asgn.ids || []).map(id => db.contacts.find(c => c.id === id)?.name).filter(Boolean).join(', ')
    } else if (asgn?.type === 'team') {
      const team = db.teams.find(t => t.id === asgn.id)
      who = team ? `Team ${team.number}` : ''
    }
    return { task, who, empty: !asgn }
  }).filter(Boolean) as { task: { name: string; id: number }; who: string; empty: boolean }[]
}

// Count open slots across both weeks
const openSlots = computed(() => {
  let count = 0
  for (const ev of [...thisWeekEvents.value, ...nextWeekEvents.value]) {
    for (const tid of effectiveTasks(ev)) {
      const task = db.tasks.find(t => t.id === tid)
      if (task && !task.teamTask && !task.locked && !assignments[ev.id]?.[tid]) count++
    }
  }
  return count
})

const homeUrl = computed(() => location.origin + '/#/home')

const qrDataUrl = ref('')
onMounted(async () => {
  try {
    qrDataUrl.value = await QRCode.toDataURL(homeUrl.value, { width: 150, margin: 1, color: { dark: '#1a1a3e', light: '#ffffff' } })
  } catch {}
})

// Clock
const clockStr = computed(() => {
  const h = String(now.value.getHours()).padStart(2, '0')
  const m = String(now.value.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
})
const dateStr = computed(() => {
  const d = now.value
  const months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
  const days = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag']
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`
})

// (QR generated in onMounted above)
</script>

<template>
  <div class="dash">
    <!-- Clock -->
    <div class="dash-clock">
      <span class="dash-time">{{ clockStr }}</span>
      <span class="dash-date">{{ dateStr }}</span>
    </div>

    <div class="dash-content">
      <!-- This week -->
      <div class="dash-week">
        <h2 class="dash-week-title">Denna vecka</h2>
        <div v-for="ev in thisWeekEvents" :key="ev.id" class="dash-event">
          <div class="dash-event-header">
            <span class="dash-event-day">{{ dayLabel(ev.date) }} {{ ev.date.slice(8) }}</span>
            <span class="dash-event-time">{{ ev.time || '' }}</span>
            <span class="dash-event-title">{{ ev.title }}</span>
          </div>
          <div class="dash-assignments">
            <div v-for="a in eventAssignments(ev)" :key="a.task.id" class="dash-asgn" :class="{ 'dash-asgn-empty': a.empty }">
              <span class="dash-asgn-task">{{ a.task.name }}</span>
              <span class="dash-asgn-who">{{ a.who || '—' }}</span>
            </div>
          </div>
        </div>
        <div v-if="thisWeekEvents.length === 0" class="dash-empty">Inga händelser denna vecka</div>
      </div>

      <!-- Next week -->
      <div class="dash-week">
        <h2 class="dash-week-title">Nästa vecka</h2>
        <div v-for="ev in nextWeekEvents" :key="ev.id" class="dash-event">
          <div class="dash-event-header">
            <span class="dash-event-day">{{ dayLabel(ev.date) }} {{ ev.date.slice(8) }}</span>
            <span class="dash-event-time">{{ ev.time || '' }}</span>
            <span class="dash-event-title">{{ ev.title }}</span>
          </div>
          <div class="dash-assignments">
            <div v-for="a in eventAssignments(ev)" :key="a.task.id" class="dash-asgn" :class="{ 'dash-asgn-empty': a.empty }">
              <span class="dash-asgn-task">{{ a.task.name }}</span>
              <span class="dash-asgn-who">{{ a.who || '—' }}</span>
            </div>
          </div>
        </div>
        <div v-if="nextWeekEvents.length === 0" class="dash-empty">Inga händelser nästa vecka</div>
      </div>
    </div>

    <!-- Footer with QR -->
    <div class="dash-footer">
      <img v-if="qrDataUrl" :src="qrDataUrl" class="dash-qr" alt="QR" />
      <div class="dash-footer-text">
        <div class="dash-footer-cta">Skanna för att se ditt schema!</div>
        <div v-if="openSlots > 0" class="dash-footer-slots">{{ openSlots }} {{ openSlots === 1 ? 'ledig plats' : 'lediga platser' }} att fylla</div>
        <div class="dash-footer-org">{{ orgName }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dash {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #0f0c29 0%, #1a1a3e 50%, #24243e 100%);
  color: #fff;
  overflow: hidden;
  padding: 2vh 3vw;
  font-family: system-ui, -apple-system, sans-serif;
}

.dash-clock {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 2vh;
}
.dash-time { font-size: clamp(24px, 4vw, 48px); font-weight: 200; color: rgba(255,255,255,0.4); }
.dash-date { font-size: clamp(12px, 1.5vw, 18px); color: rgba(255,255,255,0.25); text-transform: capitalize; }

.dash-content {
  flex: 1;
  display: flex;
  gap: 3vw;
  overflow: hidden;
}

.dash-week {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
}
.dash-week-title {
  font-size: clamp(11px, 1.2vw, 14px);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,0.3);
  margin-bottom: 1.5vh;
}

.dash-event {
  margin-bottom: 2vh;
}
.dash-event-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 0.5vh;
}
.dash-event-day {
  font-size: clamp(10px, 1vw, 13px);
  color: rgba(255,255,255,0.35);
  text-transform: uppercase;
  min-width: 50px;
}
.dash-event-time {
  font-size: clamp(10px, 1vw, 13px);
  color: rgba(255,255,255,0.35);
  font-variant-numeric: tabular-nums;
}
.dash-event-title {
  font-size: clamp(14px, 1.8vw, 24px);
  font-weight: 700;
  color: rgba(255,255,255,0.9);
}

.dash-assignments {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 4px;
  padding-left: 58px;
}
.dash-asgn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
}
.dash-asgn-empty {
  border-color: rgba(231, 76, 60, 0.3);
  background: rgba(231, 76, 60, 0.06);
}
.dash-asgn-task {
  font-size: clamp(10px, 1vw, 13px);
  color: rgba(255,255,255,0.4);
  min-width: 70px;
}
.dash-asgn-who {
  font-size: clamp(11px, 1.1vw, 14px);
  font-weight: 600;
  color: rgba(255,255,255,0.8);
}
.dash-asgn-empty .dash-asgn-who {
  color: rgba(231, 76, 60, 0.6);
  font-weight: 400;
}

.dash-empty {
  font-size: 13px;
  color: rgba(255,255,255,0.15);
}

.dash-footer {
  display: flex;
  align-items: center;
  gap: 20px;
  padding-top: 2vh;
  border-top: 1px solid rgba(255,255,255,0.06);
  margin-top: auto;
}
.dash-qr { flex-shrink: 0; border-radius: 8px; width: 120px; height: 120px; }
.dash-footer-text { flex: 1; }
.dash-footer-cta {
  font-size: clamp(12px, 1.3vw, 16px);
  font-weight: 600;
  color: rgba(255,255,255,0.6);
}
.dash-footer-slots {
  font-size: clamp(11px, 1.1vw, 14px);
  color: var(--color-accent);
  margin-top: 2px;
}
.dash-footer-org {
  font-size: clamp(10px, 0.9vw, 12px);
  color: rgba(255,255,255,0.15);
  margin-top: 4px;
}
</style>
