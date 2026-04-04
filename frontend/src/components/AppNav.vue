<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useStore } from '../composables/useStore'
import { useToday } from '../composables/useToday'
import { usePresence } from '../composables/usePresence'
import UserMenu from './UserMenu.vue'
import LoginModal from './LoginModal.vue'
import GenerateEventsModal from './GenerateEventsModal.vue'
import { useApi } from '../composables/useApi'
import {
  Calendar, Table, Users, UsersRound,
  Home, Monitor, IdCard, ClipboardList, User,
  FileText, Mail, List, CalendarDays, CalendarRange, Grid3x3,
  Menu, Tags, Settings, LogOut, CalendarClock, UserRoundCog,
} from 'lucide-vue-next'
import RecordModal from './RecordModal.vue'

const router = useRouter()
const route = useRoute()
const { isViewer, isMember, isAdmin, db, memberContactId } = useStore()
const { todayStr, isSimulated, simDate, setSimDate, clearSimDate } = useToday()

const { onlineCount, onlineUsers } = usePresence()

const showLogin = ref(false)
const generateOpen = ref(false)
const moreOpen = ref(false)
const mobUserOpen = ref(false)
const mobSwitchOpen = ref(false)
const mobSwitchSearch = ref('')

const isActive = (path: string) => route.path.startsWith(path)
const isExact = (path: string) => route.path === path
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

// Händelser sub-items (month first, list last)
const eventSubs = [
  { path: '/events/calendar', label: 'Månad', icon: CalendarDays },
  { path: '/events/week', label: 'Vecka', icon: CalendarRange },
  { path: '/events/year', label: 'År', icon: Grid3x3 },
  { path: '/events', label: 'Lista', icon: List, exact: true },
]

// Team sub-items (dynamic from tasks)
const teamTasks = computed(() => db.tasks.filter((t: any) => t.teamTask))

const outputTabs = [
  { path: '/slides', label: 'Slides', icon: Monitor },
  { path: '/export', label: 'Månadsblad', icon: FileText },
  { path: '/mailbot', label: 'Påminnelser', icon: Mail },
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
  // { path: '/home', label: 'Hem', icon: Home },
  { path: '/my', label: 'Mitt schema', icon: User },
  // { path: '/slides', label: 'Slides', icon: Monitor },
  // { path: '/namnskyltar', label: 'Skyltar', icon: IdCard },
  // { path: '/sunday', label: 'Söndag', icon: ClipboardList },
]

const moreItems = [
  { path: '/contacts', label: 'Kontakter', icon: Users },
  { path: '/categories', label: 'Kategorier', icon: Tags },
  { path: '/slides', label: 'Slides', icon: Monitor },
  { path: '/export', label: 'Månadsblad', icon: FileText },
  { path: '/mailbot', label: 'Påminnelser', icon: Mail },
  { path: '/namnskyltar', label: 'Namnskyltar', icon: IdCard },
  { path: '/sunday', label: 'Söndag', icon: ClipboardList },
]

function goMobile(path: string) { moreOpen.value = false; router.push(path) }

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

function onLoginSuccess() { showLogin.value = false; location.reload() }
</script>

