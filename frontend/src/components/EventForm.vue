<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { useStore } from '../composables/useStore'
import { useApi } from '../composables/useApi'
import { useCategories } from '../composables/useCategories'
import { Upload, X, Plus, Image, ChevronDown } from 'lucide-vue-next'
import type { Event } from '../types'

const props = defineProps<{ event: Event }>()
const emit = defineEmits<{ save: [event: Event]; delete: [id: number] }>()

const { db } = useStore()
const api = useApi()
const { catStyle } = useCategories()

const form = reactive<Event>({ ...props.event })
watch(() => props.event, (e) => Object.assign(form, e))

const uploading = ref(false)
const showAdvanced = ref(false)

function addPromoUrl() {
  if (!form.promoSlides) form.promoSlides = []
  form.promoSlides.push('')
}
function removePromo(idx: number) { form.promoSlides.splice(idx, 1) }

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
  } finally { uploading.value = false; input.value = '' }
}

function onSave() {
  form.promoSlides = (form.promoSlides || []).filter(Boolean)
  emit('save', { ...form })
}

const isExisting = () => db.events.some(e => e.id === form.id)
</script>

<template>
  <!-- Title — main focus, enter to save -->
  <input
    v-model="form.title"
    type="text"
    placeholder="Händelsenamn…"
    class="ef-title"
    @keydown.enter="onSave"
    autofocus
  />

  <!-- Date + time inline -->
  <div class="ef-datetime">
    <input v-model="form.date" type="date" class="ef-input-sm" />
    <input v-model="form.time" type="time" class="ef-input-sm" />
  </div>

  <!-- Category pills -->
  <div class="ef-cats">
    <button
      v-for="cat in db.categories" :key="cat.name"
      @click="form.category = cat.name"
      class="ef-cat-pill"
      :class="{ 'ef-cat-active': form.category === cat.name }"
      :style="form.category === cat.name ? catStyle(cat.name) : {}"
    >{{ cat.name }}</button>
  </div>

  <!-- Advanced toggle -->
  <button @click="showAdvanced = !showAdvanced" class="ef-advanced-toggle">
    <ChevronDown :size="12" :class="{ 'rotate-180': showAdvanced }" style="transition: transform 0.2s" />
    {{ showAdvanced ? 'Dölj detaljer' : 'Visa detaljer' }}
  </button>

  <div v-if="showAdvanced" class="ef-advanced">
    <div>
      <label class="ef-label">Beskrivning</label>
      <textarea v-model="form.description" rows="2" class="ef-input" />
    </div>
    <div>
      <label class="ef-label">Infolänk</label>
      <input v-model="form.infoLink" type="url" placeholder="https://…" class="ef-input" />
    </div>
    <div>
      <label class="ef-label">Promobilder</label>
      <div v-if="form.promoSlides?.length" class="space-y-2 mb-2">
        <div v-for="(url, idx) in form.promoSlides" :key="idx" class="flex items-center gap-2">
          <img v-if="url" :src="url" class="w-10 h-7 object-cover rounded border border-gray-200 shrink-0" @error="($event.target as HTMLImageElement).style.display = 'none'" />
          <div v-else class="w-10 h-7 rounded border border-gray-200 bg-gray-100 flex items-center justify-center shrink-0"><Image :size="12" class="text-gray-300" /></div>
          <input v-model="form.promoSlides[idx]" type="text" placeholder="URL" class="ef-input flex-1" />
          <button @click="removePromo(idx)" class="p-1 rounded text-gray-400 hover:text-red-500 bg-transparent border-none cursor-pointer"><X :size="12" /></button>
        </div>
      </div>
      <div class="flex gap-2">
        <label class="ef-link-btn"><Upload :size="11" /><span>{{ uploading ? '…' : 'Ladda upp' }}</span><input type="file" accept="image/*" class="hidden" @change="uploadPromoFile" :disabled="uploading" /></label>
        <button @click="addPromoUrl" class="ef-link-btn"><Plus :size="11" /> URL</button>
      </div>
    </div>
    <div>
      <label class="ef-label">Förväntade uppgifter</label>
      <div class="flex flex-wrap gap-1">
        <label
          v-for="task in db.tasks" :key="task.id"
          class="ef-task-pill"
          :class="{ 'ef-task-active': (form.expectedTasks || []).includes(task.id) }"
        >
          <input
            type="checkbox"
            :checked="(form.expectedTasks || []).includes(task.id)"
            class="hidden"
            @change="($event.target as HTMLInputElement).checked ? form.expectedTasks.push(task.id) : (form.expectedTasks = form.expectedTasks.filter(id => id !== task.id))"
          />
          {{ task.name }}
        </label>
      </div>
    </div>
  </div>

  <!-- Actions — pinned at bottom via modal footer -->
  <div class="ef-actions">
    <button @click="onSave" class="ef-save">Spara</button>
    <span class="flex-1" />
    <button v-if="isExisting()" @click="emit('delete', form.id)" class="ef-delete">Ta bort</button>
  </div>
