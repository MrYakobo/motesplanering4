export interface Event {
  id: number
  date: string
  time: string
  title: string
  category: string
  description: string
  infoLink: string
  promoSlides: string[]
  expectedTasks: number[]
  volunteers: number
}

export interface Contact {
  id: number
  name: string
  email: string
  phone: string
}

export interface Task {
  id: number
  name: string
  teamTask: boolean
  mailbot: boolean
  phrase: string
  description?: string
  manual?: string
  responsibleId?: number | null
  locked?: boolean
}

export interface Team {
  id: number
  taskId: number
  number: number
  members: number[]
}

export interface Category {
  name: string
  color: string
  hidden?: boolean
  defaultTasks?: number[]
}

export interface Assignment {
  type: 'contact' | 'team'
  ids?: number[]
  id?: number
}

export type Assignments = Record<number, Record<number, Assignment>>

export interface CronJob {
  id: string
  name: string
  schedule: string
  action: string
  daysAhead?: number
  enabled: boolean
}

export interface AppSettings {
  orgName?: string
  orgLogo?: string
  baseUrl?: string
  accentColor?: string
  cronJobs?: CronJob[]
  smtp?: {
    host: string
    port: number
    secure: boolean
    user: string
    pass: string
    from: string
  }
  sftp?: {
    host: string
    port: number
    username: string
    privateKey: string
    remotePath: string
  }
}

export interface RecurringEntry {
  title: string
  time: string
  category?: string
  filter?: 'ODD' | 'EVEN'
  expectedTasks?: number[]
  promoSlides?: string[]
  infoLink?: string
}

export type RecurringPatterns = Record<string, RecurringEntry[]>

export interface GlobalSlide {
  url: string
  label: string
  active: boolean
}

export interface SlideBackground {
  color: string
  image: string
}

export interface LateWithdrawal {
  eventId: number
  taskId: number
  contactId: number
  timestamp: string
}

export interface Database {
  events: Event[]
  contacts: Contact[]
  tasks: Task[]
  teams: Team[]
  categories: Category[]
  schedules: Record<string, Record<string, Assignment>>
  recurring_events: RecurringPatterns
  globalSlides: GlobalSlide[]
  slideLogo: string
  slideBackground: SlideBackground
  settings: AppSettings
  lateWithdrawals?: LateWithdrawal[]
  _version: number
}

export type TabId =
  | 'events' | 'contacts' | 'tasks' | 'teams'
  | 'categories' | 'schema' | 'slides' | 'export'
  | 'mailbot' | 'namnskyltar' | 'sunday' | 'home'

export type EventView = 'list' | 'calendar' | 'week' | 'year'

export type UserRole = 'admin' | 'member' | 'viewer'
