import { computed } from 'vue'
import { useStore } from './useStore'
import { useToday } from './useToday'
import type { Event, Task } from '../types'

export interface Notification {
  type: 'unassigned' | 'late-withdrawal'
  event: Event
  task: Task
  message: string
}

export function useNotifications() {
  const { db, assignments, effectiveTasks, memberContactId, isAdmin } = useStore()
  const { todayStr } = useToday()

  // Monday of current week
  const weekStart = computed(() => {
    const d = new Date(todayStr.value + 'T00:00:00')
    const day = d.getDay()
    d.setDate(d.getDate() - ((day + 6) % 7))
    return fmt(d)
  })

  const weekEnd = computed(() => {
    const d = new Date(weekStart.value + 'T00:00:00')
    d.setDate(d.getDate() + 6)
    return fmt(d)
  })

  function fmt(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  // Find the "Ledare" task
  const leaderTask = computed(() => db.tasks.find(t => t.name === 'Ledare'))

  function findLeader(eventId: number): number | null {
    if (!leaderTask.value) return null
    const asgn = assignments[eventId]?.[leaderTask.value.id]
    if (asgn?.type === 'contact' && asgn.ids?.length) return asgn.ids[0]
    return null
  }

  // Which contact IDs should see notifications?
  // - task.responsibleId for that task
  // - leader on the event (fallback)
  // - admin sees all
  function shouldNotify(task: Task, eventId: number): boolean {
    const myId = memberContactId.value
    if (isAdmin.value) return true
    if (!myId) return false
    if (task.responsibleId === myId) return true
    const leader = findLeader(eventId)
    if (leader === myId && !task.responsibleId) return true
    return false
  }

  // Unassigned tasks this week
  const unassignedNotifications = computed<Notification[]>(() => {
    const notes: Notification[] = []
    const weekEvents = db.events.filter(e => e.date >= weekStart.value && e.date <= weekEnd.value)
    for (const ev of weekEvents) {
      const tasks = effectiveTasks(ev)
      for (const tid of tasks) {
        const task = db.tasks.find(t => t.id === tid)
        if (!task || task.teamTask || task.locked) continue
        if (assignments[ev.id]?.[tid]) continue
        if (!shouldNotify(task, ev.id)) continue
        notes.push({
          type: 'unassigned',
          event: ev,
          task,
          message: `${task.name} saknas på ${ev.title} (${ev.date})`,
        })
      }
    }
    return notes
  })

  // Late withdrawals this week
  const withdrawalNotifications = computed<Notification[]>(() => {
    const notes: Notification[] = []
    const withdrawals = db.lateWithdrawals || []
    for (const w of withdrawals) {
      const ev = db.events.find(e => e.id === w.eventId)
      if (!ev || ev.date < weekStart.value || ev.date > weekEnd.value) continue
      const task = db.tasks.find(t => t.id === w.taskId)
      if (!task) continue
      if (!shouldNotify(task, ev.id)) continue
      const who = db.contacts.find(c => c.id === w.contactId)?.name || 'Någon'
      notes.push({
        type: 'late-withdrawal',
        event: ev,
        task,
        message: `${who} avanmälde sig från ${task.name} på ${ev.title} (${ev.date}) med kort varsel`,
      })
    }
    return notes
  })

  const allNotifications = computed(() => [...unassignedNotifications.value, ...withdrawalNotifications.value])
  const notificationCount = computed(() => allNotifications.value.length)

  return { allNotifications, notificationCount, unassignedNotifications, withdrawalNotifications }
}
