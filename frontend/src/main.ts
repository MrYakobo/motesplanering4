import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import './style.css'

// Prevent pinch-to-zoom on iOS Safari (ignores viewport meta)
document.addEventListener('gesturestart', e => e.preventDefault())
document.addEventListener('gesturechange', e => e.preventDefault())

createApp(App).use(router).mount('#app')

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}
