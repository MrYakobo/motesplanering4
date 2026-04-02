<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useStore } from '../composables/useStore'
import { useToday } from '../composables/useToday'
import UserMenu from './UserMenu.vue'
import LoginModal from './LoginModal.vue'
import GenerateEventsModal from './GenerateEventsModal.vue'
import { useApi } from '../composables/useApi'
import {
  Calendar, Table, Users, ListChecks, UsersRound,
  Home, Monitor, IdCard, ClipboardList, User,
  PackageOpen, FileText, Mail, ChevronDown,
  CalendarDays, Menu, Tags, Settings, LogOut, CalendarClock, UserRoundCog,
} from 'lucide-vue-next'
import RecordModal from './RecordModal.vue'

const router = useRouter()
const route = useRoute()
const { isViewer, isMember, isAdmin, db, memberContactId } = useStore()
const { todayStr, isSimulated, simDate, setSimDate, clearSimDate } = useToday()

const showLogin = ref(false)
const generateOpen = ref(false)
const moreOpen = ref(false)
const mobUserOpen = ref(false)
const mobSwitchOpen = ref(false)
const mobSwitchSearch = ref('')

const isActive = (path: string) => route.path.startsWith(path)
const go = (path: string) => router.push(path)

const userInitials = computed(() => {
  if (isAdmin.value) return 'AD'
  if (isMember.value) {
    const c = db.contacts.find(x => x.id === memberContactId.value)
    const parts = (c?.name || 'M').split(' ').filter(Boolean)
    return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : parts[0].slice(0, 2).toUpperCase()
  }
  return '?'
})

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

