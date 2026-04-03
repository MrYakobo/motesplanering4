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
  <nav class="skeu-nav">
    <!-- Logo badge in nav -->
    <div class="nav-logo">
      <Calendar :size="14" stroke-width="2" />
    </div>
    <span class="nav-brand">Mötesplanering</span>

    <template v-if="isViewer || isMember">
      <button
        v-for="tab in (isMember ? memberTabs : viewerTabs)"
        :key="tab.path"
        @click="go(tab.path)"
        class="nav-btn"
        :class="{ active: isActive(tab.path) }"
      >
        <component :is="tab.icon" :size="13" />
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
        <component :is="tab.icon" :size="13" />
        {{ tab.label }}
      </button>

      <!-- Outputs dropdown -->
      <div class="nav-dropdown group relative">
        <button
          class="nav-btn"
          :class="{ active: isOutputActive() }"
        >
          <PackageOpen :size="13" />
          Utdata
          <ChevronDown :size="10" class="opacity-60" />
        </button>
        <div class="nav-dropdown-menu hidden group-hover:flex flex-col absolute top-full left-0 mt-0.5 rounded-lg p-1 min-w-[160px] z-[200]">
          <button
            v-for="tab in outputTabs"
            :key="tab.path"
            @click="go(tab.path)"
            class="nav-drop-item"
            :class="{ active: isActive(tab.path) }"
          >
            <component :is="tab.icon" :size="13" />
            {{ tab.label }}
          </button>
        </div>
      </div>
    </template>

    <span class="flex-1" />

    <!-- Simulated date warning -->
    <span
      v-if="isSimulated"
      class="skeu-badge-warn"
    >
      ⚠ {{ simDate }}
      <button @click="clearSimDate" class="skeu-badge-warn-btn">Återställ</button>
    </span>

    <!-- Date picker -->
    <input
      type="date"
      :value="simDate || todayStr"
      @change="setSimDate(($event.target as HTMLInputElement).value)"
      class="skeu-date-input"
    />

    <button
      v-if="isViewer"
      @click="showLogin = true"
      class="nav-btn"
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
            class="mob-sheet-btn"
            :class="{ 'mob-sheet-btn-active': isActive(item.path) }"
          >
            <component :is="item.icon" :size="18" />
            {{ item.label }}
          </button>
          <!-- Emulate date -->
          <div class="flex items-center gap-3 px-4 py-2.5 rounded-md text-sm text-[#555]">
            <CalendarClock :size="18" class="shrink-0" />
            <span class="shrink-0">Datum</span>
            <input
              type="date"
              :value="simDate || todayStr"
              @change="setSimDate(($event.target as HTMLInputElement).value)"
              class="flex-1 rounded-md px-2 py-1 text-xs outline-none"
              style="background: linear-gradient(180deg, #ddd 0%, #fff 3px); border: 1px solid #aaa; box-shadow: 0 1px 2px rgba(0,0,0,.06) inset; color: #333;"
            />
            <button
              v-if="isSimulated"
              @click="clearSimDate"
              class="text-[10px] text-amber-700 bg-transparent border border-amber-400 rounded px-1.5 py-0.5 cursor-pointer hover:bg-amber-50 shrink-0"
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
          <div class="p-4 flex items-center gap-3 border-b border-[#ccc]">
            <div class="mob-avatar-lg">{{ userInitials }}</div>
            <div>
              <div class="text-[#333] font-semibold text-sm" style="text-shadow: 0 1px 0 rgba(255,255,255,.7)">{{ isAdmin ? 'Admin' : (memberContactId ? db.contacts.find(c => c.id === memberContactId)?.name : 'Medlem') }}</div>
              <div class="text-[#888] text-xs">{{ isAdmin ? 'Administratör' : 'Medlem' }}</div>
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

