<script setup lang="ts">
import RecordModal from './RecordModal.vue'

defineProps<{
  open: boolean
  title: string
  message: string
  warning?: string
  confirmLabel?: string
  danger?: boolean
}>()

const emit = defineEmits<{ confirm: []; cancel: [] }>()
</script>

<template>
  <RecordModal :open="open" :title="title" min-height="auto" @close="emit('cancel')">
    <p class="text-sm text-[#555] mb-2">{{ message }}</p>
    <p v-if="warning" class="text-xs text-red-500 mb-4">{{ warning }}</p>
    <div class="flex gap-2 justify-end">
      <button @click="emit('cancel')" class="skeu-btn-primary" style="background: var(--skeu-gradient-seg); color: #555; border-color: #aaa;">
        Avbryt
      </button>
      <button @click="emit('confirm')" :class="danger ? 'skeu-btn-danger' : 'skeu-btn-primary'">
        {{ confirmLabel || 'OK' }}
      </button>
    </div>
  </RecordModal>
</template>
