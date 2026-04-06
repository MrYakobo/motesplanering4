# Platsbank — Design

## Koncept

En platsbank där volontärer själva kan se vilka behov som finns, läsa på om
uppgifter, och anmäla sig. Admins skapar händelser med behov som vanligt —
platsbanken exponerar luckorna som en självservice-vy.

Kommunikation sker utanför appen. Inga påminnelsemail. Volontärer prenumererar
på sitt schema via iCal (redan byggt) och besöker platsbanken via magic link.

```
┌─────────────────────────────────────────────────────────────┐
│                      NUVARANDE FLÖDE                        │
│                                                             │
│   Admin skapar händelse ──► Admin tilldelar personer        │
│                              manuellt i schemat             │
│                                    │                        │
│                                    ▼                        │
│                           Mailbot skickar                   │
│                           påminnelse                        │
│                                    │                        │
│                                    ▼                        │
│                           Volontär ser sin                  │
│                           tilldelning i appen               │
│                           eller i kalendern                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      NYTT FLÖDE (platsbank)                 │
│                                                             │
│   Admin skapar händelse ──► Otilldelade platser             │
│   (tasks ärvs från          syns i platsbanken              │
│    kategori eller override)                                 │
│                                    │                        │
│                                    ▼                        │
│                           Volontär öppnar appen             │
│                           (magic link / bokmärke)           │
│                                    │                        │
│                                    ▼                        │
│                           Bläddrar platsbanken              │
│                           Läser manual för uppgift          │
│                                    │                        │
│                                    ▼                        │
│                           Anmäler sig till plats            │
│                                    │                        │
│                                    ▼                        │
│                           Schemat uppdateras                │
│                           iCal-feed uppdateras              │
│                           automatiskt                       │
└─────────────────────────────────────────────────────────────┘
```

## Datamodell — ändringar

### Uppgifter (tasks) på kategorinivå

Idag har varje event en `expectedTasks`-array. I praktiken är den nästan
alltid identisk för alla events i samma kategori.

Flytta default-tasks till Category. Event behåller `expectedTasks` som
override för undantagsfall.

```
  Category (utökad)
    name: "Söndag"
    color: "blue"
  + defaultTasks: [1,2,3,4,5,6,7]

  Event (oförändrat)
    expectedTasks: []  ◄── tom = ärv från kategori
    (eller [1,2,3,4,5,8] för override)
```

Resolutionslogik:

```
  effectiveTasks(event) =
      event.expectedTasks.length > 0
        ? event.expectedTasks          ◄── explicit override
        : category.defaultTasks || []  ◄── ärv från kategori
```

### Task — utökad

```json
{
  "id": 4,
  "name": "Ljud",
  "teamTask": false,
  "mailbot": true,
  "phrase": "kör ljud",
  "description": "Sköter ljudmixern under mötet",
  "manual": "## Före mötet\n1. Kom 30 min innan\n2. Slå på mixerbordet...",
  "responsibleId": 42,
  "locked": false
}
```

Nya fält:
- `description` — kort beskrivning (visas i platsbanken)
- `manual` — markdown-guide (renderas i uppgiftsguide-modal)
- `responsibleId` — kontakt-ID för uppgiftsansvarig (se nedan)
- `locked` — om true, döljs från platsbanken (admin-only tilldelning)

Borttaget:
- ~~`skillLevel`~~ — onödigt, skapar barriärer

### Uppgiftsansvarig (responsibleId)

Varje task kan ha en ansvarig person (`responsibleId`). Denna person:
- Ansvarar för att manualen är uppdaterad
- Får en notifikation på sin hemvy om uppgiften saknar tilldelning
  på en händelse som infaller samma vecka (kontrolleras på måndagar)
- Visas i uppgiftsguiden som kontaktperson

Om ingen `responsibleId` är satt, faller notifikationen tillbaka till
kontakter med rollen "Ledare" (om en sådan task/roll finns i systemet).

```
  NOTIFIKATIONSLOGIK (körs måndag morgon eller vid sidladdning)

  För varje event denna vecka:
    För varje task i effectiveTasks(event):
      Om task INTE tilldelad i schedules[eventId][taskId]:
        Om task.responsibleId finns:
          → Lägg till notifikation för den personen
        Annars om det finns en "Ledare"-kontakt/roll:
          → Lägg till notifikation för ledaren
```

