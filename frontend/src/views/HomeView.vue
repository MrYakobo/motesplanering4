<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useStore } from '../composables/useStore'
import { useToday } from '../composables/useToday'
import { useCategories } from '../composables/useCategories'
import { useNotifications } from '../composables/useNotifications'
import LoginModal from '../components/LoginModal.vue'
import { LogIn, Calendar, Users, ClipboardList, Clock, AlertTriangle } from 'lucide-vue-next'

const { db, isViewer } = useStore()
const { todayStr } = useToday()
const { catStyle } = useCategories()
const { allNotifications } = useNotifications()
const orgName = () => db.settings?.orgName || 'Mötesplanering'

const showLogin = ref(false)
const loginEmail = ref('')
const loginSent = ref(false)
const loginSending = ref(false)
const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => { timer = setInterval(() => { now.value = new Date() }, 1000) })
onUnmounted(() => { clearInterval(timer) })

function onLoginSuccess() {
  showLogin.value = false
  location.reload()
}

function checkForAdmin() {
  if (loginEmail.value == "admin") {
    showLogin.value = true
  }
}

async function requestMagicLink() {
  if (!loginEmail.value.trim()) return

  loginSending.value = true
  try {
    await fetch('/api/request-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: loginEmail.value.trim() }),
    })
    loginSent.value = true
  } catch {}
  loginSending.value = false
}

// Events happening today
const todayEvents = computed(() =>
  db.events
    .filter(e => e.date === todayStr.value)
    .sort((a, b) => a.time.localeCompare(b.time))
)

// Next upcoming event (today with future time, or future date)
const nextEvent = computed(() => {
  const t = todayStr.value
  const nowTime = `${String(now.value.getHours()).padStart(2, '0')}:${String(now.value.getMinutes()).padStart(2, '0')}`
  // First check today's events that haven't started yet
  const todayFuture = db.events
    .filter(e => e.date === t && e.time > nowTime)
    .sort((a, b) => a.time.localeCompare(b.time))
  if (todayFuture.length) return todayFuture[0]
  // Then check future dates
  const future = db.events
    .filter(e => e.date > t)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
  return future.length ? future[0] : null
})

// Countdown to next event
const countdown = computed(() => {
  const ev = nextEvent.value
  if (!ev) return null
  const eventDate = new Date(`${ev.date}T${ev.time || '00:00'}:00`)
  const diff = eventDate.getTime() - now.value.getTime()
  if (diff <= 0) return null
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)
  return { days, hours, minutes, seconds }
})

function fmtTime(t: string) {
  return t ? t.slice(0, 5) : ''
}
</script>

