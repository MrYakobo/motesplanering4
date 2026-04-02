<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from '../composables/useStore'
import { useCategories } from '../composables/useCategories'
import { useToast } from '../composables/useToast'
import RecordModal from './RecordModal.vue'
import { CalendarPlus, Copy } from 'lucide-vue-next'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { db } = useStore()
const { catStyle } = useCategories()
const { show: toast } = useToast()

function slugifyCategory(name: string) {
  return (name || '').toLowerCase().replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

const publicCategories = computed(() => db.categories.filter(c => !c.hidden))

function icalUrl(catName: string) {
  return location.origin + '/api/cal/cat/' + slugifyCategory(catName) + '.ics'
}
function webcalUrl(catName: string) {
  return icalUrl(catName).replace(/^https?:/, 'webcal:')
}
function copyUrl(catName: string) {
  navigator.clipboard.writeText(icalUrl(catName))
  toast('Länk kopierad!')
}
</script>

<template>
  <RecordModal :open="open" title="Prenumerera på kategori" @close="emit('close')">
    <p class="text-sm text-gray-600 mb-4">Välj en kategori att prenumerera på i din kalenderapp.</p>
    <div v-if="publicCategories.length === 0" class="text-sm text-gray-400 py-4">Inga kategorier finns.</div>
    <div class="space-y-3">
      <div v-for="cat in publicCategories" :key="cat.name" class="border border-gray-200 rounded-lg p-3">
        <div class="flex items-center gap-2 mb-2">
          <span class="inline-block px-2 py-0.5 rounded-full text-xs font-semibold" :style="catStyle(cat.name)">{{ cat.name }}</span>
          <span class="flex-1" />
          <a :href="webcalUrl(cat.name)" class="inline-flex items-center gap-1 text-xs text-accent no-underline hover:underline px-2 py-1 border border-accent/30 rounded-md">
            <CalendarPlus :size="12" /> Öppna
          </a>
          <button @click="copyUrl(cat.name)" class="text-gray-400 hover:text-gray-600 bg-transparent border border-gray-200 rounded-md p-1 cursor-pointer transition-colors" title="Kopiera länk">
            <Copy :size="12" />
          </button>
        </div>
        <input :value="icalUrl(cat.name)" readonly @click="($event.target as HTMLInputElement).select()" class="w-full text-[11px] bg-gray-50 text-gray-500 border border-gray-200 rounded px-2 py-1 outline-none" />
      </div>
    </div>
  </RecordModal>
</template>