Notifikationer visas på hemvyn, inte som email/push.

### Category — utökad

```
  Category
    name
    color
    hidden
  + defaultTasks: number[]
```

### Settings — utökat

```
  settings.platsbank.enabled: boolean
  settings.platsbank.selfAssign: boolean
```

## Beslut (besvarade frågor)

- **Anmälan till teamTasks på special-events?** Nej. Teamuppgifter hanteras
  via teamcykeln, inte platsbanken.
- **Max anmälningar per person per vecka?** Obegränsat.
- **Kan admin låsa platser?** Ja. `task.locked = true` döljer uppgiften
  från platsbanken (t.ex. "Talare").
- **Events utan expectedTasks i platsbanken?** Ja, de visas i sidofältet
  som informationsposter (t.ex. "Planeringsdag").
- **Anmälan: en per plats?** Ja, först till kvarn. En person per task-slot.
- **Avanmälan: fritt eller tidsgräns?** Fritt, men om avanmälan sker
  inom 24h före eventet visas en varning och en notifikation skickas
  till uppgiftsansvarig + ledare.
- **"Ledare"-fallback?** Ledare är en task som tilldelas på söndagar.
  Systemet hittar ledaren genom att slå upp vem som är tilldelad
  "Ledare"-tasken på det aktuella eventet (eller närmaste söndag).
  Ledare bör vara ett mer framträdande fält vid skapande av event.
- **Notifikationer: bara hemvyn?** Nej, även en badge i sidofältet
  på "Hem" så att ansvariga ser att det finns varningar.
- **Platsbanken: tidshorisont?** Närmaste 4 veckorna.
- **Manual-redigering?** Admin + uppgiftsansvarig (responsibleId)
  kan redigera manualen. Kräver en scoped API-endpoint.
- **Migration?** Engångs-script, inte automatisk vid serverstart.

## Avanmälan — flöde

```
  Volontär klickar [Avanmäl]
         │
         ▼
  ┌─ Mer än 24h till event?
  │    JA ──► Ta bort assignment direkt
  │           Toast: "Du är avanmäld"
  │
  │    NEJ ──► Visa bekräftelsedialog:
  │            "Händelsen är inom 24 timmar.
  │             Om du avanmäler dig skickas en
  │             notifikation till ansvarig och
  │             ledare om att platsen är tom."
  │                    │
  │                    ▼
  │            [Avanmäl ändå]  [Avbryt]
  │                    │
  │                    ▼
  │            Ta bort assignment
  │            Skapa notifikation till:
  │              1. task.responsibleId (om satt)
  │              2. Ledare på eventet (om tilldelad)
  │            Toast: "Du är avanmäld. Ansvariga har meddelats."
  └─
```

## Ledare — identifiering

Ledare är inte en systemroll utan en task-tilldelning. Systemet hittar
ledaren för ett event genom:

```
  function findLeader(eventId, schedules, tasks) {
    const leaderTask = tasks.find(t => t.name === 'Ledare')
    if (!leaderTask) return null
    const asgn = schedules[eventId]?.[leaderTask.id]
    if (!asgn) return null
    if (asgn.type === 'contact') return asgn.ids?.[0] ?? null
    return null
  }
```

Vid skapande av event bör "Ledare" vara ett framträdande fält i
EventForm — inte gömt bland alla andra tasks i schemat.

## Notifikationer — datamodell

Notifikationer beräknas on-the-fly vid sidladdning (ingen persistent
lagring). Beräkningslogik:

```
  FÖR VARJE event denna vecka:
    FÖR VARJE task i effectiveTasks(event):
      OM task INTE tilldelad:
        → notifikation till task.responsibleId
        → fallback: notifikation till ledare på eventet

  FÖR VARJE sen avanmälan (< 24h):
    → notifikation till task.responsibleId
    → notifikation till ledare på eventet
```

Sena avanmälningar kräver persistent lagring (en liten array i
databasen) eftersom de inte kan beräknas retroaktivt:

```json
{
  "lateWithdrawals": [
    {
      "eventId": 123,
      "taskId": 4,
      "contactId": 42,
      "timestamp": "2026-04-05T08:30:00Z"
    }
  ]
}
```

