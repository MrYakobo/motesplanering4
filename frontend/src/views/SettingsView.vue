<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useStore } from '../composables/useStore'
import { useApi } from '../composables/useApi'
import { useToast } from '../composables/useToast'
import { ArrowLeft } from 'lucide-vue-next'
import type { CronJob } from '../types'

const router = useRouter()
const { db, persist, isAdmin } = useStore()
const api = useApi()
const { show: toast } = useToast()

if (!isAdmin.value) router.replace('/events')

const DEFAULT_CRON_JOBS: CronJob[] = [
  { id: 'reminders_6d', name: 'Påminnelser (6 dagar)', schedule: '0 9 * * *', action: 'reminders', daysAhead: 6, enabled: true },
  { id: 'mailchats_6d', name: 'Mailchats (6 dagar)', schedule: '5 9 * * *', action: 'mailchats', daysAhead: 6, enabled: true },
  { id: 'reminders_1d', name: 'Påminnelser (1 dag)', schedule: '0 18 * * *', action: 'reminders', daysAhead: 1, enabled: true },
  { id: 'backup', name: 'Daglig backup', schedule: '0 2 * * *', action: 'backup', enabled: true },
  { id: 'publish', name: 'Publicera månadsblad', schedule: '0 * * * *', action: 'publish', enabled: false },
]

const ACCENT_COLORS = [
  { id: 'indigo', color: '#4f46e5', label: 'Indigo' },
  { id: 'purple', color: '#7c3aed', label: 'Lila' },
  { id: 'blue', color: '#2563eb', label: 'Blå' },
  { id: 'teal', color: '#0d9488', label: 'Teal' },
  { id: 'green', color: '#16a34a', label: 'Grön' },
  { id: 'amber', color: '#d97706', label: 'Amber' },
  { id: 'red', color: '#dc2626', label: 'Röd' },
  { id: 'pink', color: '#db2777', label: 'Rosa' },
  { id: 'slate', color: '#475569', label: 'Grå' },
]

const THEME_MAP: Record<string, { color: string; hover: string; light: string; mid: string }> = {
  indigo: { color: '#4f46e5', hover: '#4338ca', light: '#ede9fe', mid: '#a78bfa' },
  purple: { color: '#7c3aed', hover: '#6d28d9', light: '#f5f3ff', mid: '#c4b5fd' },
  blue:   { color: '#2563eb', hover: '#1d4ed8', light: '#dbeafe', mid: '#93c5fd' },
  teal:   { color: '#0d9488', hover: '#0f766e', light: '#ccfbf1', mid: '#5eead4' },
  green:  { color: '#16a34a', hover: '#15803d', light: '#dcfce7', mid: '#86efac' },
  amber:  { color: '#d97706', hover: '#b45309', light: '#fef3c7', mid: '#fcd34d' },
  red:    { color: '#dc2626', hover: '#b91c1c', light: '#fee2e2', mid: '#fca5a5' },
  pink:   { color: '#db2777', hover: '#be185d', light: '#fce7f3', mid: '#f9a8d4' },
  slate:  { color: '#475569', hover: '#334155', light: '#f1f5f9', mid: '#94a3b8' },
}

const s = db.settings || {} as any
const smtp = s.smtp || {} as any
const sftp = s.sftp || {} as any

const form = reactive({
  orgName: s.orgName || '',
  orgLogo: s.orgLogo || '',
  baseUrl: s.baseUrl || '',
  smtpHost: smtp.host || '',
  smtpPort: smtp.port || 587,
  smtpUser: smtp.user || '',
  smtpPass: smtp.pass || '',
  smtpFrom: smtp.from || '',
  smtpSecure: smtp.secure || false,
  sftpHost: sftp.host || '',
  sftpPort: sftp.port || 22,
  sftpUser: sftp.username || '',
  sftpKey: sftp.privateKey || '',
  sftpPath: sftp.remotePath || '/var/www/html/calendar.html',
})

const cronJobs = ref<CronJob[]>(JSON.parse(JSON.stringify(s.cronJobs || DEFAULT_CRON_JOBS)))
const sftpKeyStatus = ref(sftp.privateKey ? `✓ Nyckel laddad (${sftp.privateKey.length} tecken)` : 'Ingen nyckel')
const tokenCount = computed(() => {
  const withToken = (db.contacts || []).filter((c: any) => c.token).length
  return `${withToken} av ${db.contacts.length}`
})

const currentAccent = computed(() => db.settings?.accentColor || 'indigo')

