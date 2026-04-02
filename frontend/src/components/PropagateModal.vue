<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import RecordModal from './RecordModal.vue'
import type { Event } from '../types'

const props = defineProps<{
  open: boolean
  event: Event
  originalTitle: string
  changedFields: string[]
  futureCount: number
}>()

const emit = defineEmits<{
  close: []
  apply: [fields: string[]]
  skip: []
}>()

const fieldLabels: Record<string, string> = {
  title: 'Titel',
  category: 'Kategori',
  description: 'Beskrivning',
  infoLink: 'Infolänk',
  expectedTasks: 'Förväntade uppgifter',
  promoSlides: 'Promo-bilder',
}

const checked = ref<Record<string, boolean>>({})

watch(() => props.open, (v) => {
  if (v) {
    checked.value = {}
    props.changedFields.forEach(f => { checked.value[f] = true })
  }
})

const selectedFields = computed(() =>
  props.changedFields.filter(f => checked.value[f])
)

function fieldDisplay(key: string): string {
  const val = (props.event as any)[key]
  if (Array.isArray(val)) return `(${val.length} st)`
  return val || '(tom)'
}
</script>

<template>
  <RecordModal :open="open" title="Uppdatera framtida händelser?" @close="emit('skip')">
    <div class="space-y-4">
      <p class="text-sm text-gray-700">
        Du ändrade <strong>"{{ originalTitle }}"</strong>.
        Det finns <strong>{{ futureCount }}</strong>
        framtida händelse{{ futureCount > 1 ? 'r' : '' }} med samma titel.
        <br />Vill du uppdatera dem också?
      </p>

      <div class="space-y-1.5">
        <label
          v-for="f in changedFields" :key="f"
          class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer px-2 py-1 rounded hover:bg-gray-50"
        >
          <input type="checkbox" v-model="checked[f]" class="accent-accent" />
          <span class="font-medium">{{ fieldLabels[f] || f }}</span>
          <span class="text-gray-400 text-xs ml-1">→ {{ fieldDisplay(f) }}</span>
        </label>
      </div>

      <div class="flex gap-2 pt-2 border-t border-gray-200">
        <button
          @click="emit('apply', selectedFields)"
          :disabled="selectedFields.length === 0"
          class="bg-accent text-white rounded-md px-4 py-1.5 text-sm cursor-pointer hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Uppdatera {{ futureCount }} händelse{{ futureCount > 1 ? 'r' : '' }}
        </button>
        <button
          @click="emit('skip')"
          class="border border-gray-300 text-gray-700 rounded-md px-4 py-1.5 text-sm cursor-pointer hover:bg-gray-50 transition-colors"
        >
          Bara denna
        </button>
      </div>
    </div>
  </RecordModal>
</template>
