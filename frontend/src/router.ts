import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/events' },
  { path: '/home', component: () => import('./views/HomeView.vue') },
  { path: '/settings', component: () => import('./views/SettingsView.vue') },
  { path: '/events', component: () => import('./views/EventsView.vue') },
  { path: '/contacts', component: () => import('./views/ContactsView.vue') },
  { path: '/tasks', component: () => import('./views/TasksView.vue') },
  { path: '/teams', component: () => import('./views/TeamsView.vue') },
  { path: '/schema', component: () => import('./views/SchemaView.vue') },
  { path: '/categories', component: () => import('./views/CategoriesView.vue') },
  { path: '/slides', component: () => import('./views/SlidesView.vue') },
  { path: '/export', component: () => import('./views/ExportView.vue') },
  { path: '/mailbot', component: () => import('./views/MailbotView.vue') },
  { path: '/namnskyltar', component: () => import('./views/NamnskyltarView.vue') },
  { path: '/sunday', component: () => import('./views/SundayView.vue') },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
})
