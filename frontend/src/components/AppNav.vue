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
  Home, Monitor, IdCard, ClipboardList, User,
  PackageOpen, FileText, Mail, ChevronDown,
  CalendarDays, Menu, Tags,
} from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const { isViewer, isMember, setView } = useStore()
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

const memberTabs = [
  { path: '/home', label: 'Hem', icon: Home },
  { path: '/my', label: 'Mitt schema', icon: User },
  { path: '/slides', label: 'Slides', icon: Monitor },
  { path: '/namnskyltar', label: 'Skyltar', icon: IdCard },
  { path: '/sunday', label: 'Söndag', icon: ClipboardList },
]

const isOutputActive = () => outputTabs.some(t => isActive(t.path))

const moreOpen = ref(false)

const moreItems = [
  { path: '/contacts', label: 'Kontakter', icon: Users },
  { path: '/teams', label: 'Team', icon: UsersRound },
  { path: '/categories', label: 'Kategorier', icon: Tags },
  { path: '/slides', label: 'Slides', icon: Monitor },
  { path: '/export', label: 'Månadsblad', icon: FileText },
  { path: '/mailbot', label: 'Påminnelsemail', icon: Mail },
  { path: '/namnskyltar', label: 'Namnskyltar', icon: IdCard },
  { path: '/sunday', label: 'Söndag', icon: ClipboardList },
]

function goMobile(path: string) {
  moreOpen.value = false
  router.push(path)
}

function onLoginSuccess() {
  showLogin.value = false
  location.reload()
}
</script>

<template>
  <nav class="flex items-center bg-[#1a1a2e] text-white px-4 h-11 gap-1 shrink-0">
    <span class="font-bold text-sm mr-4 text-purple-400">Mötesplanering</span>

    <template v-if="isViewer || isMember">
      <button
        v-for="tab in (isMember ? memberTabs : viewerTabs)"
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

  <!-- Mobile bottom nav (≤480px) -->
  <div class="mob-nav">
    <template v-if="isViewer || isMember">
      <button v-for="tab in (isMember ? memberTabs : viewerTabs)" :key="tab.path" @click="go(tab.path)" :class="{ active: isActive(tab.path) }">
        <component :is="tab.icon" :size="16" /><span>{{ tab.label }}</span>
      </button>
    </template>
    <template v-else>
      <button @click="goMobile('/events')" :class="{ active: isActive('/events') }">
        <Calendar :size="16" /><span>Händelser</span>
      </button>
      <button @click="goMobile('/schema')" :class="{ active: isActive('/schema') }">
        <Table :size="16" /><span>Schema</span>
      </button>
      <button @click="goMobile('/events'); setView('calendar')" :class="{ active: false }">
        <CalendarDays :size="16" /><span>Månadsvy</span>
      </button>
      <button @click="moreOpen = !moreOpen" :class="{ active: moreOpen }">
        <Menu :size="16" /><span>Mer</span>
      </button>
    </template>
  </div>

  <!-- More sheet -->
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="moreOpen" class="fixed inset-0 z-[38]" @click="moreOpen = false">
        <div class="absolute inset-0 bg-black/30" />
        <div class="absolute bottom-[calc(48px+env(safe-area-inset-bottom,0px))] left-0 right-0 bg-[#1a1a2e] border-t border-[#2d2d4e] p-2 flex flex-col gap-0.5 max-h-[60vh] overflow-y-auto z-[39]" @click.stop>
          <button
            v-for="item in moreItems" :key="item.path"
            @click="goMobile(item.path)"
            class="flex items-center gap-3 px-4 py-2.5 rounded-md text-sm text-gray-300 bg-transparent border-none cursor-pointer hover:bg-[#2d2d4e] hover:text-white transition-colors w-full text-left"
            :class="{ 'text-white bg-accent/20': isActive(item.path) }"
          >
            <component :is="item.icon" :size="18" />
            {{ item.label }}
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
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

/* Mobile bottom nav — hidden by default, shown at ≤480px */
.mob-nav {
  display: none;
}
@media (max-width: 480px) {
  nav { display: none !important; }
  .mob-nav {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 40;
    background: #1a1a2e;
    border-top: 1px solid #2d2d4e;
    padding: 4px 0;
    padding-bottom: env(safe-area-inset-bottom, 4px);
  }
  .mob-nav button {
    flex: 1;
    background: none;
    border: none;
    color: #9ca3af;
    font-size: 9px;
    padding: 4px 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    cursor: pointer;
    transition: color 0.12s ease;
  }
  .mob-nav button.active { color: var(--accent); }
  .mob-nav button:active { transform: scale(0.9); }
}

/* Sheet transition */
.sheet-enter-active { transition: opacity 0.15s ease; }
.sheet-leave-active { transition: opacity 0.12s ease; }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
</style>