const moreItems = [
  { path: '/contacts', label: 'Kontakter', icon: Users },
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

const mobSwitchContacts = computed(() => {
  const q = mobSwitchSearch.value.toLowerCase()
  return db.contacts
    .filter((c: any) => c.token && (!q || c.name.toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name))
})

function switchToUser(contactId: number) {
  const contact = db.contacts.find(c => c.id === contactId) as any
  if (!contact?.token) return
  localStorage.removeItem('authHeader')
  localStorage.setItem('memberToken', contact.token)
  location.reload()
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

    <UserMenu v-else @open-generate="generateOpen = true" />

    <LoginModal
      :open="showLogin"
      @close="showLogin = false"
      @success="onLoginSuccess"
    />
    <GenerateEventsModal :open="generateOpen" @close="generateOpen = false" @generated="generateOpen = false" />
  </nav>

  <!-- Mobile bottom nav (≤480px) -->
  <div class="mob-nav">
    <template v-if="isViewer || isMember">
      <button v-for="tab in (isMember ? memberTabs : viewerTabs)" :key="tab.path" @click="go(tab.path)" :class="{ active: isActive(tab.path) }">
        <component :is="tab.icon" :size="16" /><span>{{ tab.label }}</span>
      </button>
    </template>
    <template v-else>
      <button @click="goMobile('/teams')" :class="{ active: isActive('/teams') }">
        <UsersRound :size="16" /><span>Team</span>
      </button>
      <button @click="goMobile('/schema')" :class="{ active: isActive('/schema') }">
        <Table :size="16" /><span>Schema</span>
      </button>
      <button @click="goMobile('/calendar')" :class="{ active: route.path === '/calendar' }">
        <CalendarDays :size="16" /><span>Månad</span>
      </button>
      <button @click="moreOpen = !moreOpen" :class="{ active: moreOpen }">
        <Menu :size="16" /><span>Mer</span>
      </button>
    </template>
    <!-- User avatar -->
    <button v-if="!isViewer" class="mob-user-btn" @click.stop="mobUserOpen = !mobUserOpen">
      <span class="mob-avatar">{{ userInitials }}</span>
    </button>
    <button v-else @click="showLogin = true" class="mob-user-btn">
      <User :size="16" />
    </button>
  </div>

  <!-- More sheet -->
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="moreOpen" class="fixed inset-0 z-[38]" @click="moreOpen = false">
        <div class="sheet-backdrop" />
        <div class="sheet-panel" @click.stop>
          <button
            v-for="item in moreItems" :key="item.path"
            @click="goMobile(item.path)"
            class="flex items-center gap-3 px-4 py-2.5 rounded-md text-sm text-gray-300 bg-transparent border-none cursor-pointer hover:bg-[#2d2d4e] hover:text-white transition-colors w-full text-left"
            :class="{ 'text-white bg-accent/20': isActive(item.path) }"
          >
            <component :is="item.icon" :size="18" />
            {{ item.label }}
          </button>
          <!-- Emulate date -->
          <div class="flex items-center gap-3 px-4 py-2.5 rounded-md text-sm text-gray-300">
            <CalendarClock :size="18" class="shrink-0" />
            <span class="shrink-0">Datum</span>
            <input
              type="date"
              :value="simDate || todayStr"
              @change="setSimDate(($event.target as HTMLInputElement).value)"
              class="flex-1 bg-[#2d2d4e] text-gray-300 border border-[#444] rounded-md px-2 py-1 text-xs outline-none focus:border-accent"
            />
            <button
              v-if="isSimulated"
              @click="clearSimDate"
              class="text-[10px] text-amber-400 bg-transparent border border-amber-400/40 rounded px-1.5 py-0.5 cursor-pointer hover:bg-amber-400/10 shrink-0"
            >
              Återställ
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Mobile user sheet -->
    <Transition name="sheet">
      <div v-if="mobUserOpen" class="fixed inset-0 z-[38]" @click="mobUserOpen = false">
        <div class="sheet-backdrop" />
        <div class="sheet-panel" @click.stop>
          <div class="p-4 flex items-center gap-3 border-b border-[#2d2d4e]">
            <div class="w-10 h-10 rounded-full bg-accent text-white text-sm font-bold flex items-center justify-center shrink-0">{{ userInitials }}</div>
            <div>
              <div class="text-white font-semibold text-sm">{{ isAdmin ? 'Admin' : (memberContactId ? db.contacts.find(c => c.id === memberContactId)?.name : 'Medlem') }}</div>
              <div class="text-gray-400 text-xs">{{ isAdmin ? 'Administratör' : 'Medlem' }}</div>
            </div>
          </div>
          <div class="p-1.5">
            <button v-if="isAdmin" @click="mobSwitchOpen = true; mobSwitchSearch = ''; mobUserOpen = false" class="mob-sheet-btn">
              <UserRoundCog :size="18" /> Byt användare
            </button>
            <button v-if="isAdmin" @click="router.push('/settings'); mobUserOpen = false" class="mob-sheet-btn">
              <Settings :size="18" /> Inställningar
            </button>
            <button @click="useApi().logout()" class="mob-sheet-btn text-red-400">
              <LogOut :size="18" /> Logga ut
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- Mobile switch user modal -->
  <RecordModal :open="mobSwitchOpen" title="Byt användare" @close="mobSwitchOpen = false">
    <p class="text-xs text-gray-500 mb-3">Välj en person att logga in som. Logga ut för att återgå till admin.</p>
    <input
      v-model="mobSwitchSearch"
      type="text"
      placeholder="Sök person…"
      class="w-full border border-gray-300 rounded-md px-2.5 py-2 text-sm outline-none focus:border-accent mb-3"
    />
    <div class="max-h-[50vh] overflow-y-auto space-y-0.5">
      <button
        v-for="c in mobSwitchContacts" :key="c.id"
        @click="switchToUser(c.id)"
        class="flex items-center gap-2 w-full bg-transparent border-none py-2.5 px-2 text-sm text-gray-700 cursor-pointer rounded-md hover:bg-gray-50 transition-colors text-left"
      >
        {{ c.name }}
      </button>
    </div>
  </RecordModal>
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
  .mob-nav .mob-user-btn {
    flex: none;
    width: 40px;
    padding: 4px 0;
  }
  .mob-avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--accent);
    color: #fff;
    font-size: 10px;
    font-weight: 700;
  }
}

/* Sheet transition — slide up from bottom */
.sheet-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,.4);
  transition: opacity 0.25s ease;
}
.sheet-panel {
  position: absolute;
  bottom: calc(43px + env(safe-area-inset-bottom, 0px));
  left: 0;
  right: 0;
  background: #1a1a2e;
  border-top: 1px solid #2d2d4e;
  border-radius: 16px 16px 0 0;
  padding: 8px;
  max-height: 60vh;
  overflow-y: auto;
  z-index: 39;
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.3s ease;
}
.sheet-enter-active .sheet-backdrop,
.sheet-leave-active .sheet-backdrop {
  transition: opacity 0.25s ease;
}
.sheet-enter-from .sheet-backdrop,
.sheet-leave-to .sheet-backdrop {
  opacity: 0;
}
.sheet-enter-active .sheet-panel,
.sheet-leave-active .sheet-panel {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease;
}
.sheet-enter-from .sheet-panel {
  transform: translateY(100%);
  opacity: 0;
}
.sheet-leave-to .sheet-panel {
  transform: translateY(40%);
  opacity: 0;
}
.mob-sheet-btn {
  width: 100%;
  text-align: left;
  padding: 10px 14px;
  font-size: 14px;
  color: #ccc;
  display: flex;
  align-items: center;
  gap: 10px;
  border-radius: 6px;
  background: none;
  border: none;
  cursor: pointer;
}
</style>
