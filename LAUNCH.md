# Lansering — Mötesplanering v2

## Status: Redo att gå live ✅

Build: clean, 0 errors. Migration: körd på prod-data. PWA: installbar.

We'll have to think through exactly how to present this in a digestible way.
Most people have the angle of not bothering, just that "i miss my task emails sometimes".

Almost no one is going to want to go back to excel, but there is going to be initial confusion
with using this new system. Additional user testing would be good I think.

Put the static site on pingstkungbacka domain and self-host the API server for now.

---

## Vad som är klart

### UX-förbättringar
- Sidebar-navigation (ersätter top nav) med sub-items för Händelser och Team
- Enhetlig toolbar: Idag | ◀ ▶ | Vecka 14 | sök | vyväljare
- Veckovy: dag-header, off-screen-indikatorer, flash vid navigering
- Månadsvy: ren (inga inline-headers, nav i toolbar)
- Schema: kortvy (f.d. mobilvy) som default på alla skärmar, tabellvy som option
- Team: "Nytt team" i toolbar, ghost-buttons för "Lägg till", bekräftelsedialog vid borttagning
- Modaler: klicka utanför stänger, auto-fokus på input, pil-tangenter + enter i söklistor
- j/k tangentbordsnavigering i vecko/månads/årsvy
- Alla vyer routade och bokmärkbara (`/events/calendar`, `/events/week/2026-04-05`, etc.)

### Datamodell
- `Category.defaultTasks` — uppgifter ärvs till events, inga duplicerade listor
- `Task.description`, `Task.manual`, `Task.responsibleId`, `Task.locked`
- `effectiveTasks()` — central resolution av ärvda vs override-tasks
- `lateWithdrawals` — spårar sena avanmälningar
- Migrationsscript: `node scripts/migrate-category-tasks.js`

### Självservice (medlemmar)
- Mitt schema: se kommande tilldelningar, prenumerera via iCal
- Mina team: gå med/lämna team, se andra medlemmar
- Mitt konto: redigera namn/e-post/telefon (i user menu)
- GDPR: API:t strippar e-post/telefon från andra kontakter för medlemmar

### Infrastruktur
- PWA: manifest, service worker, installbar på hemskärm
- iCal: URL-fält (länk till veckovy), Description ("Du predikar på söndag")
- Presence: "X online" i sidebar
- Server: scoped endpoint för task-ansvarig att redigera manual

### Experimentellt (dolt)
- Platsbank (`/platsbank`) — klar men gömd från nav
- Notifikationssystem (`useNotifications`) — beräknar saknade tilldelningar

---

## Kvarstående innan lansering

### Kritiskt (måste fixas)
1. **Testa member-flödet end-to-end** — logga in med magic link, se schema, byt team, redigera konto. Verifiera att PII-strippning fungerar (andra kontakters e-post/telefon ska inte synas).
2. **Testa admin-flödet** — skapa event, tilldela i schema, verifiera att `effectiveTasks` fungerar korrekt med category defaults.
3. **Kör migration på riktig data** — `node scripts/migrate-category-tasks.js data_prod.json`. Verifiera att events med override behåller sina tasks.
4. **Backup innan deploy** — `cp data_prod.json data_prod.backup.json`

### Bra att ha (kan fixas efter lansering)
5. **Fyll i task-manualer** — description och manual för varje uppgift (Ljud, Bild, etc.)
6. **Sätt responsibleId** — peka ut ansvarig person per uppgift
7. **Testa PWA-installation** — iOS Safari "Lägg till på hemskärm", Android Chrome install prompt
8. **Verifiera iCal-feeds** — öppna en .ics-länk, kolla att URL och Description syns i kalenderappen

---

## Wow-feature: Live Dashboard 🎯

En fullskärms-dashboard för lobbyskärm eller projektor som visar:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│              SÖNDAGSMÖTE · 11:00                            │
│              ─────────────────                              │
│                                                             │
│   🎤 Talare      Anna Svensson                             │
│   👋 Ledare      Bo Karlsson                               │
│   🎵 Musik       Cecilia Lindqvist                         │
│   🔊 Ljud        David Ek                                  │
│   📷 Bild        Eva Nilsson                               │
│   🏠 Värdteam    Team 3                                    │
│   ☕ Caféteam    Team 1                                    │
│                                                             │
│              ── Nästa vecka ──                              │
│                                                             │
│   🎤 Talare      Fredrik Berg                              │
│   👋 Ledare      Greta Holm                                │
│   ...                                                       │
│                                                             │
│         ┌──────────────────────────────┐                    │
│         │  📱 Skanna för att se ditt   │                    │
│         │     schema och anmäla dig    │                    │
│         │                              │                    │
│         │     [QR-KOD till /my]        │                    │
│         │                              │                    │
│         └──────────────────────────────┘                    │
│                                                             │
│  3 lediga platser nästa vecka · motesplanering.example.com  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Varför det blåser folk ur stolen:
- **QR-kod** på skärmen → folk skannar → landar direkt i sitt schema
- **Realtidsuppdatering** — schemat uppdateras live utan refresh
- **"Lediga platser"** — social proof, folk ser att det behövs hjälp
- **Professionellt** — ser ut som en riktig produkt, inte ett kalkylark
- **Zero friction** — ingen app att ladda ner, bara skanna och se

### Implementation:
- Ny route: `/dashboard` (fullscreen, auto-refresh)
- Generera QR-kod client-side (qrcode.js, ~3kb)
- Visa denna vecka + nästa vecka
- Visa lediga platser-räknare
- Auto-rotate mellan events om flera samma dag
- Klocka + datum i hörnet
- Organisationens logo + namn

### Alternativ wow-feature: Drag-and-drop schemaläggning
- Dra personer direkt från en kontaktlista till schema-celler
- Visuell feedback med ghost-preview
- Ångra med Ctrl+Z
- (Mer komplex, mindre "wow" för slutanvändare)

---

## Implementerat: Email Login + Dashboard

### Email-baserad inloggning ✅
- `POST /api/request-login` — tar emot email, skickar magic link
- HomeView: email-formulär för besökare
- Flöde: ange email → få mail med länk → klicka → inloggad
- Avslöjar inte om email finns (svarar alltid "skickat")

### Live Dashboard ✅ (`/dashboard`)
- Fullskärm utan sidebar — för lobbyskärm/projektor
- Denna vecka + nästa vecka med alla tilldelningar
- Tomma platser markerade i rött
- QR-kod → `/home` → email-login → schema
- Klocka, datum, organisationsnamn, lediga platser-räknare

---

## Deploy-checklista

```
□ Backup: cp data_prod.json data_prod.backup.json
□ Migration: node scripts/migrate-category-tasks.js
□ Build: cd frontend && npm run build
□ Starta server: npm start (eller docker compose up -d)
□ Verifiera: öppna i browser, logga in som admin
□ Testa: skapa event, tilldela i schema, kolla veckovy
□ Testa member: öppna magic link, se schema, byt team
□ Testa PWA: "Lägg till på hemskärm" på mobil
□ Testa iCal: öppna .ics-länk i kalenderapp
□ Meddela användare: skicka magic links
```