</template>

<style scoped>
.ef-title {
  width: 100%;
  font-size: 18px;
  font-weight: 600;
  padding: 8px 0;
  border: none;
  border-bottom: 2px solid #ddd;
  outline: none;
  background: transparent;
  color: #333;
  margin-bottom: 12px;
}
.ef-title:focus { border-color: #6a5aed; }
.ef-title::placeholder { color: #bbb; }

.ef-datetime {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.ef-input-sm {
  flex: 1;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 5px;
  color: #555;
  outline: none;
  background: linear-gradient(180deg, #e8e8e8 0%, #fff 3px);
  border: 1px solid #bbb;
  box-shadow: 0 1px 2px rgba(0,0,0,.04) inset;
}
.ef-input-sm:focus { border-color: #6a5aed; }

.ef-cats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}
.ef-cat-pill {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid #ccc;
  background: linear-gradient(180deg, #f4f4f4 0%, #e8e8e8 100%);
  color: #666;
  box-shadow: 0 1px 0 rgba(255,255,255,.5) inset;
  text-shadow: 0 1px 0 rgba(255,255,255,.5);
  transition: all 0.12s ease;
}
.ef-cat-pill:hover { border-color: #999; }
.ef-cat-active {
  border-color: rgba(0,0,0,.1) !important;
  box-shadow: 0 1px 0 rgba(255,255,255,.3) inset, 0 1px 3px rgba(0,0,0,.1);
  font-weight: 600;
}

.ef-advanced-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #888;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  margin-bottom: 10px;
}
.ef-advanced-toggle:hover { color: #6a5aed; }

.ef-advanced {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 4px;
}

.ef-label {
  display: block;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #888;
  margin-bottom: 4px;
}
.ef-input {
  width: 100%;
  font-size: 13px;
  padding: 6px 8px;
  border-radius: 5px;
  color: #333;
  outline: none;
  background: linear-gradient(180deg, #e8e8e8 0%, #fff 3px);
  border: 1px solid #bbb;
  box-shadow: 0 1px 2px rgba(0,0,0,.04) inset;
}
.ef-input:focus { border-color: #6a5aed; }

.ef-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: #6a5aed;
  background: none;
  border: none;
  cursor: pointer;
}
.ef-link-btn:hover { text-decoration: underline; }

.ef-task-pill {
  padding: 3px 10px;
  border-radius: 10px;
  font-size: 11px;
  cursor: pointer;
  border: 1px solid #ccc;
  background: linear-gradient(180deg, #f4f4f4 0%, #e8e8e8 100%);
  color: #666;
  transition: all 0.1s ease;
}
.ef-task-active {
  background: linear-gradient(180deg, #6a5aed 0%, #4a3cc9 100%);
  color: #fff;
  border-color: rgba(0,0,0,.15);
  box-shadow: 0 1px 0 rgba(255,255,255,.2) inset;
}

.ef-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  padding-top: 12px;
  margin-top: 12px;
  border-top: 1px solid #ccc;
}
.ef-save {
  padding: 6px 20px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  color: #fff;
  border: 1px solid rgba(0,0,0,.2);
  background: linear-gradient(180deg, #6a5aed 0%, #4a3cc9 100%);
  box-shadow: 0 1px 0 rgba(255,255,255,.2) inset, 0 1px 3px rgba(59,47,186,.3);
  text-shadow: 0 -1px 0 rgba(0,0,0,.15);
}
.ef-save:hover { background: linear-gradient(180deg, #7b6cf5 0%, #5544d4 100%); }
.ef-save:active { background: linear-gradient(180deg, #4a3cc9 0%, #3b2fba 100%); box-shadow: 0 1px 2px rgba(0,0,0,.15) inset; }
.ef-delete {
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  color: #fff;
  border: 1px solid rgba(0,0,0,.15);
  background: linear-gradient(180deg, #e74c3c 0%, #c0392b 100%);
  box-shadow: 0 1px 0 rgba(255,255,255,.15) inset;
  text-shadow: 0 -1px 0 rgba(0,0,0,.15);
}
.ef-delete:hover { background: linear-gradient(180deg, #f05545 0%, #d44332 100%); }
</style>
