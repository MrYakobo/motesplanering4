import { ref } from 'vue'

export interface Toast {
  id: number
  message: string
  type: 'ok' | 'error' | 'warn'
}

const toasts = ref<Toast[]>([])
let nextId = 0

export function useToast() {
  function show(message: string, type: Toast['type'] = 'ok') {
    const id = nextId++
    toasts.value.push({ id, message, type })
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id)
    }, 3500)
  }

  return { toasts, show }
}
