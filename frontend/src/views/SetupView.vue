<script setup lang="ts">
import { ref } from 'vue'
import { Calendar } from 'lucide-vue-next'

const step = ref(1)
const orgName = ref('')
const adminUser = ref('admin')
const adminPass = ref('')
const adminPass2 = ref('')
const error = ref('')
const saving = ref(false)

async function submit() {
  error.value = ''
  if (!orgName.value.trim()) { error.value = 'Ange organisationsnamn'; return }
  if (!adminUser.value.trim()) { error.value = 'Ange användarnamn'; return }
  if (adminPass.value.length < 4) { error.value = 'Lösenord måste vara minst 4 tecken'; return }
  if (adminPass.value !== adminPass2.value) { error.value = 'Lösenorden matchar inte'; return }

  saving.value = true
  try {
    const res = await fetch('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgName: orgName.value.trim(),
        adminUser: adminUser.value.trim(),
        adminPass: adminPass.value,
      }),
    })
    const data = await res.json()
    if (!res.ok || !data.ok) {
      error.value = data.error || 'Något gick fel'
      saving.value = false
      return
    }
    // Store auth and reload
    const header = 'Basic ' + btoa(adminUser.value.trim() + ':' + adminPass.value)
    localStorage.setItem('authHeader', header)
    location.hash = '#/events/calendar'
    location.reload()
  } catch (e: any) {
    error.value = e.message || 'Kunde inte nå servern'
    saving.value = false
  }
}
</script>

<template>
  <div class="setup">
    <div class="setup-card">
      <div class="logo-badge">
        <Calendar :size="32" stroke-width="1.5" />
      </div>

      <h1>Välkommen</h1>
      <p class="subtitle">Konfigurera Mötesplanering</p>

      <!-- Step 1: Org name -->
      <div v-if="step === 1" class="fields">
        <label>
          <span class="label-text">Organisationsnamn</span>
          <input
            v-model="orgName"
            type="text"
            placeholder="T.ex. Exempelkyrkan"
            autofocus
            @keyup.enter="step = 2"
          />
        </label>
        <button class="primary-btn" @click="step = 2" :disabled="!orgName.trim()">
          Nästa
        </button>
      </div>

      <!-- Step 2: Admin account -->
      <div v-else class="fields">
        <label>
          <span class="label-text">Admin-användarnamn</span>
          <input v-model="adminUser" type="text" />
        </label>
        <label>
          <span class="label-text">Lösenord</span>
          <input v-model="adminPass" type="password" @keyup.enter="$event.target.nextElementSibling?.focus()" />
        </label>
        <label>
          <span class="label-text">Upprepa lösenord</span>
          <input v-model="adminPass2" type="password" @keyup.enter="submit" />
        </label>
        <p v-if="error" class="error-msg">{{ error }}</p>
        <div class="btn-row">
          <button class="back-btn" @click="step = 1">Tillbaka</button>
          <button class="primary-btn" @click="submit" :disabled="saving">
            {{ saving ? 'Skapar...' : 'Kom igång' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.setup {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #c4ccd8 0%, #a8b5c5 4%, #8a9bb0 100%);
  padding: 24px;
}

.setup-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 380px;
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

.fields {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

label {
  display: flex;
  flex-direction: column;
  text-align: left;
  gap: 4px;
}

.label-text {
  font-size: 11px;
  font-weight: 600;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

input {
  padding: 9px 12px;
  border-radius: 6px;
  font-size: 14px;
  color: #333;
  border: 1px solid #bbb;
  background: linear-gradient(180deg, #fff 0%, #f4f4f4 100%);
  box-shadow: 0 1px 2px rgba(0,0,0,.06) inset;
  outline: none;
  transition: border-color 0.15s;
}
input:focus {
  border-color: #6a5aed;
  box-shadow: 0 0 0 2px rgba(106,90,237,.15), 0 1px 2px rgba(0,0,0,.06) inset;
}

.primary-btn {
  display: flex; align-items: center; justify-content: center;
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
  margin-top: 4px;
}
.primary-btn:hover:not(:disabled) {
  background: linear-gradient(180deg, #7b6cf5 0%, #5544d4 100%);
}
.primary-btn:disabled {
  opacity: 0.5; cursor: default;
}

.back-btn {
  padding: 10px 20px; border-radius: 8px;
  font-size: 13px; color: #666;
  cursor: pointer; border: 1px solid #ccc;
  background: linear-gradient(180deg, #f4f4f4 0%, #e4e4e4 100%);
  box-shadow: 0 1px 0 rgba(255,255,255,.7) inset;
  transition: all 0.15s ease;
}
.back-btn:hover { background: linear-gradient(180deg, #fff 0%, #eee 100%); }

.btn-row {
  display: flex; gap: 8px; margin-top: 4px;
}
.btn-row .primary-btn { flex: 1; }

.error-msg {
  font-size: 12px; color: #c53030; margin: 0;
  padding: 6px 10px; border-radius: 6px;
  background: #fee2e2; text-align: left;
}
</style>
