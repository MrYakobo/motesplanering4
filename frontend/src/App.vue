<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useStore } from './composables/useStore'
import AppNav from './components/AppNav.vue'
import ToastContainer from './components/ToastContainer.vue'

const { loading, loadApp, isViewer } = useStore()
const router = useRouter()

onMounted(async () => {
  await loadApp()
  if (isViewer.value && router.currentRoute.value.path === '/events') {
    router.replace('/home')
  }
})
</script>

<template>
  <div class="flex flex-col h-screen overflow-hidden bg-gray-100 text-gray-900">
    <AppNav v-if="!loading" />
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <p class="text-gray-400 text-sm">Laddar...</p>
    </div>
    <router-view v-else class="flex-1 overflow-hidden" />
    <ToastContainer />
  </div>
</template>
