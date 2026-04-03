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
    if (ok) emit('success')
    else error.value = true
  } catch { error.value = true }
  finally { loading.value = false }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        class="fixed inset-0 z-[9999] flex items-center justify-center"
        @click.self="emit('close')"
      >
        <div class="modal-backdrop" @click="emit('close')" />
        <div class="skeu-login-card">
          <button @click="emit('close')" class="skeu-close">×</button>
          <h3 class="skeu-login-title">Logga in</h3>
          <input
            v-model="username"
            placeholder="Användarnamn"
            class="skeu-input"
            @keydown.enter="submit"
          />
          <input
            v-model="password"
            type="password"
            placeholder="Lösenord"
            class="skeu-input"
            @keydown.enter="submit"
          />
          <p v-if="error" class="skeu-error">Fel användarnamn eller lösenord</p>
          <button @click="submit" :disabled="loading" class="skeu-submit">
            {{ loading ? '...' : 'Logga in' }}
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,.45);
  backdrop-filter: blur(4px);
}

.skeu-login-card {
  position: relative;
  width: 300px;
  padding: 28px 24px 24px;
  border-radius: 14px;
  background: linear-gradient(180deg, #f7f7f7 0%, #e4e4e4 100%);
  border: 1px solid #fff;
  box-shadow: 0 1px 0 rgba(255,255,255,.6) inset, 0 8px 32px rgba(0,0,0,.3), 0 1px 3px rgba(0,0,0,.15);
}

.skeu-close {
  position: absolute;
  top: 10px;
  right: 12px;
  font-size: 18px;
  line-height: 1;
  color: #999;
  background: none;
  border: none;
  cursor: pointer;
}
.skeu-close:hover { color: #555; }

.skeu-login-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin: 0 0 16px;
  text-shadow: 0 1px 0 rgba(255,255,255,.8);
}

.skeu-input {
  width: 100%;
  margin-bottom: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 13px;
  color: #333;
  outline: none;
  background: linear-gradient(180deg, #e8e8e8 0%, #fff 4px);
  border: 1px solid #aaa;
  box-shadow: 0 1px 3px rgba(0,0,0,.08) inset;
}
.skeu-input:focus {
  border-color: #6a5aed;
  box-shadow: 0 1px 3px rgba(0,0,0,.08) inset, 0 0 0 2px rgba(106,90,237,.2);
}

.skeu-error {
  font-size: 12px;
  color: #c0392b;
  margin: 0 0 8px;
  text-shadow: 0 1px 0 rgba(255,255,255,.5);
}

.skeu-submit {
  width: 100%;
  padding: 9px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
  margin-top: 4px;
  border: 1px solid rgba(0,0,0,.2);
  background: linear-gradient(180deg, #6a5aed 0%, #4a3cc9 100%);
  box-shadow: 0 1px 0 rgba(255,255,255,.25) inset, 0 2px 6px rgba(59,47,186,.35);
  text-shadow: 0 -1px 0 rgba(0,0,0,.2);
  transition: all 0.15s ease;
}
.skeu-submit:hover {
  background: linear-gradient(180deg, #7b6cf5 0%, #5544d4 100%);
}
.skeu-submit:active {
  background: linear-gradient(180deg, #4a3cc9 0%, #3b2fba 100%);
  box-shadow: 0 1px 3px rgba(0,0,0,.2) inset;
}
.skeu-submit:disabled { opacity: 0.5; cursor: default; }

.modal-enter-active { transition: opacity 0.18s ease; }
.modal-leave-active { transition: opacity 0.15s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