<template>
  <div class="landing">
    <div class="landing-card">
      <div class="logo-badge">
        <Calendar :size="32" stroke-width="1.5" />
      </div>
      <h1>{{ orgName() }}</h1>
      <p class="subtitle">Schemaläggning &amp; volontärhantering</p>

      <template v-if="false">
      <!-- Happening today -->
      <div v-if="todayEvents.length" class="section">
        <div class="section-header">
          <Calendar :size="14" />
          <span>Idag</span>
        </div>
        <div class="today-list">
          <div v-for="ev in todayEvents" :key="ev.id" class="today-item">
            <span class="ev-time">{{ fmtTime(ev.time) }}</span>
            <span class="ev-title">{{ ev.title }}</span>
            <span class="ev-cat" :style="catStyle(ev.category)">{{ ev.category }}</span>
          </div>
        </div>
      </div>
      <div v-else class="section">
        <div class="section-header">
          <Calendar :size="14" />
          <span>Idag</span>
        </div>
        <p class="empty-msg">Inga händelser idag</p>
      </div>
      </template>

      <!-- Countdown to next event -->
      <div v-if="nextEvent && countdown" class="section">
        <div class="section-header">
          <Clock :size="14" />
          <span>Nästa händelse</span>
        </div>
        <div class="next-event-card">
          <div class="next-event-info">
            <span class="next-event-title">{{ nextEvent.title }}</span>
            <span class="next-event-meta">
              {{ nextEvent.date }} · {{ fmtTime(nextEvent.time) }}
            </span>
          </div>
          <div class="countdown">
            <div v-if="countdown.days" class="cd-unit">
              <span class="cd-num">{{ countdown.days }}</span>
              <span class="cd-label">d</span>
            </div>
            <div class="cd-unit">
              <span class="cd-num">{{ String(countdown.hours).padStart(2, '0') }}</span>
              <span class="cd-label">h</span>
            </div>
            <div class="cd-unit">
              <span class="cd-num">{{ String(countdown.minutes).padStart(2, '0') }}</span>
              <span class="cd-label">m</span>
            </div>
            <div class="cd-unit">
              <span class="cd-num">{{ String(countdown.seconds).padStart(2, '0') }}</span>
              <span class="cd-label">s</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Notifications -->
      <div v-if="allNotifications.length > 0" class="section">
        <div class="section-header" style="color: #e74c3c;">
          <AlertTriangle :size="14" />
          <span>Saknas denna vecka</span>
        </div>
        <div class="notif-list">
          <div v-for="(n, i) in allNotifications" :key="i" class="notif-item" :class="{ 'notif-late': n.type === 'late-withdrawal' }">
            <span class="notif-msg">{{ n.message }}</span>
          </div>
        </div>
      </div>

      <div class="features" v-if="allNotifications.length != 0">
        <div class="feature">
          <Calendar :size="18" />
          <span>Händelser &amp; kalender</span>
        </div>
        <div class="feature">
          <Users :size="18" />
          <span>Team &amp; volontärer</span>
        </div>
        <div class="feature">
          <ClipboardList :size="18" />
          <span>Schema &amp; påminnelser</span>
        </div>
      </div>

      <!-- Login section for viewers -->
      <div v-if="isViewer" class="section">
        <div v-if="!loginSent" class="login-card">
          <p class="login-desc text-black">Ange din e-post för att logga in och se ditt schema</p>
          <form @submit.prevent="requestMagicLink" class="login-form">
            <input @input="checkForAdmin" v-model="loginEmail" type="email" placeholder="din@email.se" class="login-input" required />
            <button type="submit" :disabled="loginSending" class="login-btn">
              <LogIn :size="14" />
              {{ loginSending ? 'Skickar...' : 'Skicka inloggningslänk' }}
            </button>
          </form>
          <button @click="showLogin = true" class="login-admin-link">Admin-inloggning</button>
        </div>
        <div v-else class="login-card login-sent">
          <p class="login-sent-msg">Kolla din inkorg!</p>
          <p class="login-sent-sub">Vi har skickat en inloggningslänk till <strong>{{ loginEmail }}</strong>.<br><br>Klicka på länken i mailet för att logga in.</p>
          <button @click="loginSent = false; loginEmail = ''" class="login-admin-link">Försök igen</button>
        </div>
      </div>
    </div>

    <LoginModal :open="showLogin" @close="showLogin = false" @success="onLoginSuccess" />
  </div>
</template>

<style scoped>
.landing {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #c4ccd8 0%, #a8b5c5 4%, #8a9bb0 100%);
  padding: 24px;
  overflow-y: auto;
}

.landing-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 400px;
  width: 100%;
  padding: 40px 32px 36px;
  border-radius: 16px;
  background: linear-gradient(180deg, #f7f7f7 0%, #e8e8e8 100%);
  border: 1px solid #fff;
  box-shadow:
    0 1px 0 rgba(255,255,255,.6) inset,
    0 4px 16px rgba(0,0,0,.25),
    0 1px 3px rgba(0,0,0,.15);
}