## Sidebar-badge

```
  Hem  [●3]    ◄── 3 olästa notifikationer
```

Badge visas om det finns:
- Otilldelade tasks denna vecka (för ansvariga/ledare)
- Sena avanmälningar (för ansvariga/ledare)

Badge-räknaren beräknas i en composable (`useNotifications`) som
delas mellan AppNav (badge) och HomeView (lista).

## Vyer

### 1. Platsbanken (`/platsbank`)

Tillgänglig för alla roller (viewer, member, admin).
Visar kommande händelser som har otilldelade platser.

```
┌──────────────────────────────────────────────────┐
│  PLATSBANK                                       │
│  5 tillfällen att hjälpa till                    │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  ons 9 apr · 18:00                         │  │
│  │  Påskpyssel                                │  │
│  │                                            │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐   │  │
│  │  │ Fika     │ │ Ansikts- │ │ Ljud     │   │  │
│  │  │          │ │ målning  │ │          │   │  │
│  │  │ [Anmäl]  │ │ [Anmäl]  │ │ [Anmäl]  │   │  │
│  │  └──────────┘ └──────────┘ └──────────┘   │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  Sidebar:                                        │
│  ┌──────────────────────┐                        │
│  │  Planeringsdag 12 apr│  ◄── event utan tasks  │
│  │  (ingen anmälan)     │                        │
│  └──────────────────────┘                        │
└──────────────────────────────────────────────────┘
```

### 2. Uppgiftsguide (modal)

Klicka på en uppgift → se beskrivning, manual, och ansvarig person.

```
┌──────────────────────────────────────────────────┐
│  LJUD                                            │
│  ──────────────────────────────────────────────  │
│  Sköter ljudmixern under mötet.                  │
│                                                  │
│  Ansvarig: Anna Andersson                        │
│  ──────────────────────────────────────────────  │
│                                                  │
│  Manual:                                         │
│  1. Kom 30 min innan mötet                       │
│  2. Slå på mixerbordet (knapp baksida)           │
│  3. Testa trådlösa mikrofoner                    │
│  ...                                             │
│                                                  │
│  [Anmäl mig till Ljud — Skärtorsdag 10 apr]     │
└──────────────────────────────────────────────────┘
```

### 3. Hemvy — notifikationer

Uppgiftsansvariga ser varningar på hemvyn:

```
┌──────────────────────────────────────────────────┐
│  ⚠ SAKNAS DENNA VECKA                           │
│                                                  │
│  Söndagsmöte 13 apr:                             │
│    • Ljud — ingen tilldelad                      │
│    • Välkomnare — ingen tilldelad                │
│                                                  │
│  Du är ansvarig för Ljud.                        │
│  [Gå till schema →]                              │
└──────────────────────────────────────────────────┘
```

## Anmälningsflöde

```
  Volontär klickar [Anmäl]
         │
         ▼
  ┌─ Inloggad (member)?
  │    JA ──► Skapa assignment direkt
  │           schedules[eventId][taskId] = { type: 'contact', ids: [myId] }
  │           ──► iCal-feed uppdateras automatiskt
  │           ──► Toast: "Du är anmäld till Ljud — Skärtorsdag 10 apr"
  │
  │    NEJ (viewer) ──► Visa "Logga in för att anmäla dig"
  └─
```

## Teamuppgifter vs individuella

```
  task.teamTask === true   →  dölj från platsbanken
  task.teamTask === false  →  visa i platsbanken om otilldelad
  task.locked === true     →  dölj från platsbanken (admin-only)
```

## Implementationsordning

