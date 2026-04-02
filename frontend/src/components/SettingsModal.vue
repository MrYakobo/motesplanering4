<script setup lang="ts">
import { reactive, ref, watch, computed } from 'vue'
import { useStore } from '../composables/useStore'
import { useApi } from '../composables/useApi'
import { useToast } from '../composables/useToast'
import RecordModal from './RecordModal.vue'
import type { CronJob } from '../types'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { db, persist } = useStore()
const api = useApi()
const { show: toast } = useToast()

const DEFAULT_CRON_JOBS: CronJob[] = [
  { id: 'reminders_6d', name: 'Påminnelser (6 dagar)', schedule: '0 9 * * *', action: 'reminders', daysAhead: 6, enabled: true },
  { id: 'mailchats_6d', name: 'Mailchats (6 dagar)', schedule: '5 9 * * *', action: 'mailchats', daysAhead: 6, enabled: true },
  { id: 'reminders_1d', name: 'Påminnelser (1 dag)', schedule: '0 18 * * *', action: 'reminders', daysAhead: 1, enabled: true },
  { id: 'backup', name: 'Daglig backup', schedule: '0 2 * * *', action: 'backup', enabled: true },
  { id: 'publish', name: 'Publicera månadsblad', schedule: '0 * * * *', action: 'publish', enabled: false },
]

const ACCENT_COLORS = [
  { id: 'indigo', color: '#4f46e5', hover: '#4338ca', light: '#ede9fe', mid: '#a78bfa', label: 'Indigo' },
  { id: 'purple', color: '#7c3aed', hover: '#6d28d9', light: '#f5f3ff', mid: '#c4b5fd', label: 'Lila' },
  { id: 'blue', color: '#2563eb', hover: '#1d4ed8', light: '#dbeafe', mid: '#93c5fd', label: 'Blå' },
  { id: 'teal', color: '#0d9488', hover: '#0f766e', light: '#ccfbf1', mid: '#5eead4', label: 'Teal' },
  { id: 'green', color: '#16a34a', hover: '#15803d', light: '#dcfce7', mid: '#86efac', label: 'Grön' },
  { id: 'amber', color: '#d97706', hover: '#b45309', light: '#fef3c7', mid: '#fcd34d', label: 'Amber' },
  { id: 'red', color: '#dc2626', hover: '#b91c1c', light: '#fee2e2', mid: '#fca5a5', label: 'Röd' },
  { id: 'pink', color: '#db2777', hover: '#be185d', light: '#fce7f3', mid: '#f9a8d4', label: 'Rosa' },
  { id: 'slate', color: '#475569', hover: '#334155', light: '#f1f5f9', mid: '#94a3b8', label: 'Grå' },
]

// ── Form state ───────────────────────────────────────────────────────────────
const form = reactive({
  orgName: '',
  orgLogo: '',
  baseUrl: '',
  smtpHost: '',
  smtpPort: 587,
  smtpUser: '',
  smtpPass: '',
  smtpFrom: '',
  smtpSecure: false,
  sftpHost: '',
  sftpPort: 22,
  sftpUser: '',
  sftpKey: '',
  sftpPath: '/var/www/html/calendar.html',
})

const cronJobs = ref<CronJob[]>([])
const tokenStatus = ref('')
const sftpKeyStatus = ref('')

// Reset form when modal opens
watch(() => props.open, (isOpen) => {
  if (!isOpen) return
  const s = db.settings || {}
  const smtp = s.smtp || {} as any
  const sftp = s.sftp || {} as any
  form.orgName = s.orgName || ''
  form.orgLogo = s.orgLogo || ''
  form.baseUrl = s.baseUrl || ''
  form.smtpHost = smtp.host || ''
  form.smtpPort = smtp.port || 587
  form.smtpUser = smtp.user || ''
  form.smtpPass = smtp.pass || ''
  form.smtpFrom = smtp.from || ''
  form.smtpSecure = smtp.secure || false
  form.sftpHost = sftp.host || ''
  form.sftpPort = sftp.port || 22
  form.sftpUser = sftp.username || ''
  form.sftpKey = sftp.privateKey || ''
  form.sftpPath = sftp.remotePath || '/var/www/html/calendar.html'
  cronJobs.value = JSON.parse(JSON.stringify(s.cronJobs || DEFAULT_CRON_JOBS))
  const withToken = (db.contacts || []).filter((c: any) => c.token).length
  tokenStatus.value = `${withToken} av ${db.contacts.length} har token`
  sftpKeyStatus.value = sftp.privateKey ? `✓ Nyckel laddad (${sftp.privateKey.length} tecken)` : 'Ingen nyckel'
})

const currentAccent = computed(() => db.settings?.accentColor || 'indigo')

