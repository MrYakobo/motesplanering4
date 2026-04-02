<script setup lang="ts">
import { useCategories } from '../composables/useCategories'

const props = defineProps<{ name: string }>()
const { catStyle } = useCategories()
</script>

<template>
  <span
    class="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
    :style="catStyle(props.name)"
  >
    {{ props.name || '—' }}
  </span>
</template>
