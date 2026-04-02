<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useStore } from '../composables/useStore'
import { useToday } from '../composables/useToday'
import UserMenu from './UserMenu.vue'
import LoginModal from './LoginModal.vue'
import SettingsModal from './SettingsModal.vue'
import {
  Calendar, Table, Users, ListChecks, UsersRound,
  Home, Monitor, IdCard, ClipboardList,
  PackageOpen, FileText, Mail, ChevronDown,
} from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const { isViewer } = useStore()
const { todayStr, isSimulated, simDate, setSimDate, clearSimDate } = useToday()

const showLogin = ref(false)
const showSettings = ref(false)

const isActive = (path: string) => route.path.startsWith(path)
const go = (path: string) => router.push(path)

const adminTabs = [
  { path: '/events', label: 'Händelser', icon: Calendar },
  { path: '/schema', label: 'Schema', icon: Table },
  { path: '/contacts', label: 'Kontakter', icon: Users },
  { path: '/tasks', label: 'Uppgifter', icon: ListChecks },
  { path: '/teams', label: 'Team', icon: UsersRound },
]

const outputTabs = [
  { path: '/slides', label: 'Slides', icon: Monitor },
  { path: '/export', label: 'Månadsblad', icon: FileText },
  { path: '/mailbot', label: 'Påminnelsemail', icon: Mail },
  { path: '/namnskyltar', label: 'Namnskyltar', icon: IdCard },
  { path: '/sunday', label: 'Söndag', icon: ClipboardList },
]

const viewerTabs = [
  { path: '/home', label: 'Hem', icon: Home },
  { path: '/slides', label: 'Slides', icon: Monitor },
  { path: '/namnskyltar', label: 'Skyltar', icon: IdCard },
  { path: '/sunday', label: 'Söndag', icon: ClipboardList },
]

const isOutputActive = () => outputTabs.some(t => isActive(t.path))

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

      <!-- Outputs dropdown -->
      <div class="nav-dropdown group relative">
        <button
          class="nav-btn"
          :class="{ active: isOutputActive() }"
        >
          <PackageOpen :size="14" />
          Utdata
          <ChevronDown :size="11" class="opacity-60" />
        </button>
        <div class="nav-dropdown-menu hidden group-hover:flex flex-col absolute top-full left-0 bg-[#1a1a2e] border border-[#2d2d4e] rounded-md p-1 min-w-[160px] z-[200] shadow-[0_8px_24px_rgba(0,0,0,.4)]">
          <button
            v-for="tab in outputTabs"
            :key="tab.path"
            @click="go(tab.path)"
            class="nav-drop-item"
            :class="{ active: isActive(tab.path) }"
          >
            <component :is="tab.icon" :size="14" />
            {{ tab.label }}
          </button>
        </div>
      </div>
    </template>

    <span class="flex-1" />

    <!-- Simulated date warning -->
    <span
      v-if="isSimulated"
      class="bg-amber-100 text-amber-800 text-[11px] px-2.5 py-0.5 rounded flex items-center gap-1.5 mr-2"
    >
      ⚠ {{ simDate }}
      <button
        @click="clearSimDate"
        class="bg-transparent border border-amber-400 text-amber-800 rounded text-[10px] px-1.5 cursor-pointer hover:bg-amber-200 transition-colors"
      >
        Återställ
      </button>
    </span>

    <!-- Date picker -->
    <input
      type="date"
      :value="simDate || todayStr"
      @change="setSimDate(($event.target as HTMLInputElement).value)"
      class="bg-[#2d2d4e] text-gray-300 border border-[#444] rounded-md px-2 py-0.5 text-xs cursor-pointer outline-none focus:border-accent mr-2"
    />

    <button
      v-if="isViewer"
      @click="showLogin = true"
      class="text-purple-400 text-sm bg-transparent border-none cursor-pointer px-3 py-1.5"
    >
      Logga in
    </button>

    <UserMenu v-else @open-settings="showSettings = true" />

    <LoginModal
      :open="showLogin"
      @close="showLogin = false"
      @success="onLoginSuccess"
    />
    <SettingsModal
      :open="showSettings"
      @close="showSettings = false"
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
.nav-drop-item {
  @apply flex items-center gap-2 px-3 py-1.5 rounded text-[13px] text-gray-400
         cursor-pointer border-none bg-transparent transition-colors w-full text-left;
}
.nav-drop-item:hover { @apply bg-[#2d2d4e] text-white; }
.nav-drop-item.active { @apply bg-accent text-white; }
</style>
