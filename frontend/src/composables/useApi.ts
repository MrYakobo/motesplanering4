import { ref } from 'vue'
import type { Database, UserRole } from '../types'

const authHeader = ref(localStorage.getItem('authHeader') || '')
const memberToken = ref(
  new URLSearchParams(location.search).get('token') ||
  localStorage.getItem('memberToken') || ''
)

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (authHeader.value) h['Authorization'] = authHeader.value
  if (memberToken.value) h['X-Member-Token'] = memberToken.value
  return h
}

export function useApi() {
  async function fetchDb(): Promise<Database> {
    const res = await fetch('/api/', { headers: getHeaders() })
    if (!res.ok) throw new Error(`Server error (${res.status})`)
    return res.json()
  }

  async function checkRole(): Promise<{ role: UserRole; contactId?: number }> {
    const res = await fetch('/api/me', { headers: getHeaders() })
    return res.json()
  }

  async function login(user: string, pass: string): Promise<boolean> {
    const header = 'Basic ' + btoa(user + ':' + pass)
    const res = await fetch('/api/auth-check', {
      headers: { Authorization: header },
    })
    const data = await res.json()
    if (!data.ok) return false
    authHeader.value = header
    localStorage.setItem('authHeader', header)
    return true
  }

  function logout() {
    authHeader.value = ''
    memberToken.value = ''
    localStorage.removeItem('authHeader')
    localStorage.removeItem('memberToken')
    location.reload()
  }

  async function save(key: string, data: unknown, version: number): Promise<number> {
    const url = `/api/${key}?v=${version}`
    const res = await fetch(url, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    })
    if (res.status === 401) throw new Error('unauthorized')
    if (res.status === 409) {
      const err = await res.json()
      throw new Error(err.message || 'Conflict')
    }
    if (!res.ok) throw new Error(`Save failed (${res.status})`)
    const result = await res.json()
    return result.version ?? version
  }

  return { fetchDb, checkRole, login, logout, save, authHeader, memberToken }
}