function applyTheme(id: string) {
  const t = THEME_MAP[id] || THEME_MAP.indigo
  document.documentElement.style.setProperty('--accent', t.color)
  document.documentElement.style.setProperty('--accent-hover', t.hover)
  document.documentElement.style.setProperty('--accent-light', t.light)
  document.documentElement.style.setProperty('--accent-mid', t.mid)
}

async function setAccentColor(id: string) {
  if (!db.settings) db.settings = {} as any
  db.settings.accentColor = id
  applyTheme(id)
  await persist('settings')
}

function onSftpKeyFile(e: globalThis.Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => { form.sftpKey = reader.result as string; sftpKeyStatus.value = `✓ ${file.name}` }
  reader.readAsText(file)
}

async function generateTokens() {
  try {
    const res = await fetch('/api/generate-tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(api.authHeader.value ? { Authorization: api.authHeader.value } : {}) },
    })
    const data = await res.json()
    if (data.ok) toast(`${data.generated} nya tokens genererade`)
    else toast('Kunde inte generera tokens', 'error')
  } catch (err: any) { toast('Fel: ' + err.message, 'error') }
}

async function runCronJob(jobId: string) {
  try {
    const res = await fetch('/api/cron/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(api.authHeader.value ? { Authorization: api.authHeader.value } : {}) },
      body: JSON.stringify({ jobId }),
    })
    const data = await res.json()
    if (data.ok) toast(`${data.job}: ${data.sent || 0} skickade`)
    else toast('Fel: ' + (data.error || 'okänt'), 'error')
  } catch (err: any) { toast('Fel: ' + err.message, 'error') }
}

function describeCron(expr: string): string {
  const parts = (expr || '').split(' ')
  if (parts.length < 5) return ''
  const [min, hour] = parts
  if (hour === '*') return `varje timme vid :${min.padStart(2, '0')}`
  if (min === '*') return 'varje minut'
  return `kl ${hour.padStart(2, '0')}:${min.padStart(2, '0')} dagligen`
}

async function save() {
  if (!db.settings) db.settings = {} as any
  db.settings.orgName = form.orgName
  db.settings.orgLogo = form.orgLogo
  db.settings.baseUrl = form.baseUrl.replace(/\/+$/, '')
  db.settings.smtp = { host: form.smtpHost, port: form.smtpPort, user: form.smtpUser, pass: form.smtpPass, from: form.smtpFrom, secure: form.smtpSecure }
  db.settings.sftp = { host: form.sftpHost, port: form.sftpPort, username: form.sftpUser, privateKey: form.sftpKey, remotePath: form.sftpPath }
  db.settings.cronJobs = cronJobs.value
  await persist('settings')
  fetch('/api/cron/reload', { method: 'POST', headers: { ...(api.authHeader.value ? { Authorization: api.authHeader.value } : {}) } }).catch(() => {})
  toast('Inställningar sparade')
  router.back()
}
</script>

