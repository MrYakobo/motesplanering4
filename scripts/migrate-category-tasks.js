#!/usr/bin/env node
/**
 * Migration: Move expectedTasks defaults to Category.defaultTasks
 *
 * For each category, finds the most common expectedTasks combination
 * among its events, sets it as category.defaultTasks, and clears
 * expectedTasks on events that match the default.
 *
 * Also adds new fields to tasks: description, manual, responsibleId, locked.
 *
 * Usage: node scripts/migrate-category-tasks.js [path-to-data.json]
 * Default: data_prod.json
 */

const fs = require('fs')
const path = require('path')

const dataPath = process.argv[2] || path.join(__dirname, '..', 'data_prod.json')
const backupPath = dataPath.replace('.json', `.backup-${Date.now()}.json`)

console.log(`Reading: ${dataPath}`)
const raw = fs.readFileSync(dataPath, 'utf8')
const db = JSON.parse(raw)

// Backup
fs.writeFileSync(backupPath, raw)
console.log(`Backup: ${backupPath}`)

// --- Migrate categories ---
const categories = db.categories || []
const events = db.events || []

for (const cat of categories) {
  const catEvents = events.filter(e => e.category === cat.name)
  if (catEvents.length === 0) {
    cat.defaultTasks = []
    continue
  }

  // Count expectedTasks combinations
  const combos = {}
  for (const ev of catEvents) {
    const key = JSON.stringify((ev.expectedTasks || []).sort((a, b) => a - b))
    combos[key] = (combos[key] || 0) + 1
  }

  // Find most common
  let bestKey = '[]'
  let bestCount = 0
  for (const [key, count] of Object.entries(combos)) {
    if (count > bestCount) { bestKey = key; bestCount = count }
  }

  const defaultTasks = JSON.parse(bestKey)
  cat.defaultTasks = defaultTasks

  console.log(`  ${cat.name}: defaultTasks=${bestKey} (${bestCount}/${catEvents.length} events)`)

  // Clear expectedTasks on events that match the default
  let cleared = 0
  for (const ev of catEvents) {
    const evKey = JSON.stringify((ev.expectedTasks || []).sort((a, b) => a - b))
    if (evKey === bestKey) {
      ev.expectedTasks = []
      cleared++
    }
  }
  console.log(`    Cleared ${cleared} events, ${catEvents.length - cleared} overrides kept`)
}

// --- Migrate tasks ---
const tasks = db.tasks || []
for (const task of tasks) {
  if (task.description === undefined) task.description = ''
  if (task.manual === undefined) task.manual = ''
  if (task.responsibleId === undefined) task.responsibleId = null
  if (task.locked === undefined) task.locked = false
}
console.log(`  Tasks: added new fields to ${tasks.length} tasks`)

// --- Add lateWithdrawals ---
if (!db.lateWithdrawals) {
  db.lateWithdrawals = []
  console.log('  Added lateWithdrawals array')
}

// Write
fs.writeFileSync(dataPath, JSON.stringify(db, null, 2))
console.log(`\nDone. Written to ${dataPath}`)
