# Mötesplanering

![](./screenshots/Screenshot%202026-03-28%20at%2022.31.49.png)

A lightweight event scheduling and volunteer management system built for churches and small organizations. Single-page admin UI with a JSON file backend — no database required.

## Features

- **Event management** — list, calendar (month/week/year), and schedule views
- **Volunteer scheduling** — assign people or teams to tasks per event
- **Auto-distribute** — round-robin teams or people across future events
- **Email reminders** — automated personal reminders and group emails via cron
- **Slideshow** — fullscreen week overview for lobby displays
- **Nameplates** — fullscreen name/role display per task
- **Sunday roster** — mobile-friendly roster view for the day's events
- **Monthly newsletter** — generate and publish HTML calendar via SFTP
- **iCal feeds** — per-person calendar subscription URLs
- **Theming** — configurable accent color across the entire UI
- **Viewer mode** — read-only public access with stripped contact details
- **Backups** — daily automated JSON snapshots

## Quick start

```bash
git clone <repo-url>
cd motesplanering
cp data.sample.json data_prod.json
cp .env.example .env        # edit with your credentials
npm install
npm start
```

Open http://localhost:3000. Without credentials configured, the app runs in open mode.

### Docker

```bash
cp data.sample.json data_prod.json
cp .env.example .env        # edit with your credentials
docker compose up -d
```

## Configuration

Create a `.env` file:

```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secret
```

SMTP, SFTP, cron schedules, and organization details are configured in the admin UI under Settings.

## Architecture

```
server.js              Node.js HTTP server, API, cron, email, SFTP
index.html             Single-page app (HTML + inline CSS)
data_prod.json         Database (JSON file)

js/
  state.js             Global state, tab config, helpers
  init.js              Auth, routing, data loading
  tabs.js              Tab switching, filtering, rendering
  core.js              Context menus, modals, keyboard shortcuts
  events.js            Event CRUD, propagation
  schedule.js          Schedule grid, auto-distribute
  calendar.js          Month/week/year calendar views
  categories.js        Category management with colors
  teams.js             Team board with drag-drop
  sidebar.js           Detail panels for all record types
  mailbot.js           Email preview, nameplates, sunday roster
  slides.js            Slideshow with week overview
  export.js            Monthly newsletter generation
  generate.js          Recurring event generator
  settings.js          Settings UI, cron admin, theming

lib/
  shared.js            Pure utilities (date, roster resolution)
  email-builder.js     Email HTML generation
  export-builder.js    Newsletter HTML generation
```

## API

All endpoints under `/api/`. Write operations require admin auth (Basic).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/` | Full database (stripped for non-admin) |
| GET | `/api/:key` | Single collection |
| PUT | `/api/:key?v=VERSION` | Update collection (optimistic locking) |
| DELETE | `/api/:key` | Delete collection |
| GET | `/api/auth-check` | Check admin credentials |
| GET | `/api/cal/:slug.ics` | iCal feed per contact |
| GET | `/api/cron` | List cron jobs |
| POST | `/api/cron/run` | Trigger cron job |
| POST | `/api/cron/reload` | Reload cron schedules |
| POST | `/api/send-email` | Send single email |
| POST | `/api/publish` | Publish newsletter via SFTP |
| POST | `/upload` | Upload image file |

## Viewer mode

Unauthenticated users get read-only access with contacts stripped to names only (no email/phone). The UI shows only output views: Slides, Nameplates, Sunday roster.

Admins can log in via the "Logga in" button to access the full admin interface.

## Dependencies

- **Required:** Node.js
- **Optional:** `nodemailer` (email), `node-cron` (scheduled jobs), `ssh2-sftp-client` (SFTP publishing)

```bash
npm install                    # installs all optional deps
```

## License

MIT
