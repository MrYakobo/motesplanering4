# TODO

## Scope philosophy

Build it if the feature **reads or writes scheduling data** — who's doing what, when, and making sure they know. Delegate everything else to tools people already use (WhatsApp, email, phone).

- ✅ "Anna, you're on sound next Sunday" → **ours** (assignment + notification)
- ❌ "Anna, can you swap with Bo?" → **WhatsApp** (human conversation)
- ✅ "Team meeting moved to 19:30" → **ours** (event data changed → auto-notify)
- ❌ "Here's the setlist" as a chat message → **WhatsApp/email**

## Mobile responsiveness

- [ ] **iOS Safari calendar height bug** — month view doesn't fit in one screen on iOS. The 6th week row is hidden behind the bottom browser chrome. `window.visualViewport.height`, `window.innerHeight`, `100dvh`, `-webkit-fill-available`, and `position:fixed` with explicit pixel heights all tried — none correctly account for the iOS Safari address bar + bottom toolbar. Debug overlay is in place (`#cal-debug` in `fitCalendarHeight()`). Next step: read the debug values on a real device and figure out what iOS is actually reporting vs what's visible. Remove debug overlay after fixing.
- [ ] Hamburger menu for nav on small screens
- [ ] Sidebar as full-width overlay on mobile instead of fixed 360px
- [ ] Modals full-width on mobile
- [ ] Touch targets min 44px (buttons, cells, popover items)
- [ ] Schedule view: card-based layout on mobile instead of horizontal table
- [ ] Person/team popovers: full-width bottom sheet on mobile
- [ ] Test all views at 375px (iPhone SE)

## Volunteer self-service

- [ ] **Discoverability & zero-friction access**
  - [ ] Personal magic link in reminder emails (`/my?token=abc`) — one tap to "my schedule"
  - [ ] PWA support (manifest + service worker) — "Add to home screen" prompt
  - [ ] QR code generator for sunday roster URL (print for physical boards)
- [ ] **Passwordless authentication**
  - [ ] Magic links via email (one-time login link, requires SMTP)
  - [ ] Google login (match email to contact)
  - [ ] Facebook login (match email to contact)
  - [ ] Admin emails list in settings (replaces `.env` long-term)
- [ ] **Accept/decline** — volunteers respond to assignments from the email or app
- [ ] **Blockout dates** — volunteers mark when they're unavailable
- [ ] **Self-scheduling / signup sheets** — volunteers pick open slots themselves
- [ ] **Scheduling preferences** — preferred frequency (weekly, biweekly, monthly)
- [ ] **"My schedule" view** — personal dashboard showing upcoming assignments

## Communication (delegate, don't rebuild)

Don't build a chat app. Instead, make it easy to reach people from within the app:

- [ ] **"Message this person" links** — mailto/tel/WhatsApp links on contact profiles
- [ ] **"Message this team" link** — open WhatsApp group or email thread for a team
- [ ] **Push notifications** — notify volunteers of schedule changes (via web push, not in-app chat)
- [ ] **Accept/decline links in reminder emails** — actionable emails, not just informational

## Landing page

- [ ] Public landing page at `/` when not logged in
- [ ] Organization name/logo from settings, hero section, feature overview
- [ ] "Logga in" and "Se schema" buttons
- [ ] Mobile-friendly

## Scheduling intelligence

- [ ] **Conflict detection** — warn when same person is assigned to overlapping events
- [ ] **Preference-aware auto-schedule** — round-robin that respects blockouts and frequency preferences
- [ ] **Needed positions** — define how many people each position needs, track unfilled
- [ ] **Expected tasks as category defaults** — with per-event override

## GDPR & data retention

- [ ] Flag contacts with no assignment in the last 2 years
- [ ] Admin UI: show inactive contacts with "last active" date, bulk archive/delete
- [ ] Configurable retention period in settings (default 24 months)
- [ ] Notification before deletion ("will be removed in 30 days")
- [ ] Export personal data per contact (data portability)
- [ ] Anonymize instead of hard-delete (keep history, remove PII)

## Data integrity

- [ ] Input validation on PUT endpoints (reject malformed data)
- [ ] Validate event dates, contact emails, required fields
- [ ] Prevent duplicate contacts (same name + email)

## Quality of life

- [ ] Undo last action (short action history)
- [ ] Bulk edit/delete events
- [ ] Drag-and-drop reorder tasks
- [ ] Email template customization in settings
- [ ] CSV/Excel export of schedule data
- [ ] Audit log (who changed what, when)
- [ ] File attachments on events (documents, notes)

## Backup improvements

- [ ] Off-site backup option (S3, FTP, or email)
- [ ] Backup retention policy (keep last N days)
- [ ] Manual backup/restore from admin UI

## i18n

- [ ] Extract Swedish strings to a language file
- [ ] English as second language
- [ ] Language picker in settings

## DevOps

- [ ] HTTPS setup guide (Caddy/nginx reverse proxy)
- [ ] pm2 ecosystem config
- [ ] Health check endpoint (`GET /api/health`)
- [ ] Rate limiting on write endpoints

## Architecture refactoring

- [ ] **UI component helpers** — extract repeated patterns into a `UI` class:
  ```js
  UI.badge(text, style)
  UI.field(label, inputHtml)
  UI.card(header, body)
  UI.table(headers, rows)
  UI.button(label, onclick, opts)
  UI.popover(trigger, content)
  UI.modal(title, body, footer)
  ```
  No framework — just a class with static methods returning HTML strings. Replaces inline style soup in template literals with readable, reusable calls.
- [ ] **Cache `ac()` and friends** — read CSS variables once on theme change, not per render call
- [ ] **Granular saves** — `PUT /api/events/42` instead of replacing the whole collection
- [ ] **Extract inline CSS** — move the 500+ lines from `index.html` into `style.css`
- [ ] **Error boundaries** — try/catch around render functions so one bad record doesn't break the UI
- [ ] **Reduce global state** — pass data explicitly instead of relying on `db`, `assignments`, `currentTab` globals

## Out of scope (delegate to existing tools)

- ❌ In-app messaging / team chat → WhatsApp, Signal, email
- ❌ Song management / chord charts → Planning Center Services, OnSong
- ❌ Rehearsal tools / audio player → Spotify, YouTube, RehearsalPack
- ❌ CCLI reporting → Planning Center or manual
- ❌ Live service run sheet → ProPresenter, EasyWorship

## Planning Center comparison

### What they have that we don't (yet)
- Volunteer accept/decline and self-scheduling
- Blockout dates and scheduling preferences
- Mobile app with push notifications
- Multiple service types per ministry
- Team leader permissions (manage own team without full admin)
- Worship planning (songs, run sheets, rehearsal)

### What we have that they don't
- Free and self-hosted — no per-person pricing, full data ownership
- JSON file backend — zero infrastructure, runs anywhere Node runs
- Slideshow output — built-in lobby display
- Nameplate display — fullscreen name/role for event day
- Sunday roster — mobile-friendly dark-themed view
- Monthly newsletter — auto-generated and published via SFTP
- Simulated date — test any date
- No build step — single HTML file, vanilla JS