.logo-badge {
  width: 72px; height: 72px; border-radius: 18px;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 20px; color: #fff;
  background: linear-gradient(180deg, #6a5aed 0%, #3b2fba 100%);
  border: 1px solid rgba(255,255,255,.25);
  box-shadow:
    0 1px 0 rgba(255,255,255,.4) inset,
    0 -1px 2px rgba(0,0,0,.15) inset,
    0 4px 12px rgba(59,47,186,.4),
    0 1px 2px rgba(0,0,0,.2);
}

h1 {
  font-size: 26px; font-weight: 700; color: #2a2a2a;
  margin: 0 0 4px;
  text-shadow: 0 1px 0 rgba(255,255,255,.8);
}

.subtitle {
  font-size: 13px; color: #777; margin: 0 0 24px;
  text-shadow: 0 1px 0 rgba(255,255,255,.6);
}

/* ── Sections ─────────────────────────────────────────────────────────────── */
.section {
  width: 100%;
  margin-bottom: 16px;
  text-align: left;
}

.section-header {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 600; color: #888;
  text-transform: uppercase; letter-spacing: 0.5px;
  margin-bottom: 8px;
  text-shadow: 0 1px 0 rgba(255,255,255,.6);
}

.empty-msg {
  font-size: 12px; color: #999; margin: 0;
  padding: 8px 12px;
  border-radius: 6px;
  background: rgba(0,0,0,.03);
  text-align: center;
}

/* ── Today events ─────────────────────────────────────────────────────────── */
.today-list {
  display: flex; flex-direction: column; gap: 4px;
}

.today-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; border-radius: 6px;
  background: linear-gradient(180deg, #fff 0%, #f4f4f4 100%);
  border: 1px solid #d0d0d0;
  box-shadow: 0 1px 0 rgba(255,255,255,.7) inset, 0 1px 2px rgba(0,0,0,.06);
}

.ev-time {
  font-size: 12px; font-weight: 600; color: #555;
  font-variant-numeric: tabular-nums;
  min-width: 38px;
}

.ev-title {
  font-size: 12px; color: #333; flex: 1;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  text-align: left;
}

.ev-cat {
  font-size: 10px; font-weight: 600;
  padding: 2px 7px; border-radius: 4px;
  white-space: nowrap;
}

/* ── Next event + countdown ───────────────────────────────────────────────── */
.next-event-card {
  padding: 12px;
  border-radius: 8px;
  background: linear-gradient(180deg, #fff 0%, #f0f0f0 100%);
  border: 1px solid #d0d0d0;
  box-shadow: 0 1px 0 rgba(255,255,255,.7) inset, 0 1px 2px rgba(0,0,0,.06);
}

.next-event-info {
  display: flex; flex-direction: column; gap: 2px;
  margin-bottom: 10px;
}

.next-event-title {
  font-size: 13px; font-weight: 600; color: #333;
}

.next-event-meta {
  font-size: 11px; color: #888;
}

.countdown {
  display: flex; justify-content: center; gap: 6px;
}

.cd-unit {
  display: flex; align-items: baseline; gap: 1px;
  padding: 4px 8px;
  border-radius: 6px;
  background: linear-gradient(180deg, #e8e4ff 0%, #d8d2f8 100%);
  border: 1px solid #c4bce8;
  box-shadow: 0 1px 0 rgba(255,255,255,.5) inset;
}

.cd-num {
  font-size: 18px; font-weight: 700; color: #4a3cc9;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.cd-label {
  font-size: 10px; font-weight: 600; color: #7c6fd4;
}

/* ── Features ─────────────────────────────────────────────────────────────── */
.features {
  display: flex; flex-direction: column; gap: 10px;
  width: 100%; margin-bottom: 28px;
}

.feature {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; border-radius: 8px;
  font-size: 13px; color: #444;
  background: linear-gradient(180deg, #fff 0%, #f0f0f0 100%);
  border: 1px solid #d0d0d0;
  box-shadow: 0 1px 0 rgba(255,255,255,.7) inset, 0 1px 2px rgba(0,0,0,.08);
  text-shadow: 0 1px 0 rgba(255,255,255,.8);
}

.feature svg { color: #5b4fc7; flex-shrink: 0; }

.login-btn {
  text-align: center;
  justify-content: center;
  display: flex; align-items: center; gap: 8px;
  padding: 10px 28px; border-radius: 8px;
  font-size: 14px; font-weight: 600; color: #fff;
  cursor: pointer; border: 1px solid rgba(0,0,0,.2);
  background: linear-gradient(180deg, #6a5aed 0%, #4a3cc9 100%);
  box-shadow:
    0 1px 0 rgba(255,255,255,.25) inset,
    0 2px 6px rgba(59,47,186,.35),
    0 1px 2px rgba(0,0,0,.15);
  text-shadow: 0 -1px 0 rgba(0,0,0,.2);
  transition: all 0.15s ease;
}
.login-btn:hover {
  background: linear-gradient(180deg, #7b6cf5 0%, #5544d4 100%);
  box-shadow: 0 1px 0 rgba(255,255,255,.3) inset, 0 3px 10px rgba(59,47,186,.45), 0 1px 2px rgba(0,0,0,.2);
}
.login-btn:active {
  background: linear-gradient(180deg, #4a3cc9 0%, #3b2fba 100%);
  box-shadow: 0 1px 3px rgba(0,0,0,.2) inset, 0 1px 2px rgba(0,0,0,.1);
}

.notif-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.notif-item {
  font-size: 12px;
  color: rgba(255,255,255,.7);
  padding: 6px 10px;
  border-radius: 6px;
  background: rgba(231, 76, 60, 0.1);
  border: 1px solid rgba(231, 76, 60, 0.2);
}
.notif-late {
  background: rgba(243, 156, 18, 0.1);
  border-color: rgba(243, 156, 18, 0.2);
}

.login-card {
  padding: 16px;
  border-radius: 10px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
}
.login-desc {
  font-size: 13px;
  color: #222;
  margin-bottom: 12px;
}
.login-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.login-input {
width: 100%;
  font-size: 13px;
  padding: 6px 8px;
    padding-top: 6px;
    padding-right: 8px;
    padding-bottom: 6px;
    padding-left: 8px;
  border-radius: 5px;
    border-top-left-radius: 5px;
    border-top-right-radius: 5px;
    border-bottom-right-radius: 5px;
    border-bottom-left-radius: 5px;
  color: #333;
  outline: none;
  background: linear-gradient(180deg, #e8e8e8 0%, #fff 3px);
  border: 1px solid #bbb;
    border-top-width: 1px;
    border-top-style: solid;
    border-top-color: rgb(187, 187, 187);
    border-right-width: 1px;
    border-right-style: solid;
    border-right-color: rgb(187, 187, 187);
    border-bottom-width: 1px;
    border-bottom-style: solid;
    border-bottom-color: rgb(187, 187, 187);
    border-left-width: 1px;
    border-left-style: solid;
    border-left-color: rgb(187, 187, 187);
    border-image-outset: 0;
    border-image-repeat: stretch;
    border-image-slice: 100%;
    border-image-source: none;
    border-image-width: 1;
  box-shadow: 0 1px 2px rgba(0,0,0,.04) inset;
}
.login-input:focus { border-color: var(--color-accent); }
.login-input::placeholder { color: rgba(255,255,255,0.25); }
.login-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  color: #fff;
  background: var(--color-accent);
  white-space: nowrap;
  transition: background 0.15s ease;
}
.login-btn:hover { background: var(--color-accent-hover); }
.login-btn:disabled { opacity: 0.5; cursor: default; }
.login-admin-link {
  display: block;
  margin-top: 10px;
  font-size: 11px;
  color: rgba(255,255,255,0.3);
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: underline;
}
.login-admin-link:hover { color: rgba(255,255,255,0.5); }
.login-sent { text-align: center; }
.login-sent-msg { font-size: 18px; margin-bottom: 6px; }
.login-sent-sub { font-size: 12px; }
</style>