/* ── Skeuomorphic top nav ─────────────────────────────────────────────────── */
.skeu-nav {
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 12px;
  gap: 2px;
  flex-shrink: 0;
  background: linear-gradient(180deg, #e8e8e8 0%, #c8c8c8 45%, #b8b8b8 55%, #c0c0c0 100%);
  border-bottom: 1px solid #999;
  box-shadow: 0 1px 0 rgba(255,255,255,.45) inset, 0 1px 3px rgba(0,0,0,.12);
}

.nav-logo {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: linear-gradient(180deg, #6a5aed 0%, #3b2fba 100%);
  border: 1px solid rgba(0,0,0,.2);
  box-shadow: 0 1px 0 rgba(255,255,255,.3) inset, 0 1px 3px rgba(59,47,186,.35);
  margin-right: 6px;
}

.nav-brand {
  font-weight: 700;
  font-size: 13px;
  color: #333;
  margin-right: 12px;
  text-shadow: 0 1px 0 rgba(255,255,255,.7);
}

.nav-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 5px;
  font-size: 12px;
  color: #444;
  cursor: pointer;
  border: 1px solid transparent;
  background: transparent;
  text-shadow: 0 1px 0 rgba(255,255,255,.6);
  transition: all 0.12s ease;
}
.nav-btn:hover {
  background: linear-gradient(180deg, #fff 0%, #e8e8e8 100%);
  border-color: #aaa;
  box-shadow: 0 1px 0 rgba(255,255,255,.7) inset, 0 1px 2px rgba(0,0,0,.08);
}
.nav-btn.active {
  color: #fff;
  text-shadow: 0 -1px 0 rgba(0,0,0,.2);
  background: linear-gradient(180deg, #6a5aed 0%, #4a3cc9 100%);
  border-color: rgba(0,0,0,.25);
  box-shadow: 0 1px 0 rgba(255,255,255,.2) inset, 0 1px 3px rgba(59,47,186,.3);
}

/* Dropdown menu */
.nav-dropdown-menu {
  background: linear-gradient(180deg, #f0f0f0 0%, #ddd 100%);
  border: 1px solid #aaa;
  box-shadow: 0 4px 16px rgba(0,0,0,.2), 0 1px 0 rgba(255,255,255,.5) inset;
}
.nav-drop-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 12px;
  color: #444;
  cursor: pointer;
  border: none;
  background: transparent;
  text-shadow: 0 1px 0 rgba(255,255,255,.6);
  transition: all 0.1s ease;
  width: 100%;
  text-align: left;
}
.nav-drop-item:hover {
  background: linear-gradient(180deg, #6a5aed 0%, #4a3cc9 100%);
  color: #fff;
  text-shadow: 0 -1px 0 rgba(0,0,0,.2);
}
.nav-drop-item.active {
  background: linear-gradient(180deg, #6a5aed 0%, #4a3cc9 100%);
  color: #fff;
  text-shadow: 0 -1px 0 rgba(0,0,0,.2);
}

/* Simulated date badge */
.skeu-badge-warn {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  margin-right: 6px;
  color: #7c5a00;
  background: linear-gradient(180deg, #fff4cc 0%, #ffe699 100%);
  border: 1px solid #d4a800;
  box-shadow: 0 1px 0 rgba(255,255,255,.5) inset, 0 1px 2px rgba(0,0,0,.08);
  text-shadow: 0 1px 0 rgba(255,255,255,.5);
}
.skeu-badge-warn-btn {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  cursor: pointer;
  color: #7c5a00;
  background: linear-gradient(180deg, #fff 0%, #f0e0a0 100%);
  border: 1px solid #c49800;
  box-shadow: 0 1px 0 rgba(255,255,255,.4) inset;
}
.skeu-badge-warn-btn:hover { background: linear-gradient(180deg, #fff 0%, #ffe070 100%); }

/* Date input */
.skeu-date-input {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;
  outline: none;
  margin-right: 6px;
  color: #444;
  background: linear-gradient(180deg, #fff 0%, #eee 100%);
  border: 1px solid #aaa;
  box-shadow: 0 1px 2px rgba(0,0,0,.06) inset;
}
.skeu-date-input:focus { border-color: #6a5aed; }

/* ── Mobile bottom nav ────────────────────────────────────────────────────── */
.mob-nav { display: none; }

@media (max-width: 480px) {
  .skeu-nav { display: none !important; }
  .mob-nav {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 40;
    background: linear-gradient(180deg, #d0d0d0 0%, #b0b0b0 100%);
    border-top: 1px solid #999;
    box-shadow: 0 -1px 0 rgba(255,255,255,.4) inset;
    padding: 4px 0;
    padding-bottom: env(safe-area-inset-bottom, 4px);
  }
  .mob-nav button {
    flex: 1;
    background: none;
    border: none;
    color: #555;
    font-size: 9px;
    padding: 4px 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    cursor: pointer;
    text-shadow: 0 1px 0 rgba(255,255,255,.5);
    transition: color 0.12s ease;
  }
  .mob-nav button.active { color: #4a3cc9; }
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
    font-size: 10px;
    font-weight: 700;
    color: #fff;
    background: linear-gradient(180deg, #6a5aed 0%, #3b2fba 100%);
    border: 1px solid rgba(0,0,0,.15);
    box-shadow: 0 1px 0 rgba(255,255,255,.2) inset, 0 1px 3px rgba(59,47,186,.3);
  }
}

.mob-avatar-lg {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: linear-gradient(180deg, #6a5aed 0%, #3b2fba 100%);
  border: 1px solid rgba(0,0,0,.15);
  box-shadow: 0 1px 0 rgba(255,255,255,.2) inset, 0 1px 3px rgba(59,47,186,.3);
}

/* ── Sheet transitions ────────────────────────────────────────────────────── */
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
  border-radius: 16px 16px 0 0;
  padding: 8px;
  max-height: 60vh;
  overflow-y: auto;
  z-index: 39;
  background: linear-gradient(180deg, #d0d0d0 0%, #b8b8b8 100%);
  border-top: 1px solid rgba(255,255,255,.4);
  box-shadow: 0 -4px 20px rgba(0,0,0,.3);
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.3s ease;
}
.sheet-enter-active .sheet-backdrop,
.sheet-leave-active .sheet-backdrop { transition: opacity 0.25s ease; }
.sheet-enter-from .sheet-backdrop,
.sheet-leave-to .sheet-backdrop { opacity: 0; }
.sheet-enter-active .sheet-panel,
.sheet-leave-active .sheet-panel { transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease; }
.sheet-enter-from .sheet-panel { transform: translateY(100%); opacity: 0; }
.sheet-leave-to .sheet-panel { transform: translateY(40%); opacity: 0; }

.mob-sheet-btn {
  width: 100%;
  text-align: left;
  padding: 10px 14px;
  font-size: 14px;
  color: #444;
  display: flex;
  align-items: center;
  gap: 10px;
  border-radius: 6px;
  background: none;
  border: none;
  cursor: pointer;
  text-shadow: 0 1px 0 rgba(255,255,255,.5);
}
.mob-sheet-btn:hover {
  background: linear-gradient(180deg, #fff 0%, #e8e8e8 100%);
}
.mob-sheet-btn-active {
  background: linear-gradient(180deg, #6a5aed 0%, #4a3cc9 100%);
  color: #fff !important;
  text-shadow: 0 -1px 0 rgba(0,0,0,.2) !important;
}
</style>