```
  Fas 0: Datamodell-migration (engångs-script)
  ──────────────────────────────────────────────
  □ Lägg till defaultTasks på Category
  □ Migrera befintliga events (töm expectedTasks där de matchar default)
  □ Implementera effectiveTasks() i useStore
  □ Uppdatera alla ställen som läser expectedTasks

  Fas 1: Task-utökning
  ─────────────────────
  □ Lägg till description, manual, responsibleId, locked på Task
  □ Ta bort skillLevel
  □ Uppdatera TaskForm med nya fält
  □ Uppdatera CategoryForm med defaultTasks-väljare
  □ API-endpoint: PUT /api/task/:id/manual (responsibleId kan redigera)
  □ Markdown-rendering för manual

  Fas 2: Ledare-fält i EventForm
  ────────────────────────────────
  □ Framträdande "Ledare"-väljare i EventForm (inte gömt i schemat)
  □ findLeader()-hjälpfunktion

  Fas 3: Platsbank
  ─────────────────
  □ Skapa /platsbank-vy (4 veckors horisont)
  □ Uppgiftsguide-modal (description + manual + ansvarig)
  □ Anmäl-logik (member only, en per plats)
  □ Avanmäl-logik med 24h-varning + notifikation
  □ lateWithdrawals-lagring i databasen
  □ Events utan tasks i sidofält
  □ Route + nav-länk
  □ Settings: platsbank.enabled, platsbank.selfAssign

  Fas 4: Notifikationer
  ──────────────────────
  □ useNotifications composable
  □ Beräkna saknade tilldelningar för veckan
  □ Matcha mot responsibleId / ledare-fallback
  □ Visa varningar på hemvyn
  □ Badge i sidofältet på "Hem"
  □ Inkludera sena avanmälningar
```

---

## PHP-backend — alternativ deployment

### Varför

Målgruppen (församlingar, små organisationer) har ofta delad hosting med
PHP — inget Node, inget Docker, inget SSH. Bara cPanel och en FTP-klient.
En PHP-backend gör att man kan SFTP:a upp filerna och vara igång.

### Arkitektur

Samma frontend (Vue SPA, förbyggd), ny backend i ren PHP.
Inga beroenden, ingen Composer, inga ramverk.

```
  NODE-VARIANT (nuvarande)          PHP-VARIANT (ny)
  ─────────────────────────         ─────────────────────────

  frontend/dist/  ◄── samma ──►    frontend/dist/
  server.js                         api/index.php
  data_prod.json                    data/data.json
  .env                              config.php
                                    .htaccess

  Kräver:                           Kräver:
  - Node 18+                        - PHP 7.4+ (finns överallt)
  - npm install                     - ZipArchive extension (vanlig)
  - process manager (pm2)           - Apache (redan igång)
```

PHP-varianten lever i `php/` i samma repo. GitHub release byggs som
en zip som innehåller `php/` + förbyggd `frontend/dist/`.

### Första deploy — drag-and-drop

Ingen install.php, inget CLI. Användaren laddar ner zip från GitHub
Releases, drar in filerna via FileZilla, och besöker sidan i webbläsaren.

```
  1. Ladda ner motesplanering-v2.0.0.zip från GitHub Releases
  2. Packa upp lokalt
  3. SFTP/FTP hela mappen till webbhotellet

  Filstruktur på servern:
  public_html/
    index.html              ◄── SPA entrypoint
    .htaccess               ◄── rewrites
    assets/                 ◄── förbyggd frontend (css/js)
    api/
      index.php             ◄── all backend-logik
    data/
      .htaccess             ◄── "Deny from all" (skydda JSON)
    VERSION

  4. Besök https://dinforsamling.se i webbläsaren
```

### Första besöket — setup wizard i webbläsaren

Första gången `api/index.php` körs och `data/data.json` inte finns
→ servern returnerar `{ "setup": true }`. Frontenden visar en
setup-wizard istället för appen:

```
┌──────────────────────────────────────────────────┐
│  Välkommen till Mötesplanering!                  │
│                                                  │
│  Steg 1: Organisationsnamn                       │
│  ┌──────────────────────────────────────────┐    │
│  │  Exempelkyrkan                           │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  Steg 2: Admin-konto                             │
│  ┌──────────────────────────────────────────┐    │
│  │  Användarnamn: admin                     │    │
│  │  Lösenord:     ••••••••                  │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  [Kom igång]                                     │
└──────────────────────────────────────────────────┘

  POST /api/setup
  {
    "orgName": "Exempelkyrkan",
    "adminUser": "admin",
    "adminPass": "hemligt123"
  }

  → Skapar data/data.json med default-struktur
  → Skapar data/config.json med credentials (password_hash)
  → Redirect till inloggning
```

Wizarden körs bara en gång. Om `data/data.json` redan finns →
`/api/setup` returnerar 403.

### Säkerhet — data-mapp