<template>
  <div class="flex-1 overflow-y-auto bg-gray-50">
    <div class="max-w-xl mx-auto py-6 px-4">
      <!-- Header -->
      <div class="flex items-center gap-3 mb-6">
        <button @click="router.back()" class="p-1.5 rounded-md hover:bg-gray-200 transition-colors cursor-pointer bg-transparent border-none">
          <ArrowLeft :size="18" class="text-gray-500" />
        </button>
        <h2 class="text-lg font-semibold">Inställningar</h2>
      </div>

      <!-- Theme -->
      <section class="card">
        <h3 class="section-title">Tema</h3>
        <div class="flex gap-2 flex-wrap">
          <button
            v-for="c in ACCENT_COLORS" :key="c.id"
            @click="setAccentColor(c.id)"
            :title="c.label"
            class="w-8 h-8 rounded-full border-2 cursor-pointer p-0 transition-all"
            :style="{ background: c.color, borderColor: currentAccent === c.id ? '#fff' : 'transparent', boxShadow: currentAccent === c.id ? '0 0 0 2px ' + c.color : 'none' }"
          />
        </div>
      </section>

      <!-- Organisation -->
      <section class="card">
        <h3 class="section-title">Organisation</h3>
        <div class="field"><label>Namn</label><input v-model="form.orgName" placeholder="T.ex. Exempelkyrkan" /></div>
        <div class="field"><label>Logotyp-URL</label><input v-model="form.orgLogo" placeholder="https://..." /></div>
        <div class="field"><label>Bas-URL</label><input v-model="form.baseUrl" placeholder="https://schema.example.com" /></div>
      </section>

      <!-- Member tokens -->
      <section class="card">
        <h3 class="section-title">Medlemslänkar</h3>
        <p class="text-xs text-gray-500 mb-2">Generera personliga inloggningslänkar för alla kontakter.</p>
        <div class="flex items-center gap-2">
          <button @click="generateTokens" class="btn-ghost">Generera saknade tokens</button>
          <span class="text-[11px] text-gray-500">{{ tokenCount }} har token</span>
        </div>
      </section>

      <!-- SMTP -->
      <section class="card">
        <h3 class="section-title">SMTP (e-post)</h3>
        <div class="field"><label>Host</label><input v-model="form.smtpHost" /></div>
        <div class="grid grid-cols-2 gap-3">
          <div class="field"><label>Port</label><input v-model.number="form.smtpPort" type="number" /></div>
          <div class="field flex items-end pb-3">
            <label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input v-model="form.smtpSecure" type="checkbox" class="accent-accent" /> Secure (TLS)
            </label>
          </div>
        </div>
        <div class="field"><label>Användare</label><input v-model="form.smtpUser" /></div>
        <div class="field"><label>Lösenord</label><input v-model="form.smtpPass" type="password" /></div>
        <div class="field"><label>Från-adress</label><input v-model="form.smtpFrom" /></div>
      </section>

      <!-- SFTP -->
      <section class="card">
        <h3 class="section-title">SFTP (publicering)</h3>
        <div class="field"><label>Host</label><input v-model="form.sftpHost" /></div>
        <div class="grid grid-cols-2 gap-3">
          <div class="field"><label>Port</label><input v-model.number="form.sftpPort" type="number" /></div>
          <div class="field"><label>Användare</label><input v-model="form.sftpUser" /></div>
        </div>
        <div class="field">
          <label>Privat nyckel</label>
          <div class="flex items-center gap-2 mt-1">
            <span class="text-xs" :class="form.sftpKey ? 'text-emerald-700' : 'text-gray-400'">{{ sftpKeyStatus }}</span>
            <label class="btn-ghost text-[11px] cursor-pointer">{{ form.sftpKey ? 'Byt' : 'Ladda upp' }}<input type="file" class="hidden" @change="onSftpKeyFile" /></label>
            <button v-if="form.sftpKey" @click="form.sftpKey = ''; sftpKeyStatus = 'Ingen nyckel'" class="btn-ghost text-[11px]">Ta bort</button>
          </div>
        </div>
        <div class="field"><label>Fjärrsökväg</label><input v-model="form.sftpPath" /></div>
      </section>

      <!-- Cron -->
      <section class="card">
        <h3 class="section-title">Schemalagda jobb</h3>
        <div class="space-y-2">
          <div v-for="job in cronJobs" :key="job.id" class="bg-gray-50 border border-gray-200 rounded-md p-3">
            <div class="flex items-center gap-2 mb-1.5">
              <input v-model="job.enabled" type="checkbox" class="accent-accent" />
              <span class="text-[13px] font-semibold text-gray-700 flex-1">{{ job.name }}</span>
              <button @click="runCronJob(job.id)" class="btn-ghost text-[11px]">▶ Kör nu</button>
            </div>
            <div class="flex items-center gap-2">
              <input v-model="job.schedule" class="border border-gray-300 rounded px-1.5 py-0.5 text-xs font-mono w-28" />
              <span class="text-[10px] text-gray-400">{{ describeCron(job.schedule) }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Save -->
      <div class="flex gap-3 mt-6 pb-8">
        <button @click="save" class="bg-accent text-white rounded-md px-5 py-2 text-sm cursor-pointer hover:bg-accent-hover transition-colors border-none">Spara</button>
        <button @click="router.back()" class="border border-gray-300 text-gray-700 rounded-md px-5 py-2 text-sm cursor-pointer hover:bg-gray-50 transition-colors">Avbryt</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference "../style.css";
.card { @apply bg-white border border-gray-200 rounded-lg p-4 mb-4; }
.section-title { @apply text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3; }
.field { @apply mb-3; }
.field label { @apply block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1; }
.field input { @apply w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/10 bg-white; }
.btn-ghost { @apply bg-transparent border border-gray-300 rounded-md px-3 py-1 text-xs text-gray-600 cursor-pointer hover:bg-gray-50 transition-colors; }
</style>
