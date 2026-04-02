<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { useApi } from '../composables/useApi'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; success: [] }>()

const { login } = useApi()
const username = ref('')
const password = ref('')
const error = ref(false)
const loading = ref(false)

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') { e.stopPropagation(); emit('close') }
}
watch(() => props.open, (v) => {
  if (v) window.addEventListener('keydown', onKeydown)
  else window.removeEventListener('keydown', onKeydown)
})
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

async function submit() {
  error.value = false
  loading.value = true
  try {
    const ok = await login(username.value, password.value)
    if (ok) {
      emit('success')
    } else {
      error.value = true
    }
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
        @click.self="emit('close')"
      >
        <div class="bg-white rounded-xl p-8 w-80 shadow-2xl relative">
          <button
            @click="emit('close')"
            class="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-xl leading-none bg-transparent border-none cursor-pointer"
          >×</button>
          <h3 class="text-base font-semibold mb-4">Logga in</h3>
          <input
            v-model="username"
            placeholder="Användarnamn"
            class="w-full mb-2 border border-gray-300 rounded-md px-2.5 py-2 text-sm outline-none focus:border-accent"
            @keydown.enter="submit"
          />
          <input
            v-model="password"
            type="password"
            placeholder="Lösenord"
            class="w-full mb-4 border border-gray-300 rounded-md px-2.5 py-2 text-sm outline-none focus:border-accent"
            @keydown.enter="submit"
          />
          <p v-if="error" class="text-red-500 text-xs mb-2">Fel användarnamn eller lösenord</p>
          <button
            @click="submit"
            :disabled="loading"
            class="w-full bg-accent text-white rounded-md py-2 text-sm font-medium cursor-pointer hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {{ loading ? '...' : 'Logga in' }}
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active { transition: opacity 0.18s ease; }
.modal-leave-active { transition: opacity 0.15s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