`data/` måste skyddas från direkt åtkomst via webbläsaren.
En `.htaccess` i `data/` löser det:

```apache
  # data/.htaccess
  Deny from all
```

Denna fil levereras med i zip:en. Användaren behöver inte göra något.

### API-yta att replikera

Servern har ~15 endpoints. PHP-varianten behöver samma:

```
  ENDPOINT                          KOMPLEXITET    NOTERING
  ──────────────────────────────    ───────────    ─────────────────────
  GET  /api/                        enkel          json_decode + echo
  GET  /api/me                      enkel          token/basic auth check
  POST /api/auth-check              enkel          basic auth
  POST /api/save                    medel          json read/write + version
  POST /api/upload                  medel          move_uploaded_file
  GET  /api/cal/:slug.ics           medel          string-concat iCal
  GET  /api/cal/cat/:slug.ics       medel          string-concat iCal
  POST /api/generate-tokens         enkel          random_bytes
  POST /api/cron/run                medel          mail() eller SMTP
  POST /api/publish                 medel          ftp_put / sftp
  GET  /api/presence                enkel          json file
  POST /api/presence/heartbeat      enkel          json file
  POST /api/member/update           enkel          json read/write
  POST /api/member/join-team        enkel          json read/write
  POST /api/member/leave-team       enkel          json read/write
```

### Datalagring

JSON flat file — exakt samma format som Node-varianten.
`file_get_contents` + `json_decode` / `json_encode` + `file_put_contents`.

```php
  // Läs
  $db = json_decode(file_get_contents('data/data.json'), true);

  // Skriv (atomiskt)
  $tmp = 'data/data.json.tmp';
  file_put_contents($tmp, json_encode($db, JSON_PRETTY_PRINT));
  rename($tmp, 'data/data.json');  // atomisk på samma filsystem
```

Filbaserad låsning med `flock()` för att hantera concurrent writes:

```php
  $fp = fopen('data/data.json.lock', 'c');
  flock($fp, LOCK_EX);
  // ... läs, modifiera, skriv ...
  flock($fp, LOCK_UN);
  fclose($fp);
```

### Routing

En enda `api/index.php` med `.htaccess` rewrite:

```apache
  # .htaccess
  RewriteEngine On

  # API-anrop → PHP
  RewriteRule ^api/(.*)$ api/index.php [QSA,L]

  # iCal-feeds
  RewriteRule ^api/cal/(.+)\.ics$ api/index.php [QSA,L]

  # Allt annat → frontend SPA
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteRule ^ index.html [L]
```

### Auth

Samma modell som Node-varianten:

```
  Basic Auth (admin)     →  $_SERVER['PHP_AUTH_USER'] / PHP_AUTH_PW
  Member token           →  $_GET['token'] eller X-Member-Token header
  Viewer                 →  ingen auth, begränsad data
```

---

## Självuppdatering

### Strategi

Appen kollar GitHub Releases API efter nya versioner. Admin klickar
"Uppdatera" i inställningar. Appen laddar ner zip, packar upp, byter filer.

Ingen automatisk uppdatering — alltid manuellt initierad av admin.

### Flöde

```
  ┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
  │  Inställ-    │     │  GitHub API      │     │  Filsystem   │
  │  ningar      │     │                  │     │              │
  │              │     │  GET /repos/     │     │              │
  │  [Sök       ]│────►│  owner/repo/     │     │              │
  │  [uppdatering]     │  releases/latest │     │              │
  │              │     │                  │     │              │
  │  Ny version  │◄────│  { tag: "v2.1",  │     │              │
  │  tillgänglig │     │    zipball_url } │     │              │
  │              │     │                  │     │              │
  │  [Uppdatera] │────►│  GET zipball_url │────►│  /tmp/       │
  │              │     │                  │     │  update.zip  │
  │              │     └──────────────────┘     │              │
  │              │                              │  Packa upp   │
  │              │                              │  Byt filer   │
  │              │                              │  Behåll:     │
  │              │                              │   data.json  │
  │              │                              │   config.php │
  │              │                              │   .env       │
  │  Klar!       │◄─────────────────────────────│              │
  └──────────────┘                              └──────────────┘
```

### Versionscheck