<template>
  <!-- ═══ Desktop sidebar ═══ -->
  <nav class="skeu-sidebar hidden sm:flex">
    <!-- Logo -->
    <button class="sb-logo-btn" @click="go('/events/calendar')" title="Hem">
      <img src="/logo.svg" alt="Mötesplanering" class="w-7 h-7" />
      <span class="sb-brand">Mötes&shy;planering</span>
    </button>

    <template v-if="isViewer || isMember">
      <button v-for="tab in (isMember ? memberTabs : viewerTabs)" :key="tab.path"
        @click="go(tab.path)" class="sb-btn" :class="{ active: isActive(tab.path) }" :title="tab.label">
        <component :is="tab.icon" :size="15" />
        <span class="sb-label">{{ tab.label }}</span>
      </button>
    </template>

    <template v-else>
      <!-- Händelser + sub-items -->
      <button @click="go('/events/calendar')" class="sb-btn" :class="{ active: isActive('/events') }">
        <Calendar :size="15" />
        <span class="sb-label">Händelser</span>
      </button>
      <div v-if="isActive('/events')" class="sb-sub">
        <button v-for="sub in eventSubs" :key="sub.path"
          @click="go(sub.path)" class="sb-sub-btn"
          :class="{ active: sub.exact ? isExact(sub.path) : isActive(sub.path) }">
          <component :is="sub.icon" :size="13" />
          <span class="sb-label">{{ sub.label }}</span>
        </button>
      </div>

      <button @click="go('/schema')" class="sb-btn" :class="{ active: isActive('/schema') }">
        <Table :size="15" /><span class="sb-label">Schema</span>
      </button>
      <button @click="go('/contacts')" class="sb-btn" :class="{ active: isActive('/contacts') }">
        <Users :size="15" /><span class="sb-label">Kontakter</span>
      </button>

      <!-- Team + sub-items -->
      <button @click="go(teamTasks.length ? `/teams/${teamTasks[0].id}` : '/teams')" class="sb-btn" :class="{ active: isActive('/teams') }">
        <UsersRound :size="15" /><span class="sb-label">Team</span>
      </button>
      <div v-if="isActive('/teams') && teamTasks.length > 1" class="sb-sub">
        <button v-for="task in teamTasks" :key="task.id"
          @click="go(`/teams/${task.id}`)" class="sb-sub-btn"
          :class="{ active: route.params.taskId === String(task.id) }">
          <span class="sb-label">{{ task.name }}</span>
        </button>
      </div>

      <div class="sb-divider" />

      <button v-for="tab in outputTabs" :key="tab.path"
        @click="go(tab.path)" class="sb-btn" :class="{ active: isActive(tab.path) }" :title="tab.label">
        <component :is="tab.icon" :size="15" />
        <span class="sb-label">{{ tab.label }}</span>
      </button>
    </template>

    <template v-if="isMember">
      <!-- Händelser + sub-items -->
      <button @click="go('/events/calendar')" class="sb-btn" :class="{ active: isActive('/events') }">
        <Calendar :size="15" />
        <span class="sb-label">Händelser</span>
      </button>
      <div v-if="isActive('/events')" class="sb-sub">
        <button v-for="sub in eventSubs" :key="sub.path"
          @click="go(sub.path)" class="sb-sub-btn"
          :class="{ active: sub.exact ? isExact(sub.path) : isActive(sub.path) }">
          <component :is="sub.icon" :size="13" />
          <span class="sb-label">{{ sub.label }}</span>
        </button>
      </div>

      <button @click="go('/schema')" class="sb-btn" :class="{ active: isActive('/schema') }">
        <Table :size="15" /><span class="sb-label">Schema</span>
      </button>
    </template>

    <div class="flex-1" />

    <!-- Online indicator -->
    <div class="sb-presence" :title="onlineUsers.map(u => u.name).join(', ')">
      <span class="sb-presence-dot" />
      {{ onlineCount }} online
    </div>

    <button v-if="isViewer" @click="showLogin = true" class="sb-btn" title="Logga in">
      <User :size="15" /><span class="sb-label">Logga in</span>
    </button>
    <UserMenu v-else @open-generate="generateOpen = true" />
  </nav>

  <!-- ═══ Mobile bottom nav ═══ -->
  <div class="mob-nav">
    <template v-if="isViewer || isMember">
      <button v-for="tab in (isMember ? memberTabs : viewerTabs)" :key="tab.path" @click="go(tab.path)" :class="{ active: isActive(tab.path) }">
        <component :is="tab.icon" :size="16" /><span>{{ tab.label }}</span>
      </button>
      <button @click="goMobile('/teams')" :class="{ active: isActive('/teams') }"><UsersRound :size="16" /><span>Team</span></button>
      <button @click="goMobile('/schema')" :class="{ active: isActive('/schema') }"><Table :size="16" /><span>Schema</span></button>
    </template>
    <template v-else>
      <button @click="goMobile('/teams')" :class="{ active: isActive('/teams') }"><UsersRound :size="16" /><span>Team</span></button>
      <button @click="goMobile('/schema')" :class="{ active: isActive('/schema') }"><Table :size="16" /><span>Schema</span></button>
      <button @click="goMobile('/events/calendar')" :class="{ active: isActive('/events') }"><CalendarDays :size="16" /><span>Kalender</span></button>
      <button @click="moreOpen = !moreOpen" :class="{ active: moreOpen }"><Menu :size="16" /><span>Mer</span></button>
    </template>
    <button v-if="!isViewer" class="mob-user-btn" @click.stop="mobUserOpen = !mobUserOpen">
      <span class="mob-avatar">{{ userInitials }}</span>
    </button>
    <button v-else @click="showLogin = true" class="mob-user-btn"><User :size="16" /></button>
  </div>

  <!-- Sheets & modals -->
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="moreOpen" class="fixed inset-0 z-[38]" @click="moreOpen = false">
        <div class="sheet-backdrop" />
        <div class="sheet-panel" @click.stop>
          <button v-for="item in moreItems" :key="item.path" @click="goMobile(item.path)"
            class="mob-sheet-btn" :class="{ 'mob-sheet-btn-active': isActive(item.path) }">
            <component :is="item.icon" :size="18" /> {{ item.label }}
          </button>
          <div class="flex items-center gap-3 px-4 py-2.5 rounded-md text-sm text-[#555]">
            <CalendarClock :size="18" class="shrink-0" /><span class="shrink-0">Datum</span>
            <input type="date" :value="simDate || todayStr" @change="setSimDate(($event.target as HTMLInputElement).value)"
              class="flex-1 rounded-md px-2 py-1 text-xs outline-none"
              style="background: linear-gradient(180deg, #ddd 0%, #fff 3px); border: 1px solid #aaa; box-shadow: 0 1px 2px rgba(0,0,0,.06) inset; color: #333;" />
            <button v-if="isSimulated" @click="clearSimDate"
              class="text-[10px] text-amber-700 bg-transparent border border-amber-400 rounded px-1.5 py-0.5 cursor-pointer hover:bg-amber-50 shrink-0">Återställ</button>
          </div>
        </div>
      </div>
    </Transition>
    <Transition name="sheet">
      <div v-if="mobUserOpen" class="fixed inset-0 z-[38]" @click="mobUserOpen = false">
        <div class="sheet-backdrop" />
        <div class="sheet-panel" @click.stop>
          <div class="p-4 flex items-center gap-3 border-b border-[#ccc]">
            <div class="mob-avatar-lg">{{ userInitials }}</div>
            <div>
              <div class="text-[#333] font-semibold text-sm">{{ isAdmin ? 'Admin' : (memberContactId ? db.contacts.find(c => c.id === memberContactId)?.name : 'Medlem') }}</div>
              <div class="text-[#888] text-xs">{{ isAdmin ? 'Administratör' : 'Medlem' }}</div>
            </div>
          </div>
          <div class="p-1.5">
            <button v-if="isAdmin" @click="mobSwitchOpen = true; mobSwitchSearch = ''; mobUserOpen = false" class="mob-sheet-btn"><UserRoundCog :size="18" /> Byt användare</button>
            <button v-if="isAdmin" @click="router.push('/settings'); mobUserOpen = false" class="mob-sheet-btn"><Settings :size="18" /> Inställningar</button>
            <button @click="useApi().logout()" class="mob-sheet-btn text-red-400"><LogOut :size="18" /> Logga ut</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <RecordModal :open="mobSwitchOpen" title="Byt användare" @close="mobSwitchOpen = false">
    <p class="text-xs text-gray-500 mb-3">Välj en person att logga in som.</p>
    <input v-model="mobSwitchSearch" type="text" placeholder="Sök person…"
      class="w-full border border-gray-300 rounded-md px-2.5 py-2 text-sm outline-none focus:border-accent mb-3" />
    <div class="max-h-[50vh] overflow-y-auto space-y-0.5">
      <button v-for="c in mobSwitchContacts" :key="c.id" @click="switchToUser(c.id)"
        class="flex items-center gap-2 w-full bg-transparent border-none py-2.5 px-2 text-sm text-gray-700 cursor-pointer rounded-md hover:bg-gray-50 transition-colors text-left">
        {{ c.name }}
      </button>
    </div>
  </RecordModal>

  <LoginModal :open="showLogin" @close="showLogin = false" @success="onLoginSuccess" />
  <GenerateEventsModal :open="generateOpen" @close="generateOpen = false" @generated="generateOpen = false" />
