<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useStore } from '../composables/useStore'
import { useApi } from '../composables/useApi'
import { Settings, LogOut } from 'lucide-vue-next'

const { role, isAdmin, db, memberContactId } = useStore()
const { logout } = useApi()

const open = ref(false)
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

const roleLabel = computed(() =>
  isAdmin.value ? 'Administratör' : 'Medlem'
)

function onClickOutside(e: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    open.value = false
  }
}

onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => document.removeEventListener('click', onClickOutside))

const emit = defineEmits<{ openSettings: [] }>()
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
          <button
            v-if="isAdmin"
            @click="emit('openSettings'); open = false"
            class="menu-btn"
          >
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
