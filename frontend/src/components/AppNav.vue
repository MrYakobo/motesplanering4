<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useStore } from '../composables/useStore'
import UserMenu from './UserMenu.vue'
import LoginModal from './LoginModal.vue'
import {
  Calendar, Table, Users, ListChecks, UsersRound,
  Home, Monitor, IdCard, ClipboardList,
} from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const { isAdmin, isMember, isViewer } = useStore()

const showLogin = ref(false)

const isActive = (path: string) => route.path === path
const go = (path: string) => router.push(path)

const adminTabs = [
  { path: '/events', label: 'Händelser', icon: Calendar },
  { path: '/schema', label: 'Schema', icon: Table },
  { path: '/contacts', label: 'Kontakter', icon: Users },
  { path: '/tasks', label: 'Uppgifter', icon: ListChecks },
  { path: '/teams', label: 'Team', icon: UsersRound },
]

const viewerTabs = [
  { path: '/home', label: 'Hem', icon: Home },
  { path: '/slides', label: 'Slides', icon: Monitor },
  { path: '/namnskyltar', label: 'Skyltar', icon: IdCard },
  { path: '/sunday', label: 'Söndag', icon: ClipboardList },
]

function onLoginSuccess() {
  showLogin.value = false
  location.reload()
}
</script>

<template>
  <nav class="flex items-center bg-[#1a1a2e] text-white px-4 h-11 gap-1 shrink-0">
    <span class="font-bold text-sm mr-4 text-purple-400">Mötesplanering</span>

    <template v-if="isViewer">
      <button
        v-for="tab in viewerTabs"
        :key="tab.path"
        @click="go(tab.path)"
        class="nav-btn"
        :class="{ active: isActive(tab.path) }"
      >
        <component :is="tab.icon" :size="14" />
        {{ tab.label }}
      </button>
    </template>

    <template v-else>
      <button
        v-for="tab in adminTabs"
        :key="tab.path"
        @click="go(tab.path)"
        class="nav-btn"
        :class="{ active: isActive(tab.path) }"
      >
        <component :is="tab.icon" :size="14" />
        {{ tab.label }}
      </button>
    </template>

    <span class="flex-1" />

    <button
      v-if="isViewer"
      @click="showLogin = true"
      class="text-purple-400 text-sm bg-transparent border-none cursor-pointer px-3 py-1.5"
    >
      Logga in
    </button>

    <UserMenu v-else @open-settings="go('/settings')" />

    <LoginModal
      :open="showLogin"
      @close="showLogin = false"
      @success="onLoginSuccess"
    />
  </nav>
</template>

<style scoped>
@reference "../style.css";
.nav-btn {
  @apply flex items-center gap-1 px-3 py-1.5 rounded-md text-[13px] text-gray-400
         cursor-pointer border-none bg-transparent transition-colors;
}
.nav-btn:hover { @apply bg-[#2d2d4e] text-white; }
.nav-btn.active { @apply bg-accent text-white; }
</style>