</template>

<style scoped>
@reference "../style.css";

.skeu-sidebar {
  flex-direction: column;
  width: 168px;
  flex-shrink: 0;
  padding: 8px 6px;
  gap: 1px;
  overflow-y: auto;
  overflow-x: hidden;
  background: linear-gradient(180deg, #e0e0e0 0%, #c8c8c8 100%);
  border-right: 1px solid #999;
  box-shadow: 1px 0 0 rgba(255,255,255,.3) inset;
}

.sb-logo-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  margin-bottom: 8px;
  border-radius: 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: background 0.12s ease;
}
.sb-logo-btn:hover { background: rgba(0,0,0,.04); }
.sb-brand {
  font-size: 12px;
  font-weight: 700;
  color: #444;
  line-height: 1.2;
  text-shadow: 0 1px 0 rgba(255,255,255,.7);
  hyphens: auto;
}

.sb-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 8px; border-radius: 5px; font-size: 12px;
  color: #444; cursor: pointer; border: 1px solid transparent;
  background: transparent; text-shadow: 0 1px 0 rgba(255,255,255,.6);
  transition: all 0.12s ease; width: 100%; text-align: left;
}
.sb-btn:hover {
  background: linear-gradient(180deg, #fff 0%, #e8e8e8 100%);
  border-color: #aaa; box-shadow: 0 1px 0 rgba(255,255,255,.7) inset;
}
.sb-btn.active {
  color: #fff; text-shadow: 0 -1px 0 rgba(0,0,0,.2);
  background: linear-gradient(180deg, #6a5aed 0%, #4a3cc9 100%);
  border-color: rgba(0,0,0,.25);
  box-shadow: 0 1px 0 rgba(255,255,255,.2) inset, 0 1px 3px rgba(59,47,186,.3);
}

.sb-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Sub-items (indented) */
.sb-sub { padding-left: 12px; margin-bottom: 2px; }
.sb-sub-btn {
  display: flex; align-items: center; gap: 5px;
  padding: 3px 8px; border-radius: 4px; font-size: 11px;
  color: #555; cursor: pointer; border: 1px solid transparent;
  background: transparent; text-shadow: 0 1px 0 rgba(255,255,255,.6);
  transition: all 0.12s ease; width: 100%; text-align: left;
}
.sb-sub-btn:hover {
  background: rgba(255,255,255,.5); border-color: #bbb;
}
.sb-sub-btn.active {
  color: #4a3cc9; font-weight: 600;
  background: rgba(106, 90, 237, 0.1);
  border-color: rgba(106, 90, 237, 0.2);
}

.sb-divider {
  height: 1px; margin: 6px 4px;
  background: linear-gradient(90deg, transparent, #aaa, transparent);
}

.sb-presence {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  font-size: 10px;
  color: #888;
  cursor: default;
}
.sb-presence-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 4px rgba(34, 197, 94, 0.5);
}

/* ── Mobile ───────────────────────────────────────────────────────────────── */
.mob-nav { display: none; }

@media (max-width: 480px) {
  .skeu-sidebar { display: none !important; }
  .mob-nav {
    display: flex; position: fixed; bottom: 0; left: 0; right: 0; z-index: 40;
    background: linear-gradient(180deg, #d0d0d0 0%, #b0b0b0 100%);
    border-top: 1px solid #999;
    box-shadow: 0 -1px 0 rgba(255,255,255,.4) inset;
    padding: 4px 0; padding-bottom: env(safe-area-inset-bottom, 4px);
  }
  .mob-nav button {
    flex: 1; background: none; border: none; color: #555; font-size: 9px;
    padding: 4px 0; display: flex; flex-direction: column; align-items: center;
    gap: 1px; cursor: pointer; text-shadow: 0 1px 0 rgba(255,255,255,.5);
    transition: color 0.12s ease;
  }
  .mob-nav button.active { color: #4a3cc9; }
  .mob-nav button:active { transform: scale(0.9); }
  .mob-nav .mob-user-btn { flex: none; width: 40px; padding: 4px 0; }
  .mob-avatar {
    display: inline-flex; align-items: center; justify-content: center;
    width: 28px; height: 28px; border-radius: 50%;
    font-size: 10px; font-weight: 700; color: #fff;
    background: linear-gradient(180deg, #6a5aed 0%, #3b2fba 100%);
    border: 1px solid rgba(0,0,0,.15);
    box-shadow: 0 1px 0 rgba(255,255,255,.2) inset, 0 1px 3px rgba(59,47,186,.3);
  }
}

.mob-avatar-lg {
  width: 40px; height: 40px; border-radius: 50%;
  font-size: 14px; font-weight: 700; color: #fff;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  background: linear-gradient(180deg, #6a5aed 0%, #3b2fba 100%);
  border: 1px solid rgba(0,0,0,.15);
  box-shadow: 0 1px 0 rgba(255,255,255,.2) inset, 0 1px 3px rgba(59,47,186,.3);
}

.sheet-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,.4); transition: opacity 0.25s ease; }
.sheet-panel {
  position: absolute; bottom: calc(43px + env(safe-area-inset-bottom, 0px));
  left: 0; right: 0; border-radius: 16px 16px 0 0; padding: 8px;
  max-height: 60vh; overflow-y: auto; z-index: 39;
  background: linear-gradient(180deg, #d0d0d0 0%, #b8b8b8 100%);
  border-top: 1px solid rgba(255,255,255,.4);
  box-shadow: 0 -4px 20px rgba(0,0,0,.3);
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.3s ease;
}
.sheet-enter-active .sheet-backdrop, .sheet-leave-active .sheet-backdrop { transition: opacity 0.25s ease; }
.sheet-enter-from .sheet-backdrop, .sheet-leave-to .sheet-backdrop { opacity: 0; }
.sheet-enter-active .sheet-panel, .sheet-leave-active .sheet-panel { transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease; }
.sheet-enter-from .sheet-panel { transform: translateY(100%); opacity: 0; }
.sheet-leave-to .sheet-panel { transform: translateY(40%); opacity: 0; }

.mob-sheet-btn {
  width: 100%; text-align: left; padding: 10px 14px; font-size: 14px; color: #444;
  display: flex; align-items: center; gap: 10px; border-radius: 6px;
  background: none; border: none; cursor: pointer; text-shadow: 0 1px 0 rgba(255,255,255,.5);
}
.mob-sheet-btn:hover { background: linear-gradient(180deg, #fff 0%, #e8e8e8 100%); }
.mob-sheet-btn-active {
  background: linear-gradient(180deg, #6a5aed 0%, #4a3cc9 100%);
  color: #fff !important; text-shadow: 0 -1px 0 rgba(0,0,0,.2) !important;
}
</style>
