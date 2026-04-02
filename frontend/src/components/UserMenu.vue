<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useStore } from '../composables/useStore'
import { useApi } from '../composables/useApi'
import RecordModal from './RecordModal.vue'
import { Settings, LogOut, RefreshCw, UserRoundCog } from 'lucide-vue-next'

const { role, isAdmin, db, memberContactId } = useStore()
const { logout } = useApi()
const router = useRouter()

const open = ref(false)
const switchOpen = ref(false)
const switchSearch = ref('')
const menuRef = ref<HTMLElement | null>(null)

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

function switchToUser(contactId: number) {
  const contact = db.contacts.find(c => c.id === contactId) as any
  if (!contact?.token) return
  // Clear admin auth, set member token
  localStorage.removeItem('authHeader')
  localStorage.setItem('memberToken', contact.token)
  location.reload()
}

function onClickOutside(e: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) open.value = false
}

onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => document.removeEventListener('click', onClickOutside))

const emit = defineEmits<{ openGenerate: [] }>()
</script>

<template>
  <div ref="menuRef" class="relative">
    <button
      @click.stop="open = !open"
      class="w-10 h-10 rounded-full bg-accent text-white text-sm font-bold flex items-center justify-center cursor-pointer border-2 border-transparent hover:border-purple-400 transition-colors"
    >
      {{ initials }}
    </button>
    <Transition name="dropdown">
      <div
        v-if="open"
        class="absolute right-0 top-full mt-1 w-72 bg-[#1a1a2e] border border-[#2d2d4e] rounded-xl shadow-2xl overflow-hidden z-50"
      >
        <div class="p-5 flex items-center gap-3 border-b border-[#2d2d4e]">
          <div class="w-14 h-14 rounded-full bg-accent text-white text-xl font-bold flex items-center justify-center shrink-0">
            {{ initials }}
          </div>
          <div>
            <div class="text-white font-semibold">{{ displayName }}</div>
            <div class="text-gray-400 text-xs">{{ roleLabel }}</div>
          </div>
        </div>
        <div class="p-1.5">
          <button v-if="isAdmin" @click="emit('openGenerate'); open = false" class="menu-btn">
            <RefreshCw :size="16" /> Generera händelser
          </button>
          <button v-if="isAdmin" @click="switchOpen = true; switchSearch = ''; open = false" class="menu-btn">
            <UserRoundCog :size="16" /> Byt användare
          </button>
          <button v-if="isAdmin" @click="router.push('/settings'); open = false" class="menu-btn">
            <Settings :size="16" /> Inställningar
          </button>
        </div>
        <div class="p-1.5 border-t border-[#2d2d4e]">
          <button @click="logout" class="menu-btn text-red-400">
            <LogOut :size="16" /> Logga ut
          </button>
        </div>
      </div>
    </Transition>
  </div>

  <!-- Switch user modal -->
  <RecordModal :open="switchOpen" title="Byt användare" @close="switchOpen = false">
    <p class="text-xs text-gray-500 mb-3">Välj en person att logga in som. Logga ut för att återgå till admin.</p>
    <input
      v-model="switchSearch"
      type="text"
      placeholder="Sök person…"
      class="w-full border border-gray-300 rounded-md px-2.5 py-2 text-sm outline-none focus:border-accent mb-3"
    />
    <div class="max-h-[50vh] overflow-y-auto space-y-0.5">
      <button
        v-for="c in filteredContacts" :key="c.id"
        @click="switchToUser(c.id)"
        class="flex items-center gap-2 w-full bg-transparent border-none py-2.5 px-2 text-sm text-gray-700 cursor-pointer rounded-md hover:bg-gray-50 transition-colors text-left"
      >
        <div class="w-7 h-7 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center shrink-0">
          {{ c.name.split(' ').filter(Boolean).map((p: string) => p[0]).slice(0, 2).join('').toUpperCase() }}
        </div>
        {{ c.name }}
      </button>
    </div>
  </RecordModal>
</template>

<style scoped>
.menu-btn {
  width: 100%;
  text-align: left;
  padding: 10px 14px;
  font-size: 13px;
  color: #ccc;
  display: flex;
  align-items: center;
  gap: 10px;
  border-radius: 6px;
  background: none;
  border: none;
  cursor: pointer;
  transition: background 0.1s;
}
.menu-btn:hover { background: #2d2d4e; color: #fff; }
.menu-btn.text-red-400:hover { color: #f87171; }
.dropdown-enter-active { animation: dropIn 0.12s ease; }
.dropdown-leave-active { transition: opacity 0.1s ease; }
.dropdown-leave-to { opacity: 0; }
@keyframes dropIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
