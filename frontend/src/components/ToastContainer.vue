<script setup lang="ts">
import { useToast } from '../composables/useToast'
const { toasts } = useToast()

const bgColor = (type: string) =>
  type === 'error' ? 'bg-red-500' : type === 'warn' ? 'bg-amber-500' : 'bg-emerald-500'
</script>

<template>
  <Teleport to="body">
    <div class="fixed bottom-5 right-5 z-[10000] flex flex-col gap-2">
      <TransitionGroup name="toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          :class="[bgColor(t.type), 'text-white px-4 py-2.5 rounded-lg text-sm shadow-lg max-w-sm']"
        >
          {{ t.message }}
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active { animation: toastIn 0.2s cubic-bezier(0.34, 1.2, 0.64, 1); }
.toast-leave-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.toast-leave-to { opacity: 0; transform: translateY(8px); }
@keyframes toastIn {
  from { opacity: 0; transform: translateY(8px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
</style>