```
  GET https://api.github.com/repos/{owner}/{repo}/releases/latest
  Accept: application/vnd.github.v3+json

  Svar:
  {
    "tag_name": "v2.1.0",
    "zipball_url": "https://api.github.com/repos/.../zipball/v2.1.0",
    "body": "Changelog text..."
  }
```

Appen lagrar sin nuvarande version i en fil (`VERSION` eller i config).
Jämför `tag_name` mot lokal version. Om nyare → visa "Uppdatering
tillgänglig" med changelog.

### Uppdateringslogik (PHP)

```php
  // 1. Hämta release-info
  $release = json_decode(file_get_contents(
    'https://api.github.com/repos/owner/repo/releases/latest',
    false,
    stream_context_create(['http' => [
      'header' => "User-Agent: motesplanering\r\n"
    ]])
  ), true);

  // 2. Ladda ner zip
  $zip_url = $release['zipball_url'];
  $tmp = tempnam(sys_get_temp_dir(), 'update_');
  copy($zip_url, $tmp);  // följer redirects

  // 3. Packa upp
  $zip = new ZipArchive();
  $zip->open($tmp);
  $zip->extractTo('/tmp/update_staging/');
  $zip->close();

  // 4. Byt filer (behåll data + config)
  //    - Kopiera nya filer över befintliga
  //    - Rör inte data/, config.php, .env
  //    - Uppdatera VERSION-fil
```

### Uppdateringslogik (Node)

Samma princip, men med `https` + `child_process`:

```
  1. fetch() mot GitHub API
  2. Ladda ner zip till /tmp
  3. unzip med child_process eller adm-zip
  4. rsync/kopiera nya filer, behåll data + .env
  5. Starta om processen (pm2 restart)
```

### Skyddade filer

Dessa filer/mappar ska aldrig skrivas över vid uppdatering:

```
  SKYDDADE (behåll)              UPPDATERAS
  ─────────────────              ──────────────────
  data/data.json                 api/index.php
  data_prod.json                 frontend/dist/**
  config.php                     server.js
  .env                           package.json
  backups/                       VERSION
  .beads/
```

### Rollback

Innan uppdatering: kopiera nuvarande filer till `backups/pre-update/`.
Om något går fel kan admin återställa manuellt via FTP, eller via
en "Återställ"-knapp i inställningar.

```
  backups/
    pre-update-v2.0.0/
      api/
      frontend/
      server.js
      VERSION
```

### UI i inställningar

```
┌──────────────────────────────────────────────────┐
│  UPPDATERINGAR                                   │
│                                                  │
│  Nuvarande version: v2.0.0                       │
│  Senaste version:   v2.1.0  ✨ Ny!              │
│                                                  │
│  Ändringar i v2.1.0:                             │
│  - Platsbank: ny vy för volontäranmälan          │
│  - Buggfix: iCal-feed timezone                   │
│  - Förbättrad mobilvy                            │
│                                                  │
│  [Uppdatera nu]    [Visa på GitHub]              │
│                                                  │
│  Senast uppdaterad: 2026-03-15                   │
│  Automatisk check: varje gång admin loggar in    │
└──────────────────────────────────────────────────┘
```

### Säkerhet

- Uppdatering kräver admin-auth
- Verifiera att zip kommer från rätt GitHub-repo (kontrollera URL)
- Skapa backup innan varje uppdatering
- Timeout på nedladdning (30s)
- Kontrollera diskutrymme innan uppackning
- Logga alla uppdateringsförsök

### Öppna frågor — deployment

- Ska uppdateraren kunna hantera databasmigrering (schema-ändringar
  i data.json)? → Skippas tills vidare, hanteras manuellt vid behov.
- Behöver vi en "hälsokontroll" i setup-wizarden som verifierar
  PHP-version, ZipArchive, skrivbara mappar?

### Beslut

```
  FRÅGA                                  BESLUT
  ──────────────────────────────────     ──────────────────────────
  Separat repo eller samma?              Samma repo, under php/
  Installationsscript?                   Nej — drag-and-drop + setup wizard
                                         i webbläsaren vid första besök
  Databasmigrering?                      Skippas tills vidare
  Nginx-stöd?                            Nej, bara Apache (.htaccess)
  Distribution?                          GitHub Releases (zip)
```
