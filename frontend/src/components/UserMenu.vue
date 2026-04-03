<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useStore } from '../composables/useStore'
import { useApi } from '../composables/useApi'
import { useToday } from '../composables/useToday'
import RecordModal from './RecordModal.vue'
import SubscribeModal from './SubscribeModal.vue'
import { Settings, LogOut, RefreshCw, UserRoundCog, CalendarClock, CalendarPlus, ListChecks } from 'lucide-vue-next'

const { role, isAdmin, db, memberContactId } = useStore()
const { logout } = useApi()
const { todayStr, isSimulated, simDate, setSimDate, clearSimDate } = useToday()
const router = useRouter()

const open = ref(false)
const switchOpen = ref(false)
const subscribeOpen = ref(false)
const switchSearch = ref('')
const switchIdx = ref(0)
const btnRef = ref<HTMLElement | null>(null)
const dropRef = ref<HTMLElement | null>(null)
const dropStyle = ref<Record<string, string>>({})

const displayName = computed(() => {
  if (isAdmin.value) return 'Admin'
  if (role.value === 'member') {
    const c = db.contacts.find(x => x.id === memberContactId.value)
    return c?.name || 'Medlem'
  }
  return ''
})

const initials = computed(() => {
  const parts = displayName.value.split(' ').filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (parts[0] || '?').slice(0, 2).toUpperCase()
})

const roleLabel = computed(() => isAdmin.value ? 'Administratör' : 'Medlem')

const filteredContacts = computed(() => {
  const q = switchSearch.value.toLowerCase()
  return db.contacts
    .filter((c: any) => c.token && (!q || c.name.toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name))
})

watch(switchSearch, () => { switchIdx.value = 0 })

function switchKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') { e.preventDefault(); switchIdx.value = Math.min(switchIdx.value + 1, filteredContacts.value.length - 1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); switchIdx.value = Math.max(switchIdx.value - 1, 0) }
  else if (e.key === 'Enter') {
    e.preventDefault()
    const c = filteredContacts.value[switchIdx.value]
    if (c) switchToUser(c.id)
  }
}

function switchToUser(contactId: number) {
  const contact = db.contacts.find(c => c.id === contactId) as any
  if (!contact?.token) return
  localStorage.removeItem('authHeader')
  localStorage.setItem('memberToken', contact.token)
  location.reload()
}

function positionDrop() {
  if (!btnRef.value) return
  const r = btnRef.value.getBoundingClientRect()
  // Position to the right of the button, bottom-aligned
  const left = r.right + 6
  const maxBottom = r.bottom
  dropStyle.value = {
    position: 'fixed',
    left: left + 'px',
    bottom: (window.innerHeight - maxBottom) + 'px',
    zIndex: '9999',
  }
}

function toggle() {
  open.value = !open.value
  if (open.value) nextTick(positionDrop)
}

function onClickOutside(e: MouseEvent) {
  if (btnRef.value?.contains(e.target as Node)) return
  if (dropRef.value?.contains(e.target as Node)) return
  open.value = false
}

onMounted(() => document.addEventListener('click', onClickOutside, true))
onUnmounted(() => document.removeEventListener('click', onClickOutside, true))

const emit = defineEmits<{ openGenerate: [] }>()
</script>

<template>
  <div class="relative">
    <button ref="btnRef" @click.stop="toggle" class="skeu-avatar">
      {{ initials }}
    </button>

    <Teleport to="body">
      <Transition name="dropdown">
        <div v-if="open" ref="dropRef" class="skeu-dropdown" :style="dropStyle">
          <div class="skeu-dropdown-header">
            <div class="skeu-avatar-lg">{{ initials }}</div>
            <div>
              <div class="skeu-dropdown-name">{{ displayName }}</div>
              <div class="skeu-dropdown-role">{{ roleLabel }}</div>
            </div>
          </div>
          <div class="skeu-dropdown-section">
            <button v-if="isAdmin" @click="emit('openGenerate'); open = false" class="skeu-menu-btn">
              <RefreshCw :size="15" /> Generera händelser
            </button>
            <button @click="subscribeOpen = true; open = false" class="skeu-menu-btn">
              <CalendarPlus :size="15" /> Prenumerera
            </button>
            <button v-if="isAdmin" @click="router.push('/tasks'); open = false" class="skeu-menu-btn">
              <ListChecks :size="15" /> Uppgifter
            </button>
            <button v-if="isAdmin" @click="switchOpen = true; switchSearch = ''; open = false" class="skeu-menu-btn">
              <UserRoundCog :size="15" /> Byt användare
            </button>
            <button v-if="isAdmin" @click="router.push('/settings'); open = false" class="skeu-menu-btn">
              <Settings :size="15" /> Inställningar
            </button>
          </div>
          <div class="skeu-dropdown-section" style="border-top: 1px solid #bbb;">
            <div class="flex items-center gap-2 px-3 py-2">
              <CalendarClock :size="14" class="text-[#777] shrink-0" />
              <input type="date" :value="simDate || todayStr"
                @change="setSimDate(($event.target as HTMLInputElement).value)"
                class="flex-1 text-[11px] px-1.5 py-1 rounded border border-[#aaa] outline-none bg-gradient-to-b from-white to-[#eee] text-[#444] shadow-[inset_0_1px_2px_rgba(0,0,0,.06)] focus:border-accent" />
              <button v-if="isSimulated" @click="clearSimDate"
                class="text-[10px] text-amber-700 bg-transparent border border-amber-400 rounded px-1.5 py-0.5 cursor-pointer hover:bg-amber-50 shrink-0">×</button>
            </div>
          </div>
          <div class="skeu-dropdown-section" style="border-top: 1px solid #bbb;">
            <button @click="logout" class="skeu-menu-btn skeu-menu-btn-danger">
              <LogOut :size="15" /> Logga ut
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>

  <RecordModal :open="switchOpen" title="Byt användare" @close="switchOpen = false">
    <p class="text-xs text-gray-500 mb-3">Välj en person att logga in som.</p>
    <input v-model="switchSearch" type="text" placeholder="Sök person…"
      class="w-full border border-gray-300 rounded-md px-2.5 py-2 text-sm outline-none focus:border-accent mb-3"
      @keydown="switchKeydown" />
    <div class="max-h-[50vh] overflow-y-auto space-y-0.5">
      <button v-for="(c, i) in filteredContacts" :key="c.id" @click="switchToUser(c.id)"
        @mouseenter="switchIdx = i"
        class="flex items-center gap-2 w-full bg-transparent border-none py-2.5 px-2 text-sm text-gray-700 cursor-pointer rounded-md transition-colors text-left"
        :class="i === switchIdx ? 'bg-accent/10 text-accent' : 'hover:bg-gray-50'"
      >
        <div class="skeu-avatar-sm">
          {{ c.name.split(' ').filter(Boolean).map((p: string) => p[0]).slice(0, 2).join('').toUpperCase() }}
        </div>
        {{ c.name }}
      </button>
    </div>
  </RecordModal>

  <SubscribeModal :open="subscribeOpen" @close="subscribeOpen = false" />
