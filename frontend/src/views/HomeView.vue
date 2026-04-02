<script setup lang="ts">
import { useStore } from '../composables/useStore'
const { db } = useStore()
const orgName = () => db.settings?.orgName || 'Mötesplanering'
</script>

<template>
  <div class="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] text-white p-10">
    <h1 class="text-5xl font-extrabold tracking-tight mb-2">{{ orgName() }}</h1>
    <p class="text-sm text-white/40">Mötesplanering & volontärschema</p>
  </div>
</template>
