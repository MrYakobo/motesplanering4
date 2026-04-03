<script setup lang="ts">
import { watch, ref, nextTick, onUnmounted } from 'vue'
import { X } from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
  title: string
}>()

const emit = defineEmits<{ close: [] }>()

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') { e.stopPropagation(); emit('close') }
}

const bodyRef = ref<HTMLElement | null>(null)

watch(() => props.open, (v) => {
  if (v) {
    window.addEventListener('keydown', onKeydown)
    nextTick(() => {
      setTimeout(() => {
        const input = bodyRef.value?.querySelector('input, textarea, select') as HTMLElement
        input?.focus()
      }, 50)
    })
  } else {
    window.removeEventListener('keydown', onKeydown)
  }
})

onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center"
        @click.self="emit('close')"
      >
        <div class="modal-backdrop" @click="emit('close')" />
        <div class="skeu-modal">
          <div class="skeu-modal-header">
            <h3 class="skeu-modal-title">{{ title }}</h3>
            <button @click="emit('close')" class="skeu-modal-close">
              <X :size="14" />
            </button>
          </div>
          <div ref="bodyRef" class="skeu-modal-body">
            <slot />
          </div>
          <div v-if="$slots.footer" class="skeu-modal-footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,.4);
  backdrop-filter: blur(4px);
}

.skeu-modal {
  position: relative;
  width: 100%;
  max-width: 560px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin: 0 16px;
  border-radius: 12px;
  background: linear-gradient(180deg, #f5f5f5 0%, #e6e6e6 100%);
  border: 1px solid #fff;
  box-shadow: 0 1px 0 rgba(255,255,255,.5) inset, 0 8px 32px rgba(0,0,0,.28), 0 1px 3px rgba(0,0,0,.12);
}

.skeu-modal-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  flex-shrink: 0;
  background: linear-gradient(180deg, #e8e8e8 0%, #d4d4d4 100%);
  border-bottom: 1px solid #bbb;
  box-shadow: 0 1px 0 rgba(255,255,255,.4) inset;
}

.skeu-modal-title {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: #333;
  margin: 0;
  text-shadow: 0 1px 0 rgba(255,255,255,.7);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skeu-modal-close {
  width: 22px;
  height: 22px;
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  cursor: pointer;
  border: 1px solid transparent;
  background: transparent;
  transition: all 0.1s ease;
}
.skeu-modal-close:hover {
  color: #333;
  background: linear-gradient(180deg, #fff 0%, #e8e8e8 100%);
  border-color: #aaa;
  box-shadow: 0 1px 0 rgba(255,255,255,.7) inset, 0 1px 2px rgba(0,0,0,.06);
}

.skeu-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  min-height: 300px;
}

.skeu-modal-footer {
  padding: 10px 16px;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-shrink: 0;
  border-top: 1px solid #bbb;
  background: linear-gradient(180deg, #e0e0e0 0%, #d0d0d0 100%);
  box-shadow: 0 1px 0 rgba(255,255,255,.3) inset;
}

.modal-enter-active { transition: opacity 0.18s ease; }
.modal-leave-active { transition: opacity 0.15s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-active .skeu-modal { transition: transform 0.2s cubic-bezier(0.34, 1.2, 0.64, 1); }
.modal-leave-active .skeu-modal { transition: transform 0.15s ease; }
.modal-enter-from .skeu-modal { transform: translateY(12px) scale(0.98); }
.modal-leave-to .skeu-modal { transform: translateY(8px) scale(0.98); }
</style>
