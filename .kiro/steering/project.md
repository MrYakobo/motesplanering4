---
inclusion: always
---

# Mötesplanering — Project Steering

## About the project

Church volunteer scheduling app. Vue 3 + Tailwind v4 frontend, Node.js backend with JSON file storage. Swedish UI. Skeuomorphic design language.

## Architecture

- `server.js` — Node HTTP server, API, cron, email, SFTP
- `frontend/` — Vue 3 SPA (Vite, TypeScript, Tailwind v4)
- `data_prod.json` — JSON file database (no SQL)
- `lib/shared.js` — Shared utilities (used by both server and legacy frontend)

## Code style preferences

### General
- Write minimal code. No boilerplate, no over-engineering.
- Swedish for all user-facing text. English for code (variable names, comments).
- Don't add tests unless explicitly asked.
- Don't create markdown summary files unless asked.
- Don't commit or push — the user does that.

### CSS & Styling
- Tailwind classes first. Use `@apply` in scoped CSS when needed.
- Skeuomorphic gradients and shadows use CSS variables defined in `style.css` (e.g. `var(--skeu-gradient-primary)`).
- Never duplicate `.skeu-*` classes in scoped styles — they're global in `style.css`.
- Prefer Tailwind over raw CSS values. Only use raw CSS for gradients, inset shadows, and text-shadows that Tailwind can't express.
- Use `@reference "../style.css"` at the top of scoped style blocks that use `@apply` with custom theme values.

### Vue components
- Use `<script setup lang="ts">` exclusively.
- Prefer `readCode` over `readFile` for `.vue` and `.ts` files.
- Use `defineExpose` to share state/methods between parent and child.
- Use Teleport for dropdowns and modals that might be clipped by overflow.
- RecordModal is the standard modal wrapper. Use `ConfirmDialog` for yes/no prompts.
- Use `PersonPicker` for any contact search + select pattern.

### State management
- `useStore()` is the global singleton. Contains db, assignments, role, UI state.
- `effectiveTasks(event)` resolves inherited vs override tasks — always use it instead of `event.expectedTasks` directly.
- Assignments live in a separate reactive object synced to `db.schedules` before persist.

### Routing
- All event views under `/events/...` (calendar, week, year, list).
- Team views under `/teams/:taskId`.
- Member views under `/my/...`.
- Dashboard at `/dashboard` (fullscreen, no sidebar).
- Use `router.push` for navigation, `router.replace` for URL updates that shouldn't create history entries (e.g. day-to-day in week view).

### Server
- Auth: admin (Basic), member (token header/param), viewer (no auth).
- Member API endpoints scoped under `/api/me/...`.
- PII stripping: members see only names for other contacts, full details for self.
- `POST /api/request-login` sends magic link emails.

## Build & verify
- Always run `npm run build` in `frontend/` after changes.
- Use `getDiagnostics` instead of bash for type/lint checking.
- Build must be clean (0 errors) before considering work done.

## UX principles learned from user testing
- Secondary nav (toolbars) is easily missed. Put navigation in the sidebar.
- Sub-items in sidebar (indented) work well for view switching.
- Ghost buttons (dashed border) are good for "add" actions inline with content.
- Confirmation dialogs for destructive actions. Always.
- Auto-focus first input when opening modals.
- Arrow key + enter navigation in search/picker lists.
- Flash/highlight when navigating to a specific item from another view.
- "Today" button should grey out when today is already visible.
- Viewers (unauthenticated) redirect to `/home` unless on a public path.
