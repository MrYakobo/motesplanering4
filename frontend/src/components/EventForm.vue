<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { useStore } from '../composables/useStore'
import { useApi } from '../composables/useApi'
import { Upload, X, Plus, Image } from 'lucide-vue-next'
import type { Event } from '../types'

const props = defineProps<{ event: Event }>()
const emit = defineEmits<{ save: [event: Event]; delete: [id: number] }>()

const { db } = useStore()
const api = useApi()

const form = reactive<Event>({ ...props.event })
watch(() => props.event, (e) => Object.assign(form, e))

const uploading = ref(false)

function addPromoUrl() {
  if (!form.promoSlides) form.promoSlides = []
  form.promoSlides.push('')
}

function removePromo(idx: number) {
  form.promoSlides.splice(idx, 1)
}

async function uploadPromoFile(e: globalThis.Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploading.value = true
  try {
    const url = await api.upload(file)
    if (!form.promoSlides) form.promoSlides = []
    form.promoSlides.push(url)
  } catch (err: any) {
    alert('Uppladdning misslyckades: ' + err.message)
  } finally {
    uploading.value = false
    input.value = ''
  }
}

function onSave() {
  // Clean empty promo URLs
  form.promoSlides = (form.promoSlides || []).filter(Boolean)
  emit('save', { ...form })
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Datum</label>
      <input v-model="form.date" type="date" class="field-input" />
    </div>
    <div>
      <label class="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Tid</label>
      <input v-model="form.time" type="time" class="field-input" />
    </div>
    <div>
      <label class="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Titel</label>
      <input v-model="form.title" type="text" class="field-input" />
    </div>
    <div>
      <label class="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Kategori</label>
      <select v-model="form.category" class="field-input">
        <option v-for="cat in db.categories" :key="cat.name" :value="cat.name">{{ cat.name }}</option>
      </select>
    </div>
    <div>
      <label class="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Beskrivning</label>
      <textarea v-model="form.description" rows="2" class="field-input" />
    </div>
    <div>
      <label class="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Infolänk</label>
      <input v-model="form.infoLink" type="url" placeholder="https://…" class="field-input" />
    </div>
    <!-- Promo slides -->
    <div>
      <label class="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Promobilder</label>
      <div v-if="form.promoSlides?.length" class="space-y-2 mb-2">
        <div v-for="(url, idx) in form.promoSlides" :key="idx" class="flex items-center gap-2">
          <img
            v-if="url"
            :src="url"
            class="w-12 h-8 object-cover rounded border border-gray-200 shrink-0"
            @error="($event.target as HTMLImageElement).style.display = 'none'"
          />
          <div v-else class="w-12 h-8 rounded border border-gray-200 bg-gray-100 flex items-center justify-center shrink-0">
            <Image :size="14" class="text-gray-300" />
          </div>
          <input
            v-model="form.promoSlides[idx]"
            type="text"
            placeholder="URL eller ladda upp"
            class="field-input flex-1"
          />
          <button
            @click="removePromo(idx)"
            class="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 bg-transparent border-none cursor-pointer"
          >
            <X :size="14" />
          </button>
        </div>
      </div>
      <div v-else class="text-xs text-gray-400 mb-2">Inga promobilder</div>
      <div class="flex gap-2">
        <label class="inline-flex items-center gap-1 text-xs text-accent cursor-pointer hover:underline">
          <Upload :size="12" />
          <span>{{ uploading ? 'Laddar upp…' : 'Ladda upp' }}</span>
          <input type="file" accept="image/*" class="hidden" @change="uploadPromoFile" :disabled="uploading" />
        </label>
        <button @click="addPromoUrl" class="inline-flex items-center gap-1 text-xs text-accent bg-transparent border-none cursor-pointer hover:underline">
          <Plus :size="12" /> URL
        </button>
      </div>
    </div>
    <div>
      <label class="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Förväntade uppgifter</label>
      <div class="space-y-1">
        <label
          v-for="task in db.tasks"
          :key="task.id"
          class="flex items-center gap-2 px-1.5 py-1 rounded cursor-pointer text-sm text-gray-700 hover:bg-gray-50"
        >
          <input
            type="checkbox"
            :checked="(form.expectedTasks || []).includes(task.id)"
            class="accent-accent"
            @change="
              ($event.target as HTMLInputElement).checked
                ? form.expectedTasks.push(task.id)
                : (form.expectedTasks = form.expectedTasks.filter(id => id !== task.id))
            "
          />
          {{ task.name }}
        </label>
      </div>
    </div>
  </div>

  <div class="flex gap-2 mt-6 pt-4 border-t border-gray-200">
    <button @click="onSave" class="btn-primary">Spara</button>
    <span class="flex-1" />
    <button
      v-if="!props.event._isNew"
      @click="emit('delete', form.id)"
      class="btn-danger"
    >
      Ta bort
    </button>
  </div>
</template>

<style scoped>
@reference "../style.css";
.field-input {
  @apply w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm outline-none
         transition-colors focus:border-accent focus:ring-2 focus:ring-accent/10 bg-gray-50 focus:bg-white;
}
.btn-primary {
  @apply bg-accent text-white border-none rounded-md px-4 py-1.5 text-sm cursor-pointer
         hover:bg-accent-hover transition-colors;
}
.btn-danger {
  @apply bg-red-500 text-white border-none rounded-md px-4 py-1.5 text-sm cursor-pointer
         hover:bg-red-600 transition-colors;
}
</style>
