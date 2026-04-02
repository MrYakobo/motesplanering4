<script setup lang="ts">
import { ref } from 'vue'
import { useStore } from '../composables/useStore'
import { useApi } from '../composables/useApi'
import { useToast } from '../composables/useToast'
import { Upload, X, Plus, Image } from 'lucide-vue-next'

const { db, persist } = useStore()
const api = useApi()
const { show: toast } = useToast()

const uploading = ref<string | null>(null) // 'slide' | 'logo' | 'bg' | null

const bgColors = ['#111','#1a1a2e','#0f172a','#18181b','#1e293b','#27272a','#0c0a09','#020617']

async function uploadFile(purpose: 'slide' | 'logo' | 'bg', event: globalThis.Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploading.value = purpose
  try {
    const url = await api.upload(file)
    if (purpose === 'slide') {
      if (!db.globalSlides) db.globalSlides = []
      db.globalSlides.push({ url, label: '', active: true })
      await persist('globalSlides')
    } else if (purpose === 'logo') {
      db.slideLogo = url
      await persist('slideLogo')
    } else if (purpose === 'bg') {
      db.slideBackground = { color: '', image: url }
      await persist('slideBackground')
    }
  } catch (err: any) {
    toast('Uppladdning misslyckades: ' + err.message, 'error')
  } finally {
    uploading.value = null
    input.value = ''
  }
}

function addSlideUrl() {
  const url = prompt('Bild-URL:')
  if (!url) return
  if (!db.globalSlides) db.globalSlides = []
  db.globalSlides.push({ url, label: '', active: true })
  persist('globalSlides')
}

async function toggleSlide(idx: number, active: boolean) {
  db.globalSlides[idx].active = active
  await persist('globalSlides')
}

async function removeSlide(idx: number) {
  db.globalSlides.splice(idx, 1)
  await persist('globalSlides')
}

async function removeLogo() {
  db.slideLogo = ''
  await persist('slideLogo')
}

async function setBgColor(color: string) {
  db.slideBackground = { color, image: '' }
  await persist('slideBackground')
}

async function removeBgImage() {
  db.slideBackground = { color: db.slideBackground?.color || '#111', image: '' }
  await persist('slideBackground')
}
</script>

<template>
  <div class="w-72 bg-white border-l border-gray-200 overflow-y-auto shrink-0 text-sm">
    <!-- Background -->
    <div class="p-4 border-b border-gray-100">
      <h4 class="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Bakgrund</h4>
      <div class="flex gap-1 items-center flex-wrap mb-2">
        <button
          v-for="c in bgColors" :key="c"
          @click="setBgColor(c)"
          class="w-6 h-6 rounded border-2 cursor-pointer p-0 transition-colors"
          :style="{ background: c, borderColor: db.slideBackground?.color === c && !db.slideBackground?.image ? 'var(--accent)' : 'transparent' }"
        />
        <label class="w-6 h-6 rounded border-2 border-dashed border-gray-300 cursor-pointer inline-flex items-center justify-center" title="Ladda upp bakgrundsbild">
          <Image :size="12" class="text-gray-400" />
          <input type="file" accept="image/*" class="hidden" @change="uploadFile('bg', $event)" />
        </label>
      </div>
      <div v-if="db.slideBackground?.image" class="flex items-center gap-2">
        <img :src="db.slideBackground.image" class="h-8 w-14 object-cover rounded border border-gray-200" />
        <button @click="removeBgImage" class="text-[11px] text-gray-500 hover:text-red-500 bg-transparent border-none cursor-pointer">Ta bort</button>
      </div>
    </div>

    <!-- Logo -->
    <div class="p-4 border-b border-gray-100">
      <h4 class="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Logotyp</h4>
      <p class="text-xs text-gray-400 mb-2">Visas i nedre högra hörnet.</p>
      <div v-if="db.slideLogo" class="flex items-center gap-2 mb-2">
        <img :src="db.slideLogo" class="h-8 rounded bg-[#111] p-1" />
        <button @click="removeLogo" class="text-[11px] text-gray-500 hover:text-red-500 bg-transparent border-none cursor-pointer">Ta bort</button>
      </div>
      <label class="inline-flex items-center gap-1 text-xs text-accent cursor-pointer hover:underline">
        <Upload :size="12" />
        {{ db.slideLogo ? 'Byt logotyp' : 'Ladda upp logotyp' }}
        <input type="file" accept="image/*" class="hidden" @change="uploadFile('logo', $event)" />
      </label>
    </div>

    <!-- Global slides -->
    <div class="p-4">
      <h4 class="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Globala slides</h4>
      <p class="text-xs text-gray-400 mb-3">Bilder som visas i slideshowen oavsett vecka.</p>
      <div v-if="db.globalSlides?.length" class="space-y-2 mb-3">
        <div v-for="(s, idx) in db.globalSlides" :key="idx" class="relative rounded-md overflow-hidden border border-gray-200">
          <img
            :src="s.url"
            class="w-full aspect-video object-cover block transition-opacity"
            :class="s.active ? 'opacity-100' : 'opacity-30'"
            @error="($event.target as HTMLImageElement).style.display = 'none'"
          />
          <input
            type="checkbox"
            :checked="s.active"
            @change="toggleSlide(idx, ($event.target as HTMLInputElement).checked)"
            class="absolute top-1.5 left-1.5 w-4 h-4 cursor-pointer accent-accent"
          />
          <button
            @click="removeSlide(idx)"
            class="absolute top-1 right-1 bg-black/50 text-white border-none rounded p-0.5 cursor-pointer hover:bg-black/70 transition-colors"
          >
            <X :size="12" />
          </button>
        </div>
      </div>
      <div v-else class="text-xs text-gray-400 mb-3">Inga globala slides ännu</div>
      <div class="flex gap-2">
        <label class="inline-flex items-center gap-1 text-xs text-accent cursor-pointer hover:underline">
          <Upload :size="12" />
          {{ uploading === 'slide' ? 'Laddar upp…' : 'Ladda upp' }}
          <input type="file" accept="image/*" class="hidden" @change="uploadFile('slide', $event)" :disabled="uploading === 'slide'" />
        </label>
        <button @click="addSlideUrl" class="inline-flex items-center gap-1 text-xs text-accent bg-transparent border-none cursor-pointer hover:underline">
          <Plus :size="12" /> URL
        </button>
      </div>
    </div>
  </div>
</template>
