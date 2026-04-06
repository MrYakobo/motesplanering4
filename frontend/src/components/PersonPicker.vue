<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  contacts: { id: number; name: string }[]
  placeholder?: string
}>()

const emit = defineEmits<{ pick: [id: number] }>()

const search = ref('')
const idx = ref(0)

const filtered = computed(() => {
  const q = search.value.toLowerCase()
  return props.contacts.filter(c => !q || c.name.toLowerCase().includes(q))
})

watch(search, () => { idx.value = 0 })

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') { e.preventDefault(); idx.value = Math.min(idx.value + 1, filtered.value.length - 1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); idx.value = Math.max(idx.value - 1, 0) }
  else if (e.key === 'Enter') {
    e.preventDefault()
    const c = filtered.value[idx.value]
    if (c) emit('pick', c.id)
  }
}

function initials(name: string) {
  const parts = name.split(' ').filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (parts[0] || '?').slice(0, 2).toUpperCase()
}

defineExpose({ search })
</script>

<template>
  <div>
    <input
      v-model="search"
      type="text"
      :placeholder="placeholder || 'Sök person…'"
      class="w-full border border-gray-300 rounded-md px-2.5 py-2 text-sm outline-none focus:border-accent mb-3"
      @keydown="onKeydown"
    />
    <div class="max-h-96 overflow-y-auto space-y-0.5">
      <button
        v-for="(c, i) in filtered" :key="c.id"
        @click="emit('pick', c.id)"
        @mouseenter="idx = i"
        class="flex items-center gap-2 w-full bg-transparent border-none py-2 px-2 text-sm text-gray-700 cursor-pointer rounded-md transition-colors text-left"
        :class="i === idx ? 'bg-accent/10 text-accent' : 'hover:bg-gray-50'"
      >
        <div class="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 bg-gradient-to-b from-[#6a5aed] to-[#3b2fba]">
          {{ initials(c.name) }}
        </div>
        {{ c.name }}
      </button>
      <div v-if="filtered.length === 0" class="text-xs text-gray-400 text-center py-4">Inga resultat</div>
    </div>
  </div>
</template>
