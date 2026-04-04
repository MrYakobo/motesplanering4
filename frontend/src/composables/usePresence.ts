import { ref, onMounted } from 'vue'

const sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36)
const onlineCount = ref(0)
const onlineUsers = ref<{ name: string; role: string }[]>([])
let started = false

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  const auth = localStorage.getItem('authHeader')
  const token = localStorage.getItem('memberToken')
  if (auth) h['Authorization'] = auth
  if (token) h['X-Member-Token'] = token
  return h
}

async function ping() {
  try {
    const res = await fetch('/api/presence', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ sessionId }),
    })
    if (res.ok) {
      const data = await res.json()
      onlineCount.value = data.count
      onlineUsers.value = data.online
    }
  } catch {}
}

export function usePresence() {
  onMounted(() => {
    if (!started) {
      started = true
      ping()
      setInterval(ping, 30000)
    }
  })
  return { onlineCount, onlineUsers }
}
