<script setup lang="ts">
import { watch, onUnmounted } from 'vue'
import { X } from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
  title: string
}>()

const emit = defineEmits<{
  close: []
}>()

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.stopPropagation()
    emit('close')
  }
}

watch(() => props.open, (v) => {
  if (v) window.addEventListener('keydown', onKeydown)
  else window.removeEventListener('keydown', onKeydown)
})

onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/35 backdrop-blur-sm"
        @click.self="emit('close')"
      >
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-xl h-[85vh] flex flex-col overflow-hidden mx-4">
          <div class="flex items-center px-5 py-3 border-b border-gray-200 shrink-0">
            <h3 class="flex-1 text-sm font-semibold truncate">{{ title }}</h3>
            <button
              @click="emit('close')"
              class="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <X :size="16" />
            </button>
          </div>
          <div class="flex-1 overflow-y-auto p-5">
            <slot />
          </div>
          <div v-if="$slots.footer" class="px-5 py-3 border-t border-gray-200 flex gap-2 justify-end shrink-0">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active { transition: opacity 0.18s ease; }
.modal-leave-active { transition: opacity 0.15s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-active > div { transition: transform 0.2s cubic-bezier(0.34, 1.2, 0.64, 1); }
.modal-leave-active > div { transition: transform 0.15s ease; }
.modal-enter-from > div { transform: translateY(12px) scale(0.98); }
.modal-leave-to > div { transform: translateY(8px) scale(0.98); }
</style>
