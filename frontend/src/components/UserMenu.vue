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
    <button @click.stop="open = !open" class="skeu-avatar">
      {{ initials }}
    </button>
    <Transition name="dropdown">
      <div v-if="open" class="skeu-dropdown">
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
          <button v-if="isAdmin" @click="switchOpen = true; switchSearch = ''; open = false" class="skeu-menu-btn">
            <UserRoundCog :size="15" /> Byt användare
          </button>
          <button v-if="isAdmin" @click="router.push('/settings'); open = false" class="skeu-menu-btn">
            <Settings :size="15" /> Inställningar
          </button>
        </div>
        <div class="skeu-dropdown-section" style="border-top: 1px solid #bbb;">
          <button @click="logout" class="skeu-menu-btn skeu-menu-btn-danger">
            <LogOut :size="15" /> Logga ut
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
        <div class="skeu-avatar-sm">
          {{ c.name.split(' ').filter(Boolean).map((p: string) => p[0]).slice(0, 2).join('').toUpperCase() }}
        </div>
        {{ c.name }}
      </button>
    </div>
  </RecordModal>
</template>

<style scoped>
.skeu-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  cursor: pointer;
  border: 1px solid rgba(0,0,0,.2);
  background: linear-gradient(180deg, #6a5aed 0%, #3b2fba 100%);
  box-shadow: 0 1px 0 rgba(255,255,255,.25) inset, 0 1px 3px rgba(59,47,186,.35);
  transition: all 0.12s ease;
}
.skeu-avatar:hover {
  box-shadow: 0 1px 0 rgba(255,255,255,.3) inset, 0 2px 6px rgba(59,47,186,.5);
}

.skeu-avatar-lg {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
  background: linear-gradient(180deg, #6a5aed 0%, #3b2fba 100%);
  border: 1px solid rgba(0,0,0,.15);
  box-shadow: 0 1px 0 rgba(255,255,255,.25) inset, 0 2px 4px rgba(59,47,186,.3);
}

.skeu-avatar-sm {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
  background: linear-gradient(180deg, #6a5aed 0%, #3b2fba 100%);
  border: 1px solid rgba(0,0,0,.1);
  box-shadow: 0 1px 0 rgba(255,255,255,.2) inset;
}

.skeu-dropdown {
  position: absolute;
  right: 0;
  top: 100%;
  margin-top: 6px;
  width: 260px;
  border-radius: 10px;
  overflow: hidden;
  z-index: 50;
  background: linear-gradient(180deg, #f0f0f0 0%, #ddd 100%);
  border: 1px solid #aaa;
  box-shadow: 0 1px 0 rgba(255,255,255,.5) inset, 0 6px 24px rgba(0,0,0,.25);
}

.skeu-dropdown-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid #bbb;
  background: linear-gradient(180deg, #e8e8e8 0%, #d8d8d8 100%);
}
.skeu-dropdown-name {
  font-weight: 600;
  font-size: 14px;
  color: #333;
  text-shadow: 0 1px 0 rgba(255,255,255,.7);
}
.skeu-dropdown-role {
  font-size: 11px;
  color: #777;
  text-shadow: 0 1px 0 rgba(255,255,255,.5);
}

.skeu-dropdown-section { padding: 4px; }

.skeu-menu-btn {
  width: 100%;
  text-align: left;
  padding: 8px 12px;
  font-size: 12px;
  color: #444;
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: 5px;
  background: none;
  border: none;
  cursor: pointer;
  text-shadow: 0 1px 0 rgba(255,255,255,.6);
  transition: all 0.1s ease;
}
.skeu-menu-btn:hover {
  background: linear-gradient(180deg, #6a5aed 0%, #4a3cc9 100%);
  color: #fff;
  text-shadow: 0 -1px 0 rgba(0,0,0,.2);
}
.skeu-menu-btn-danger { color: #c0392b; }
.skeu-menu-btn-danger:hover {
  background: linear-gradient(180deg, #e74c3c 0%, #c0392b 100%);
  color: #fff;
}

.dropdown-enter-active { animation: dropIn 0.12s ease; }
.dropdown-leave-active { transition: opacity 0.1s ease; }
.dropdown-leave-to { opacity: 0; }
@keyframes dropIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