function applyTheme(accentId: string) {
  const t = ACCENT_COLORS.find(c => c.id === accentId) || ACCENT_COLORS[0]
  document.documentElement.style.setProperty('--accent', t.color)
  document.documentElement.style.setProperty('--accent-hover', t.hover)
  document.documentElement.style.setProperty('--accent-light', t.light)
  document.documentElement.style.setProperty('--accent-mid', t.mid)
  document.documentElement.style.setProperty('--accent-text', t.color)
}

async function setAccentColor(id: string) {
  if (!db.settings) db.settings = {} as any
  db.settings.accentColor = id
  applyTheme(id)
  await persist('settings')
}

function describeCron(expr: string): string {
  const parts = (expr || '').split(' ')
  if (parts.length < 5) return ''
  const min = parts[0], hour = parts[1]
  if (hour === '*' && min !== '*') return `varje timme vid :${min.padStart(2, '0')}`
  if (min === '*' || hour === '*') return 'varje minut/timme'
  return `kl ${hour.padStart(2, '0')}:${min.padStart(2, '0')} dagligen`
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    reminders: 'Påminnelser', mailchats: 'Mailchats',
    backup: 'Backup', publish: 'Publicera',
  }
  return map[action] || action
}

function onSftpKeyFile(e: globalThis.Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    form.sftpKey = reader.result as string
    sftpKeyStatus.value = `✓ ${file.name} (${form.sftpKey.length} tecken)`
  }
  reader.readAsText(file)
}

async function generateTokens() {
  try {
    const res = await fetch('/api/generate-tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(api.authHeader.value ? { Authorization: api.authHeader.value } : {}) },
    })
    const data = await res.json()
    if (!data.ok) { toast('Kunde inte generera tokens', 'error'); return }
    toast(`${data.generated} nya tokens genererade`)
    tokenStatus.value = 'Alla har nu token'
  } catch (err: any) {
    toast('Fel: ' + err.message, 'error')
  }
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
  } catch (err: any) {
    toast('Kunde inte köra jobb: ' + err.message, 'error')
  }
}

async function save() {
  if (!db.settings) db.settings = {} as any
  db.settings.orgName = form.orgName
  db.settings.orgLogo = form.orgLogo
  db.settings.baseUrl = form.baseUrl.replace(/\/+$/, '')
  db.settings.smtp = {
    host: form.smtpHost,
    port: form.smtpPort || 587,
    user: form.smtpUser,
    pass: form.smtpPass,
    from: form.smtpFrom,
    secure: form.smtpSecure,
  }
  db.settings.sftp = {
    host: form.sftpHost,
    port: form.sftpPort || 22,
    username: form.sftpUser,
    privateKey: form.sftpKey,
    remotePath: form.sftpPath,
  }
  db.settings.cronJobs = cronJobs.value
  await persist('settings')
  // Reload cron schedules on server
  fetch('/api/cron/reload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(api.authHeader.value ? { Authorization: api.authHeader.value } : {}) },
  }).catch(() => {})
  emit('close')
  toast('Inställningar sparade')
}
</script>

