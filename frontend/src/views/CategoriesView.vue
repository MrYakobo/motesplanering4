<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '../composables/useStore'
import { useToast } from '../composables/useToast'
import { useCategories } from '../composables/useCategories'
import RecordModal from '../components/RecordModal.vue'
import { PlusCircle, Lock } from 'lucide-vue-next'
import type { Category } from '../types'

const { db, persist } = useStore()
const { show: toast } = useToast()
const { catStyle } = useCategories()

const COLORS = [
  { id: 'blue', bg: '#dbeafe', fg: '#1d4ed8' },
  { id: 'green', bg: '#d1fae5', fg: '#065f46' },
  { id: 'amber', bg: '#fef3c7', fg: '#92400e' },
  { id: 'gray', bg: '#f3f4f6', fg: '#6b7280' },
  { id: 'red', bg: '#fee2e2', fg: '#991b1b' },
  { id: 'purple', bg: '#ede9fe', fg: '#5b21b6' },
  { id: 'pink', bg: '#fce7f3', fg: '#9d174d' },
  { id: 'teal', bg: '#ccfbf1', fg: '#115e59' },
]

const editing = ref<Category | null>(null)
const editName = ref('')
const editColor = ref('gray')
const editHidden = ref(false)

const uncategorized = computed(() => {
  const catNames = new Set(db.categories.map(c => c.name))
  return db.events.filter(e => !e.category || !catNames.has(e.category))
})

function openEdit(cat: Category) {
  editing.value = cat
  editName.value = cat.name
  editColor.value = cat.color || 'gray'
  editHidden.value = !!cat.hidden
}

function openNew() {
  editing.value = { name: '', color: 'gray' }
  editName.value = ''
  editColor.value = 'gray'
  editHidden.value = false
}

async function save() {
  if (!editName.value.trim()) return
  const isNew = !editing.value?.name
  if (isNew) {
    db.categories.push({ name: editName.value.trim(), color: editColor.value, hidden: editHidden.value || undefined })
  } else {
    const cat = db.categories.find(c => c.name === editing.value!.name)
    if (cat) {
      if (cat.name !== editName.value.trim()) {
        db.events.forEach(e => { if (e.category === cat.name) e.category = editName.value.trim() })
        await persist('events')
      }
      cat.name = editName.value.trim()
      cat.color = editColor.value
      cat.hidden = editHidden.value || undefined
    }
  }
  await persist('categories')
  editing.value = null
  toast('Kategori sparad')
}

async function remove() {
  if (!editing.value?.name) return
  db.categories = db.categories.filter(c => c.name !== editing.value!.name)
  await persist('categories')
  editing.value = null
  toast('Kategori borttagen')
}

function eventCount(catName: string) {
  return db.events.filter(e => e.category === catName).length
}
</script>

<template>
  <div class="flex-1 overflow-y-auto p-6 bg-gray-50">
    <div class="max-w-lg mx-auto">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-base font-semibold">Kategorier <span class="text-xs font-normal text-gray-400">{{ db.categories.length }} st</span></h2>
        <button @click="openNew" class="flex items-center gap-1 text-accent text-sm cursor-pointer bg-transparent border-none hover:underline">
          <PlusCircle :size="14" /> Ny kategori
        </button>
      </div>

      <!-- Uncategorized warning -->
      <div v-if="uncategorized.length > 0" class="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
        <div class="text-xs font-semibold text-red-800 mb-1">Okategoriserade ({{ uncategorized.length }})</div>
        <div class="flex flex-wrap gap-1">
          <span v-for="e in uncategorized.slice(0, 20)" :key="e.id" class="text-[11px] bg-red-100 text-red-800 px-2 py-0.5 rounded">{{ e.title }}</span>
          <span v-if="uncategorized.length > 20" class="text-[11px] text-red-600">+{{ uncategorized.length - 20 }} till</span>
        </div>
      </div>

      <div class="space-y-2">
        <div
          v-for="cat in db.categories" :key="cat.name"
          @click="openEdit(cat)"
          class="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-3 cursor-pointer hover:border-accent transition-colors"
          :class="{ 'opacity-60': cat.hidden }"
        >
          <span class="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold" :style="catStyle(cat.name)">
            {{ cat.name }}
          </span>
          <Lock v-if="cat.hidden" :size="12" class="text-gray-400" title="Dold i utdata" />
          <span class="text-xs text-gray-400 ml-auto">{{ eventCount(cat.name) }} händelser</span>
        </div>
      </div>
    </div>

    <RecordModal :open="editing !== null" :title="editing?.name || 'Ny kategori'" @close="editing = null">
      <div class="space-y-4">
        <div>
          <label class="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Namn</label>
          <input v-model="editName" type="text" class="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm outline-none focus:border-accent" />
        </div>
        <div>
          <label class="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Färg</label>
          <div class="flex gap-2 flex-wrap">
            <button
              v-for="c in COLORS" :key="c.id"
              @click="editColor = c.id"
              class="w-8 h-8 rounded-full border-2 cursor-pointer transition-transform"
              :style="{ background: c.bg, borderColor: editColor === c.id ? c.fg : 'transparent' }"
              :class="{ 'scale-110': editColor === c.id }"
            />
          </div>
        </div>
        <div>
          <label class="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
            <input type="checkbox" v-model="editHidden" class="accent-accent" />
            Dölj i utdata (slides, månadsblad, söndag)
          </label>
        </div>
      </div>
      <div class="flex gap-2 mt-6 pt-4 border-t border-gray-200">
        <button @click="save" class="bg-accent text-white rounded-md px-4 py-1.5 text-sm cursor-pointer hover:bg-accent-hover transition-colors">Spara</button>
        <span class="flex-1" />
        <button v-if="editing?.name" @click="remove" class="bg-red-500 text-white rounded-md px-4 py-1.5 text-sm cursor-pointer hover:bg-red-600 transition-colors">Ta bort</button>
      </div>
    </RecordModal>
  </div>
</template>
