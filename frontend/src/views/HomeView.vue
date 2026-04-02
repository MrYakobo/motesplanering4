<script setup lang="ts">
import { ref } from 'vue'
import { useStore } from '../composables/useStore'
import LoginModal from '../components/LoginModal.vue'
import { LogIn } from 'lucide-vue-next'

const { db, isViewer } = useStore()
const orgName = () => db.settings?.orgName || 'Mötesplanering'
const orgLogo = () => db.settings?.orgLogo || ''

const showLogin = ref(false)

function onLoginSuccess() {
  showLogin.value = false
  location.reload()
}
</script>

<template>
  <div class="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] text-white p-10">
    <img v-if="orgLogo()" :src="orgLogo()" class="h-18 w-auto mb-4 opacity-90" alt="" />
    <h1 class="text-5xl font-extrabold tracking-tight mb-2">{{ orgName() }}</h1>
    <p class="text-sm text-white/40 mb-10">Mötesplanering & volontärschema</p>

    <button
      v-if="isViewer"
      @click="showLogin = true"
      class="flex items-center gap-2 bg-accent text-white border-none rounded-lg px-6 py-3 text-sm font-semibold cursor-pointer hover:bg-accent-hover transition-colors shadow-lg"
    >
      <LogIn :size="16" />
      Logga in
    </button>

    <LoginModal
      :open="showLogin"
      @close="showLogin = false"
      @success="onLoginSuccess"
    />
  </div>
</template>
