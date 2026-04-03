<script setup lang="ts">
import { ref } from 'vue'
import { useStore } from '../composables/useStore'
import LoginModal from '../components/LoginModal.vue'
import { LogIn, Calendar, Users, ClipboardList } from 'lucide-vue-next'

const { db, isViewer } = useStore()
const orgName = () => db.settings?.orgName || 'Mötesplanering'

const showLogin = ref(false)

function onLoginSuccess() {
  showLogin.value = false
  location.reload()
}
</script>

<template>
  <div class="landing">
    <div class="landing-card">
      <!-- Skeuomorphic logo badge -->
      <div class="logo-badge">
        <Calendar :size="32" stroke-width="1.5" />
      </div>

      <h1>{{ orgName() }}</h1>
      <p class="subtitle">Schemaläggning &amp; volontärhantering</p>

      <div class="features">
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

      <button
        v-if="isViewer"
        @click="showLogin = true"
        class="login-btn"
      >
        <LogIn :size="16" />
        Logga in
      </button>
    </div>

    <LoginModal
      :open="showLogin"
      @close="showLogin = false"
      @success="onLoginSuccess"
    />
  </div>
</template>

<style scoped>
.landing {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    linear-gradient(180deg, #c4ccd8 0%, #a8b5c5 4%, #8a9bb0 100%);
  padding: 24px;
}

.landing-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 380px;
  width: 100%;
  padding: 40px 32px 36px;
  border-radius: 16px;
  background:
    linear-gradient(180deg, #f7f7f7 0%, #e8e8e8 100%);
  border: 1px solid #fff;
  box-shadow:
    0 1px 0 rgba(255,255,255,.6) inset,
    0 4px 16px rgba(0,0,0,.25),
    0 1px 3px rgba(0,0,0,.15);
}

/* Skeuomorphic embossed logo circle */
.logo-badge {
  width: 72px;
  height: 72px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  color: #fff;
  background:
    linear-gradient(180deg, #6a5aed 0%, #3b2fba 100%);
  border: 1px solid rgba(255,255,255,.25);
  box-shadow:
    0 1px 0 rgba(255,255,255,.4) inset,
    0 -1px 2px rgba(0,0,0,.15) inset,
    0 4px 12px rgba(59,47,186,.4),
    0 1px 2px rgba(0,0,0,.2);
}

h1 {
  font-size: 26px;
  font-weight: 700;
  color: #2a2a2a;
  margin: 0 0 4px;
  text-shadow: 0 1px 0 rgba(255,255,255,.8);
}

.subtitle {
  font-size: 13px;
  color: #777;
  margin: 0 0 28px;
  text-shadow: 0 1px 0 rgba(255,255,255,.6);
}

.features {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  margin-bottom: 28px;
}

.feature {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  color: #444;
  background:
    linear-gradient(180deg, #fff 0%, #f0f0f0 100%);
  border: 1px solid #d0d0d0;
  box-shadow:
    0 1px 0 rgba(255,255,255,.7) inset,
    0 1px 2px rgba(0,0,0,.08);
  text-shadow: 0 1px 0 rgba(255,255,255,.8);
}

.feature svg {
  color: #5b4fc7;
  flex-shrink: 0;
}

.login-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 28px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
  border: 1px solid rgba(0,0,0,.2);
  background:
    linear-gradient(180deg, #6a5aed 0%, #4a3cc9 100%);
  box-shadow:
    0 1px 0 rgba(255,255,255,.25) inset,
    0 2px 6px rgba(59,47,186,.35),
    0 1px 2px rgba(0,0,0,.15);
  text-shadow: 0 -1px 0 rgba(0,0,0,.2);
  transition: all 0.15s ease;
}
.login-btn:hover {
  background:
    linear-gradient(180deg, #7b6cf5 0%, #5544d4 100%);
  box-shadow:
    0 1px 0 rgba(255,255,255,.3) inset,
    0 3px 10px rgba(59,47,186,.45),
    0 1px 2px rgba(0,0,0,.2);
}
.login-btn:active {
  background:
    linear-gradient(180deg, #4a3cc9 0%, #3b2fba 100%);
  box-shadow:
    0 1px 3px rgba(0,0,0,.2) inset,
    0 1px 2px rgba(0,0,0,.1);
}
</style>
