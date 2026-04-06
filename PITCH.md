# Mötesplanering — Vad vi har vs vad vi saknar

Jämförelse med Planning Center (marknadsledare, 100k+ kyrkor, $0–$400/mån).

## Vad vi redan har som matchar

| Feature | Planning Center | Mötesplanering | Status |
|---------|----------------|----------------|--------|
| Volontärschema | ✅ Services | ✅ Schema + Team | Klart |
| Team-rotation | ✅ Auto-schedule | ✅ Round-robin | Klart |
| Påminnelsemail | ✅ Reminder emails | ✅ Mailbot + cron | Klart |
| iCal-prenumeration | ✅ Calendar sync | ✅ Per-person iCal | Klart |
| Kontakthantering | ✅ People (gratis) | ✅ Kontakter | Klart |
| Kategori/eventtyper | ✅ Service Types | ✅ Kategorier + defaultTasks | Klart |
| Lobbyskärm | ✅ Services Live | ✅ Dashboard + Slides | Klart |
| Mobilvy | ✅ Mobile app | ✅ PWA (installbar) | Klart |
| Självservice (schema) | ✅ Volunteer app | ✅ Mitt schema + Mina team | Klart |
| Magic link login | ✅ Church Center | ✅ Email-baserad login | Klart |
| QR-kod onboarding | ❌ | ✅ Dashboard QR → login | Klart |
| Uppgiftsguider | ❌ | ✅ Task manual (markdown) | Klart |
| GDPR/PII-skydd | ❌ (US-fokus) | ✅ API strippar PII per roll | Klart |
| Gratis & self-hosted | ❌ ($0–$400/mån) | ✅ Helt gratis, egen server | Klart |

## Vad vi saknar — och vad som faktiskt spelar roll

### 🔴 Kritiskt (folk förväntar sig det)

**1. Bekräfta/neka tjänstgöring**
Planning Center: volontär får förfrågan → svarar "ja" eller "nej" → admin ser status.
Vi: admin tilldelar → klart. Ingen bekräftelse-loop.

*Varför det spelar roll:* Folk vill kunna säga "jag kan inte den veckan" utan att ringa admin. Det är den enskilt viktigaste self-service-funktionen.

*Implementation:* Lägg till `status: 'pending' | 'confirmed' | 'declined'` på assignments. Visa status i schemat. Volontär ser pending-förfrågningar i "Mitt schema" och kan svara.

**2. Blockout-datum (jag är borta 15–22 juni)**
Planning Center: volontärer anger perioder de inte kan tjänstgöra.
Vi: inget stöd.

*Varför det spelar roll:* Auto-distribution schemaläger folk som är på semester. Admin måste manuellt kolla.

*Implementation:* `Contact.blockouts: { from: string, to: string }[]`. Auto-distribute hoppar över blockout-perioder. Visa i kontaktprofil.

### 🟡 Viktigt (gör oss proffsiga)

**3. Mobilapp-känsla**
Planning Center: native app med push-notiser.
Vi: PWA utan push.

*Vad vi kan göra:* PWA är redan installbar. Lägg till Web Push API för påminnelser (kräver service worker + push subscription). Alternativt: skicka SMS via Twilio/46elks.

**4. Volontär-svar direkt i email**
Planning Center: "Kan du tjänstgöra?" med ja/nej-knappar i mailet.
Vi: mail säger "du är schemalagd" utan svarsmöjlighet.

*Implementation:* Lägg till tokeniserade ja/nej-länkar i påminnelsemailet: `/api/respond?token=X&accept=yes`. Kräver minimal serverlogik.

**5. Rapporter och statistik**
Planning Center: vem har tjänstgjort mest, vilka team har lägst närvaro, etc.
Vi: inget.

*Implementation:* En enkel "Statistik"-vy som räknar tilldelningar per person/team/period. Data finns redan i schedules.

### 🟢 Nice-to-have (wow-faktor)

**6. Realtids-synk (live updates)**
Planning Center: ändringar syns direkt för alla.
Vi: manuell refresh.

*Implementation:* Server-Sent Events (SSE) — enklare än WebSocket. Server skickar `data: {version: X}` vid varje save. Client pollar `/api/sse` och refreshar vid ny version.

**7. Drag-and-drop i schemat**
Planning Center: dra personer till schema-celler.
Vi: klicka → picker modal.

*Implementation:* HTML5 drag-and-drop på schema-tabellen. Redan byggt för team-vyn.

**8. Sångplanering / ordning**
Planning Center Services: hela gudstjänstordningen med sånger, tider, noter.
Vi: bara vem som gör vad, inte vad som händer.

*Bedömning:* Utanför scope. Vi är ett schemaverktyg, inte ett gudstjänstplaneringsverktyg.

## Pitch-vinkel: Vad vi gör bättre

Planning Center är fantastiskt men:
- Kostar $14–$400/mån
- Kräver internet (SaaS)
- US-fokuserat (engelska, USD, ingen GDPR)
- Komplex — 8 produkter, lång onboarding
- Ingen self-hosting

Vår pitch:

> **Mötesplanering är det enklaste sättet att schemalägga volontärer.**
>
> Gratis. Self-hosted. Svenskt. Installera på 5 minuter.
>
> Dina volontärer skannar en QR-kod, loggar in med sin email,
> och ser sitt schema direkt i telefonen. Inga appar att ladda ner.
>
> Admins får kalender, schema, team-rotation, påminnelsemail,
> och en lobbyskärm — allt i en enda app.

## Rekommenderad prioritering

```
Sprint 1 (nästa vecka):
  □ Bekräfta/neka tjänstgöring (🔴 kritiskt)
  □ Email-svar med ja/nej-länkar (🟡 viktigt)

Sprint 2:
  □ Blockout-datum (🔴 kritiskt)
  □ Statistik-vy (🟡 viktigt)

Sprint 3:
  □ SSE realtids-synk (🟢 nice)
  □ Drag-and-drop schema (🟢 nice)

Parkerat:
  □ Push-notiser (kräver VAPID-setup)
  □ Sångplanering (utanför scope)
```
