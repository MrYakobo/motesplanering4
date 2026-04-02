<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import {
  ChevronsUpDown
} from 'lucide-vue-next'

const props = defineProps<{
  scrollContainer: HTMLElement | null
  targetSelector: string
}>()

const emit = defineEmits<{ click: [] }>()

const direction = ref<'above' | 'below' | 'visible'>('below')

function update() {
  const container = props.scrollContainer
  if (!container) return
  const target = container.querySelector(props.targetSelector) as HTMLElement
  if (!target) { direction.value = 'below'; return }

  const cRect = container.getBoundingClientRect()
  const tRect = target.getBoundingClientRect()

  if (tRect.bottom < cRect.top) direction.value = 'above'
  else if (tRect.top > cRect.bottom) direction.value = 'below'
  else direction.value = 'visible'
}

let observer: MutationObserver | null = null

onMounted(() => {
  update()
  props.scrollContainer?.addEventListener('scroll', update, { passive: true })
  // Also watch for DOM changes (e.g. route switch re-renders content)
  if (props.scrollContainer) {
    observer = new MutationObserver(update)
    observer.observe(props.scrollContainer, { childList: true, subtree: true })
  }
})

onUnmounted(() => {
  props.scrollContainer?.removeEventListener('scroll', update)
  observer?.disconnect()
})

function onClick() {
  emit('click')
}
</script>

<template>
  <button
    v-show="direction !== 'visible'"
    @click="onClick"
    class="absolute bottom-4 right-4 bg-accent text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg cursor-pointer hover:bg-accent-hover transition-colors z-20 border-none"
  >
    <ChevronsUpDown class="inline size-4" />
    Gå till idag
  </button>
</template>
