# Mötesplanering — PHP

PHP-backend för delad hosting (Apache). Ingen Node, ingen Composer, inga beroenden.

## Deploy

1. Bygg frontenden: `cd frontend && npm run build`
2. Kopiera `frontend/dist/*` till `php/` (så att `php/index.html` finns)
3. Ladda upp hela `php/`-mappen till webbhotellet via FTP
4. Besök sidan i webbläsaren — setup-wizard visas vid första besök

## Krav

- PHP 7.4+
- Apache med `mod_rewrite`
- `ZipArchive`-extension (för självuppdatering)

## Filstruktur

```
php/
  index.html          ← SPA (kopieras från frontend/dist)
  assets/             ← CSS/JS (kopieras från frontend/dist)
  .htaccess           ← URL-rewrites
  api/
    index.php         ← All backend-logik
  data/
    .htaccess         ← Blockerar direkt åtkomst
    data.json          ← Skapas vid setup
    config.json        ← Admin-credentials (skapas vid setup)
  uploads/            ← Uppladdade bilder
  backups/            ← Dagliga backups
  VERSION
```

## Skillnader mot Node-varianten

- Email: använder PHP `mail()` istället för nodemailer/SMTP
- Cron: ingen inbyggd schemaläggning — använd webbhotellets cron
- SFTP-publicering: inte implementerat (använd webbhotellets filhanterare)
- Presence: filbaserad istället för in-memory