</template>

<style scoped>
.skeu-avatar {
  width: 30px; height: 30px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; color: #fff; cursor: pointer;
  border: 1px solid rgba(0,0,0,.2);
  background: linear-gradient(180deg, #6a5aed 0%, #3b2fba 100%);
  box-shadow: 0 1px 0 rgba(255,255,255,.25) inset, 0 1px 3px rgba(59,47,186,.35);
  transition: all 0.12s ease;
}
.skeu-avatar:hover {
  box-shadow: 0 1px 0 rgba(255,255,255,.3) inset, 0 2px 6px rgba(59,47,186,.5);
}
.skeu-avatar-lg {
  width: 44px; height: 44px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; font-weight: 700; color: #fff; flex-shrink: 0;
  background: linear-gradient(180deg, #6a5aed 0%, #3b2fba 100%);
  border: 1px solid rgba(0,0,0,.15);
  box-shadow: 0 1px 0 rgba(255,255,255,.25) inset, 0 2px 4px rgba(59,47,186,.3);
}
.skeu-avatar-sm {
  width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700; color: #fff; flex-shrink: 0;
  background: linear-gradient(180deg, #6a5aed 0%, #3b2fba 100%);
  border: 1px solid rgba(0,0,0,.1);
  box-shadow: 0 1px 0 rgba(255,255,255,.2) inset;
}
.skeu-dropdown {
  width: 260px;
  border-radius: 10px;
  overflow: hidden;
  background: linear-gradient(180deg, #f0f0f0 0%, #ddd 100%);
  border: 1px solid #aaa;
  box-shadow: 0 1px 0 rgba(255,255,255,.5) inset, 0 6px 24px rgba(0,0,0,.25);
}
.skeu-dropdown-header {
  display: flex; align-items: center; gap: 12px; padding: 16px;
  border-bottom: 1px solid #bbb;
  background: linear-gradient(180deg, #e8e8e8 0%, #d8d8d8 100%);
}
.skeu-dropdown-name { font-weight: 600; font-size: 14px; color: #333; }
.skeu-dropdown-role { font-size: 11px; color: #777; }
.skeu-dropdown-section { padding: 4px; }
.skeu-menu-btn {
  width: 100%; text-align: left; padding: 8px 12px; font-size: 12px; color: #444;
  display: flex; align-items: center; gap: 8px; border-radius: 5px;
  background: none; border: none; cursor: pointer;
  text-shadow: 0 1px 0 rgba(255,255,255,.6); transition: all 0.1s ease;
}
.skeu-menu-btn:hover {
  background: linear-gradient(180deg, #6a5aed 0%, #4a3cc9 100%);
  color: #fff; text-shadow: 0 -1px 0 rgba(0,0,0,.2);
}
.skeu-menu-btn-danger { color: #c0392b; }
.skeu-menu-btn-danger:hover {
  background: linear-gradient(180deg, #e74c3c 0%, #c0392b 100%); color: #fff;
}
.dropdown-enter-active { animation: dropIn 0.12s ease; }
.dropdown-leave-active { transition: opacity 0.1s ease; }
.dropdown-leave-to { opacity: 0; }
@keyframes dropIn {
  from { opacity: 0; transform: translateX(-4px); }
  to { opacity: 1; transform: translateX(0); }
}
</style>
