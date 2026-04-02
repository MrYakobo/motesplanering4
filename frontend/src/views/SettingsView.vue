<script setup lang="ts">
import { reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useStore } from '../composables/useStore'
import { useToast } from '../composables/useToast'

const router = useRouter()
const { db, persist, isAdmin } = useStore()
const { show: toast } = useToast()

if (!isAdmin.value) router.replace('/events')

const form = reactive({
  orgName: db.settings?.orgName || '',
  orgLogo: db.settings?.orgLogo || '',
  baseUrl: (db.settings as any)?.baseUrl || '',
  smtp: {
    host: db.settings?.smtp?.host || '',
    port: db.settings?.smtp?.port || 587,
    user: db.settings?.smtp?.user || '',
    pass: db.settings?.smtp?.pass || '',
    from: db.settings?.smtp?.from || '',
    secure: db.settings?.smtp?.secure || false,
  },
  sftp: {
    host: db.settings?.sftp?.host || '',
    port: db.settings?.sftp?.port || 22,
    username: db.settings?.sftp?.username || '',
    privateKey: db.settings?.sftp?.privateKey || '',
    remotePath: db.settings?.sftp?.remotePath || '/var/www/html/calendar.html',
  },
})

async function save() {
  db.settings = {
    ...db.settings,
    orgName: form.orgName,
    orgLogo: form.orgLogo,
    smtp: { ...form.smtp },
    sftp: { ...form.sftp },
  }
  ;(db.settings as any).baseUrl = form.baseUrl
  await persist('settings')
  toast('Inställningar sparade')
  router.back()
}
</script>

<template>
  <div class="flex-1 overflow-y-auto bg-gray-50">
    <div class="max-w-xl mx-auto py-8 px-4">
      <h2 class="text-lg font-semibold mb-6">Inställningar</h2>

      <section class="mb-8">
        <h3 class="section-title">Organisation</h3>
        <div class="field">
          <label>Namn</label>
          <input v-model="form.orgName" placeholder="T.ex. Exempelkyrkan" />
        </div>
        <div class="field">
          <label>Logotyp-URL</label>
          <input v-model="form.orgLogo" placeholder="https://..." />
        </div>
        <div class="field">
          <label>Bas-URL</label>
          <input v-model="form.baseUrl" placeholder="https://schema.example.com" />
        </div>
      </section>

      <section class="mb-8">
        <h3 class="section-title">SMTP (e-post)</h3>
        <div class="field">
          <label>Host</label>
          <input v-model="form.smtp.host" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="field">
            <label>Port</label>
            <input v-model.number="form.smtp.port" type="number" />
          </div>
          <div class="field flex items-end pb-3.5">
            <label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input v-model="form.smtp.secure" type="checkbox" class="accent-accent" />
              Secure (TLS)
            </label>
          </div>
        </div>
        <div class="field">
          <label>Användare</label>
          <input v-model="form.smtp.user" />
        </div>
        <div class="field">
          <label>Lösenord</label>
          <input v-model="form.smtp.pass" type="password" />
        </div>
        <div class="field">
          <label>Från-adress</label>
          <input v-model="form.smtp.from" />
        </div>
      </section>

      <section class="mb-8">
        <h3 class="section-title">SFTP (publicering)</h3>
        <div class="field">
          <label>Host</label>
          <input v-model="form.sftp.host" />
        </div>
        <div class="field">
          <label>Port</label>
          <input v-model.number="form.sftp.port" type="number" />
        </div>
        <div class="field">
          <label>Användare</label>
          <input v-model="form.sftp.username" />
        </div>
        <div class="field">
          <label>Fjärrsökväg</label>
          <input v-model="form.sftp.remotePath" />
        </div>
      </section>

      <div class="flex gap-3">
        <button @click="save" class="bg-accent text-white rounded-md px-5 py-2 text-sm cursor-pointer hover:bg-accent-hover transition-colors">
          Spara
        </button>
        <button @click="router.back()" class="border border-gray-300 text-gray-700 rounded-md px-5 py-2 text-sm cursor-pointer hover:bg-gray-50 transition-colors">
          Avbryt
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference "../style.css";
.section-title {
  @apply text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 pb-2 border-b border-gray-200;
}
.field {
  @apply mb-3;
}
.field label {
  @apply block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1;
}
.field input, .field textarea {
  @apply w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm outline-none
         transition-colors focus:border-accent focus:ring-2 focus:ring-accent/10 bg-white;
}
</style>
