<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '../composables/useStore'
import { useToast } from '../composables/useToast'
import { useCategories } from '../composables/useCategories'
import RecordModal from '../components/RecordModal.vue'
import SubscribeModal from '../components/SubscribeModal.vue'
import { PlusCircle, Lock, CalendarPlus } from 'lucide-vue-next'
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
const editDefaultTasks = ref<number[]>([])

const uncategorized = computed(() => {
  const catNames = new Set(db.categories.map(c => c.name))
  return db.events.filter(e => !e.category || !catNames.has(e.category))
})

function openEdit(cat: Category) {
  editing.value = cat
  editName.value = cat.name
  editColor.value = cat.color || 'gray'
  editHidden.value = !!cat.hidden
  editDefaultTasks.value = [...(cat.defaultTasks || [])]
}

function openNew() {
  editing.value = { name: '', color: 'gray' }
  editName.value = ''
  editColor.value = 'gray'
  editHidden.value = false
  editDefaultTasks.value = []
}

async function save() {
  if (!editName.value.trim()) return
  const isNew = !editing.value?.name
  if (isNew) {
    db.categories.push({ name: editName.value.trim(), color: editColor.value, hidden: editHidden.value || undefined, defaultTasks: editDefaultTasks.value })
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
      cat.defaultTasks = editDefaultTasks.value
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

const subscribeOpen = ref(false)
</script>

<template>
  <div class="cat-page">
    <div class="max-w-lg mx-auto">
      <div class="cat-header">
        <h2 class="cat-title">Kategorier <span>{{ db.categories.length }} st</span></h2>
        <div class="flex items-center gap-3">
          <button @click="subscribeOpen = true" class="cat-link-btn">
            <CalendarPlus :size="13" /> Prenumerera
          </button>
          <button @click="openNew" class="cat-add-btn">
            <PlusCircle :size="13" /> Ny kategori
          </button>
        </div>
      </div>

      <!-- Uncategorized warning -->
      <div v-if="uncategorized.length > 0" class="cat-warn">
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
          class="cat-card"
          :class="{ 'opacity-60': cat.hidden }"
        >
          <span class="cat-badge" :style="catStyle(cat.name)">{{ cat.name }}</span>
          <Lock v-if="cat.hidden" :size="12" class="text-gray-400" title="Dold i utdata" />
          <span class="cat-count">{{ eventCount(cat.name) }} händelser</span>
        </div>
      </div>
    </div>

    <RecordModal :open="editing !== null" :title="editing?.name || 'Ny kategori'" @close="editing = null">
      <div class="space-y-4">
        <div>
          <label class="skeu-label">Namn</label>
          <input v-model="editName" type="text" class="skeu-input" />
        </div>
        <div>
          <label class="skeu-label">Färg</label>
          <div class="flex gap-2 flex-wrap">
            <button
              v-for="c in COLORS" :key="c.id"
              @click="editColor = c.id"
              class="color-swatch"
              :style="{ background: c.bg, borderColor: editColor === c.id ? c.fg : 'transparent' }"
              :class="{ 'scale-110': editColor === c.id }"
            />
          </div>
        </div>
        <div>
          <label class="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
            <input type="checkbox" v-model="editHidden" class="accent-[#6a5aed]" />
            Dölj i utdata (slides, månadsblad, söndag)
          </label>
        </div>
        <div>
          <label class="skeu-label">Standarduppgifter</label>
          <p class="text-[10px] text-gray-400 mb-1.5">Uppgifter som ärvs av alla händelser i denna kategori (om inte event har egna)</p>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="task in db.tasks" :key="task.id"
              @click="editDefaultTasks.includes(task.id) ? editDefaultTasks = editDefaultTasks.filter(id => id !== task.id) : editDefaultTasks.push(task.id)"
              class="px-2 py-0.5 text-[11px] rounded-full border cursor-pointer transition-all"
              :class="editDefaultTasks.includes(task.id)
                ? 'bg-accent text-white border-accent'
                : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-accent/40'"
            >
              {{ task.name }}
            </button>
          </div>
        </div>
      </div>
      <div class="flex gap-2 mt-6 pt-4 border-t border-[#ccc]">
        <button @click="save" class="skeu-btn-primary">Spara</button>
        <span class="flex-1" />
        <button v-if="editing?.name" @click="remove" class="skeu-btn-danger">Ta bort</button>
      </div>
    </RecordModal>

    <SubscribeModal :open="subscribeOpen" @close="subscribeOpen = false" />
  </div>
</template>

<style scoped>
.cat-page {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background: linear-gradient(180deg, #ddd 0%, #ccc 100%);
}

.cat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.cat-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  text-shadow: 0 1px 0 rgba(255,255,255,.7);
}
.cat-title span {
  font-size: 11px;
  font-weight: 400;
  color: #888;
}

.cat-link-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #666;
  background: none;
  border: none;
  cursor: pointer;
  text-shadow: 0 1px 0 rgba(255,255,255,.5);
}
.cat-link-btn:hover { color: #4a3cc9; }

.cat-add-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 5px;
  font-size: 12px;
  cursor: pointer;
  color: #fff;
  border: 1px solid rgba(0,0,0,.2);
  background: linear-gradient(180deg, #6a5aed 0%, #4a3cc9 100%);
  box-shadow: 0 1px 0 rgba(255,255,255,.2) inset, 0 1px 2px rgba(59,47,186,.25);
  text-shadow: 0 -1px 0 rgba(0,0,0,.15);
  transition: all 0.12s ease;
}
.cat-add-btn:hover { background: linear-gradient(180deg, #7b6cf5 0%, #5544d4 100%); }

.cat-warn {
  padding: 12px 16px;
  margin-bottom: 16px;
  border-radius: 8px;
  background: linear-gradient(180deg, #fee2e2 0%, #fecaca 100%);
  border: 1px solid #f5a5a5;
  box-shadow: 0 1px 0 rgba(255,255,255,.4) inset, 0 1px 2px rgba(0,0,0,.06);
}

.cat-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.12s ease;
  background: linear-gradient(180deg, #f7f7f7 0%, #eaeaea 100%);
  border: 1px solid #c0c0c0;
  box-shadow: 0 1px 0 rgba(255,255,255,.6) inset, 0 1px 3px rgba(0,0,0,.08);
}
.cat-card:hover {
  background: linear-gradient(180deg, #fff 0%, #f0f0f0 100%);
  border-color: #6a5aed;
  box-shadow: 0 1px 0 rgba(255,255,255,.6) inset, 0 2px 6px rgba(106,90,237,.15);
}

.cat-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid rgba(0,0,0,.08);
  box-shadow: 0 1px 0 rgba(255,255,255,.5) inset;
}

.cat-count {
  font-size: 11px;
  color: #888;
  margin-left: auto;
  text-shadow: 0 1px 0 rgba(255,255,255,.5);
}

/* Form elements inside modal */
.skeu-label {
  display: block;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #666;
  margin-bottom: 4px;
  text-shadow: 0 1px 0 rgba(255,255,255,.7);
}
.skeu-input {
  width: 100%;
  padding: 7px 10px;
  border-radius: 5px;
  font-size: 13px;
  color: #333;
  outline: none;
  background: linear-gradient(180deg, #e4e4e4 0%, #fff 3px);
  border: 1px solid #aaa;
  box-shadow: 0 1px 2px rgba(0,0,0,.06) inset;
}
.skeu-input:focus {
  border-color: #6a5aed;
  box-shadow: 0 1px 2px rgba(0,0,0,.06) inset, 0 0 0 2px rgba(106,90,237,.15);
}
.color-swatch {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2.5px solid transparent;
  cursor: pointer;
  transition: transform 0.1s ease;
  box-shadow: 0 1px 2px rgba(0,0,0,.1), 0 1px 0 rgba(255,255,255,.3) inset;
}
</style>