<template>
  <RecordModal :open="open" title="Inställningar" @close="emit('close')">
    <div class="space-y-6">
      <!-- Theme -->
      <section>
        <h4 class="section-title">Tema</h4>
        <div class="flex gap-1.5 flex-wrap">
          <button
            v-for="c in ACCENT_COLORS"
            :key="c.id"
            @click="setAccentColor(c.id)"
            :title="c.label"
            class="w-7 h-7 rounded-full border-2 cursor-pointer p-0 transition-all"
            :style="{ background: c.color, borderColor: currentAccent === c.id ? '#fff' : 'transparent', boxShadow: currentAccent === c.id ? '0 0 0 2px ' + c.color : 'none' }"
          />
        </div>
      </section>

      <!-- Organisation -->
      <section>
        <h4 class="section-title">Organisation</h4>
        <div class="space-y-3">
          <div><label class="field-label">Namn</label><input v-model="form.orgName" class="field-input" placeholder="T.ex. Exempelkyrkan" /></div>
          <div><label class="field-label">Logotyp-URL</label><input v-model="form.orgLogo" class="field-input" placeholder="https://..." /></div>
          <div><label class="field-label">Bas-URL</label><input v-model="form.baseUrl" class="field-input" placeholder="https://schema.example.com" /></div>
        </div>
      </section>

      <!-- Member tokens -->
      <section>
        <h4 class="section-title">Medlemslänkar</h4>
        <p class="text-xs text-gray-500 mb-2">Generera personliga inloggningslänkar för alla kontakter.</p>
        <div class="flex items-center gap-2">
          <button @click="generateTokens" class="btn-ghost">Generera saknade tokens</button>
          <span class="text-[11px] text-gray-500">{{ tokenStatus }}</span>
        </div>
      </section>

      <!-- SMTP -->
      <section>
        <h4 class="section-title">SMTP (e-post)</h4>
        <div class="space-y-3">
          <div><label class="field-label">Host</label><input v-model="form.smtpHost" class="field-input" /></div>
          <div><label class="field-label">Port</label><input v-model.number="form.smtpPort" type="number" class="field-input" /></div>
          <div><label class="field-label">Användare</label><input v-model="form.smtpUser" class="field-input" /></div>
          <div><label class="field-label">Lösenord</label><input v-model="form.smtpPass" type="password" class="field-input" /></div>
          <div><label class="field-label">Från-adress</label><input v-model="form.smtpFrom" class="field-input" /></div>
          <div class="flex items-center gap-2">
            <input v-model="form.smtpSecure" type="checkbox" id="smtp-secure" class="accent-accent" />
            <label for="smtp-secure" class="text-sm text-gray-700">Secure (TLS)</label>
          </div>
        </div>
      </section>

      <!-- SFTP -->
      <section>
        <h4 class="section-title">SFTP (publicering)</h4>
        <div class="space-y-3">
          <div><label class="field-label">Host</label><input v-model="form.sftpHost" class="field-input" /></div>
          <div><label class="field-label">Port</label><input v-model.number="form.sftpPort" type="number" class="field-input" /></div>
          <div><label class="field-label">Användare</label><input v-model="form.sftpUser" class="field-input" /></div>
          <div>
            <label class="field-label">Privat nyckel</label>
            <div class="flex items-center gap-2">
              <span class="text-xs" :class="form.sftpKey ? 'text-emerald-700' : 'text-gray-400'">{{ sftpKeyStatus }}</span>
              <label class="btn-ghost text-[11px] cursor-pointer inline-flex items-center gap-1">
                {{ form.sftpKey ? 'Byt' : 'Ladda upp' }}
                <input type="file" class="hidden" @change="onSftpKeyFile" />
              </label>
              <button v-if="form.sftpKey" @click="form.sftpKey = ''; sftpKeyStatus = 'Ingen nyckel'" class="btn-ghost text-[11px]">Ta bort</button>
            </div>
          </div>
          <div><label class="field-label">Fjärrsökväg</label><input v-model="form.sftpPath" class="field-input" /></div>
        </div>
      </section>

      <!-- Cron jobs -->
      <section>
        <h4 class="section-title">Schemalagda jobb (cron)</h4>
        <div class="space-y-2">
          <div
            v-for="job in cronJobs"
            :key="job.id"
            class="bg-gray-50 border border-gray-200 rounded-md p-3"
          >
            <div class="flex items-center gap-2 mb-1.5">
              <input v-model="job.enabled" type="checkbox" class="accent-accent" />
              <span class="text-[13px] font-semibold text-gray-700 flex-1">{{ job.name }}</span>
              <span class="text-[11px] text-gray-400 bg-white border border-gray-200 rounded px-1.5 py-0.5 font-mono">{{ actionLabel(job.action) }}</span>
              <button @click="runCronJob(job.id)" class="btn-ghost text-[11px] inline-flex items-center gap-1">▶ Kör nu</button>
            </div>
            <div class="flex items-center gap-2">
              <label class="text-[11px] text-gray-500">Cron:</label>
              <input v-model="job.schedule" class="border border-gray-300 rounded px-1.5 py-0.5 text-xs font-mono w-28" />
              <span class="text-[10px] text-gray-400">{{ describeCron(job.schedule) }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Save -->
      <div class="flex gap-2 pt-4 border-t border-gray-200">
        <button @click="save" class="bg-accent text-white rounded-md px-4 py-1.5 text-sm cursor-pointer hover:bg-accent-hover transition-colors">Spara</button>
        <button @click="emit('close')" class="border border-gray-300 rounded-md px-4 py-1.5 text-sm cursor-pointer hover:bg-gray-50 transition-colors">Avbryt</button>
      </div>
    </div>
  </RecordModal>
</template>

<style scoped>
@reference "../style.css";
.section-title {
  @apply text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 pt-4 border-t border-gray-200;
}
section:first-child .section-title {
  @apply pt-0 border-t-0;
}
.field-label {
  @apply block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1;
}
.field-input {
  @apply w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm outline-none
         transition-colors focus:border-accent focus:ring-2 focus:ring-accent/10 bg-gray-50 focus:bg-white;
}
.btn-ghost {
  @apply bg-transparent border border-gray-300 rounded-md px-3 py-1 text-xs text-gray-600
         cursor-pointer hover:bg-gray-50 transition-colors;
}
</style>
