const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DB_FILE = path.join(__dirname, 'data_prod.json');
const BACKUP_DIR = path.join(__dirname, 'backups');
const MAX_UPLOAD = 25 * 1024 * 1024; // 25 MB

// Load .env file
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^\s*([\w]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  });
}
const AUTH_USER = process.env.ADMIN_USERNAME || '';
const AUTH_PASS = process.env.ADMIN_PASSWORD || '';

// Shared libs (same code the SPA uses for preview)
const Shared = require('./lib/shared');
const EmailBuilder = require('./lib/email-builder');
const ExportBuilder = require('./lib/export-builder');

// Optional deps — graceful if not installed
let nodemailer, cron, SftpClient;
try { nodemailer = require('nodemailer'); } catch (e) { /* not installed */ }
try { cron = require('node-cron'); } catch (e) { /* not installed */ }
try { SftpClient = require('ssh2-sftp-client'); } catch (e) { /* not installed */ }

// MIME types for static files
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
};

const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR);

// ── AUTH ───────────────────────────────────────────────────────────────────────
function checkAuth(req) {
  const auth = req.headers['authorization'] || '';
  if (!auth.startsWith('Basic ')) return false;
  const decoded = Buffer.from(auth.slice(6), 'base64').toString();
  const [user, pass] = decoded.split(':');
  return user === AUTH_USER && pass === AUTH_PASS;
}

function stripForViewer(data) {
  const copy = JSON.parse(JSON.stringify(data));
  if (copy.contacts) {
    copy.contacts = copy.contacts.map(c => ({ id: c.id, name: c.name }));
  }
  delete copy.settings;
  return copy;
}

// ── BACKUP ────────────────────────────────────────────────────────────────────
function runBackup() {
  try {
    const dateStr = new Date().toISOString().slice(0, 10);
    const dest = path.join(BACKUP_DIR, dateStr + '.json');
    if (fs.existsSync(DB_FILE)) {
      fs.copyFileSync(DB_FILE, dest);
      console.log('[backup] Saved', dest);
    }
  } catch (err) {
    console.error('[backup] Failed:', err.message);
  }
}

// ── iCAL FEED ─────────────────────────────────────────────────────────────────
function slugifyEmail(email) {
  return (email || '').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function buildIcalForContact(contact, db, schedules) {
  const events = (db.events || []).filter(ev => {
    const asgn = schedules[ev.id] || {};
    return Object.values(asgn).some(val => {
      if (val.type === 'contact') return (val.ids || []).includes(contact.id);
      if (val.type === 'team') {
        const team = (db.teams || []).find(t => t.id === val.id);
        return team && team.members.includes(contact.id);
      }
      return false;
    });
  });

  let cal = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Motesplanering//EN\r\nX-WR-CALNAME:' + contact.name + ' schema\r\n';
  for (const ev of events) {
    const task = Shared.findPersonTask(ev.id, contact.id, db, schedules);
    const dtStart = (ev.date || '').replace(/-/g, '') + (ev.time ? 'T' + ev.time.replace(/:/g, '') + '00' : '');
    // default 1h duration — build DTEND in same local format as DTSTART
    const startDate = new Date(ev.date + 'T' + (ev.time || '00:00') + ':00');
    const endDate = new Date(startDate.getTime() + 3600000);
    const yy = endDate.getFullYear();
    const mm = String(endDate.getMonth()+1).padStart(2,'0');
    const dd = String(endDate.getDate()).padStart(2,'0');
    const hh = String(endDate.getHours()).padStart(2,'0');
    const mi = String(endDate.getMinutes()).padStart(2,'0');
    const ss = String(endDate.getSeconds()).padStart(2,'0');
    const dtEnd = yy + mm + dd + 'T' + hh + mi + ss;
    const summary = (ev.title || 'Event') + (task ? ' (' + task.name + ')' : '');
    cal += 'BEGIN:VEVENT\r\n';
    cal += 'UID:ev' + ev.id + '-' + contact.id + '@motesplanering\r\n';
    cal += 'DTSTART:' + dtStart + '\r\n';
    cal += 'DTEND:' + dtEnd + '\r\n';
    cal += 'SUMMARY:' + summary + '\r\n';
    if (ev.description) cal += 'DESCRIPTION:' + ev.description.replace(/\n/g, '\\n') + '\r\n';
    cal += 'END:VEVENT\r\n';
  }
  cal += 'END:VCALENDAR\r\n';
  return cal;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function loadDb() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return {}; }
}

let dbVersion = Date.now();

function saveDb(data) {
  dbVersion = Date.now();
  data._version = dbVersion;
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function getDbVersion() {
  const db = loadDb();
  return db._version || 0;
}

// ── CONFIG (loaded from db.settings or .env-style) ────────────────────────────
function getSettings() {
  const db = loadDb();
  return db.settings || {};
}

function getSmtpTransport() {
  if (!nodemailer) return null;
  const s = getSettings().smtp;
  if (!s || !s.host) return null;
  return nodemailer.createTransport({
    host: s.host,
    port: s.port || 587,
    secure: s.secure || false,
    auth: { user: s.user, pass: s.pass },
  });
}

async function sendEmail({ to, subject, html }) {
  const transport = getSmtpTransport();
  if (!transport) {
    console.log('[mailbot] SMTP not configured — would send to:', to, '| subject:', subject);
    return { ok: true, dry: true };
  }
  const s = getSettings().smtp;
  await transport.sendMail({
    from: s.from || s.user,
    to: to,
    subject: subject,
    html: html,
  });
  console.log('[mailbot] Sent to:', to, '| subject:', subject);
  return { ok: true };
}

// ── CRON LOGIC ────────────────────────────────────────────────────────────────
function loadSchedules(db) {
  // Convert saved schedules format to the assignments map
  const schedules = {};
  (db.events || []).forEach(e => { schedules[e.id] = {}; });
  const saved = db.schedules || {};
  Object.entries(saved).forEach(([eid, tasks]) => {
    const numEid = parseInt(eid);
    if (!schedules[numEid]) schedules[numEid] = {};
    Object.entries(tasks).forEach(([tid, asgn]) => {
      schedules[numEid][parseInt(tid)] = asgn;
    });
  });
  return schedules;
}

async function runCronReminders(daysAhead) {
  const db = loadDb();
  const schedules = loadSchedules(db);
  const today = new Date();
  const emails = EmailBuilder.collectReminders(db, schedules, daysAhead, today);
  let sent = 0;
  for (const email of emails) {
    try { await sendEmail(email); sent++; }
    catch (err) { console.error('[cron] Failed to send:', email.to, err.message); }
  }
  console.log(`[cron] Reminders (${daysAhead}d ahead): ${sent}/${emails.length} sent`);
  return sent;
}

async function runCronMailchats(daysAhead) {
  const db = loadDb();
  const schedules = loadSchedules(db);
  const today = new Date();
  const emails = EmailBuilder.collectMailchats(db, schedules, daysAhead, today);
  let sent = 0;
  for (const email of emails) {
    const to = Array.isArray(email.to) ? email.to.join(', ') : email.to;
    try { await sendEmail({ to, subject: email.subject, html: email.html }); sent++; }
    catch (err) { console.error('[cron] Failed to send mailchat:', err.message); }
  }
  console.log(`[cron] Mailchats (${daysAhead}d ahead): ${sent}/${emails.length} sent`);
  return sent;
}

async function runFullCron() {
  let total = 0;
  total += await runCronReminders(6);
  total += await runCronMailchats(6);
  total += await runCronReminders(1);
  return total;
}

// Default cron job definitions
const DEFAULT_CRON_JOBS = [
  { id: 'reminders_6d', name: 'Påminnelser (6 dagar)', schedule: '0 9 * * *', action: 'reminders', daysAhead: 6, enabled: true },
  { id: 'mailchats_6d', name: 'Mailchats (6 dagar)', schedule: '5 9 * * *', action: 'mailchats', daysAhead: 6, enabled: true },
  { id: 'reminders_1d', name: 'Påminnelser (1 dag)', schedule: '0 18 * * *', action: 'reminders', daysAhead: 1, enabled: true },
  { id: 'backup', name: 'Daglig backup', schedule: '0 2 * * *', action: 'backup', enabled: true },
  { id: 'publish', name: 'Publicera månadsblad', schedule: '0 * * * *', action: 'publish', enabled: false },
];

function getCronJobs() {
  const db = loadDb();
  return (db.settings && db.settings.cronJobs) || DEFAULT_CRON_JOBS;
}

async function runCronJob(job) {
  if (job.action === 'reminders') return await runCronReminders(job.daysAhead || 6);
  if (job.action === 'mailchats') return await runCronMailchats(job.daysAhead || 6);
  if (job.action === 'backup') { runBackup(); return 0; }
  if (job.action === 'publish') {
    const db = loadDb();
    const today = new Date();
    const startDate = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
    const html = ExportBuilder.buildExportHtml({ events: db.events || [], startDate, months: 2, today });
    const result = await publishViaSftp(html);
    return result.ok ? 1 : 0;
  }
  return 0;
}

// Active cron tasks (so we can reschedule)
const cronTasks = {};

function scheduleCronJobs() {
  // Stop all existing
  Object.values(cronTasks).forEach(t => t.stop());
  Object.keys(cronTasks).forEach(k => delete cronTasks[k]);
  if (!cron) return;
  const jobs = getCronJobs();
  jobs.forEach(job => {
    if (!job.enabled) return;
    try {
      cronTasks[job.id] = cron.schedule(job.schedule, () => {
        console.log(`[cron] Running ${job.name}…`);
        runCronJob(job);
      });
      console.log(`[cron] Scheduled: ${job.schedule} (${job.name})`);
    } catch (err) {
      console.error(`[cron] Invalid schedule for ${job.name}: ${err.message}`);
    }
  });
}

scheduleCronJobs();

// ── SFTP PUBLISH ──────────────────────────────────────────────────────────────
async function publishViaSftp(html) {
  if (!SftpClient) return { ok: false, error: 'ssh2-sftp-client not installed' };
  const s = getSettings().sftp;
  if (!s || !s.host) return { ok: false, error: 'SFTP not configured in settings' };
  const sftp = new SftpClient();
  try {
    await sftp.connect({
      host: s.host,
      port: s.port || 22,
      username: s.username,
      privateKey: s.privateKey ? Buffer.from(s.privateKey) : undefined,
    });
    await sftp.put(Buffer.from(html, 'utf8'), s.remotePath || '/var/www/html/calendar.html');
    await sftp.end();
    console.log('[publish] Uploaded to', s.host + ':' + (s.remotePath || '/var/www/html/calendar.html'));
    return { ok: true };
  } catch (err) {
    console.error('[publish] SFTP error:', err.message);
    try { await sftp.end(); } catch {}
    return { ok: false, error: err.message };
  }
}

// ── HTTP SERVER ───────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // ── iCal feed: GET /api/cal/:slug.ics (no auth required) ─────
  const icsMatch = url.pathname.match(/^\/api\/cal\/(.+)\.ics$/);
  if (req.method === 'GET' && icsMatch) {
    const slug = icsMatch[1];
    const db = loadDb();
    const contact = (db.contacts || []).find(c => slugifyEmail(c.email) === slug);
    if (!contact) {
      res.writeHead(404, {'Content-Type':'text/plain'});
      res.end('Not found');
      return;
    }
    const schedules = loadSchedules(db);
    const ical = buildIcalForContact(contact, db, schedules);
    res.writeHead(200, {'Content-Type':'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="' + slug + '.ics"'});
    res.end(ical);
    return;
  }

  // ── Auth check ─────────────────────────────────────────────────
  const isAdmin = AUTH_USER ? checkAuth(req) : true;

  // Write operations require admin auth
  if (req.method !== 'GET' && !isAdmin) {
    if (url.pathname.startsWith('/api/') || url.pathname === '/upload') {
      res.writeHead(401, {'Content-Type':'application/json'});
      res.end(JSON.stringify({error: 'unauthorized'}));
      return;
    }
  }

  // ── Send email: POST /api/send-email ──────────────────────────
  if (req.method === 'POST' && url.pathname === '/api/send-email') {
    const body = await readBody(req);
    try {
      const { to, subject, html } = JSON.parse(body);
      if (!to || !subject || !html) throw new Error('missing fields');
      const result = await sendEmail({ to, subject, html });
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(400, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // ── Publish: POST /api/publish ────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/api/publish') {
    const body = await readBody(req);
    try {
      const { html } = JSON.parse(body);
      if (!html) throw new Error('missing html');
      const result = await publishViaSftp(html);
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(400, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // ── Cron: GET /api/cron — list jobs ────────────────────────────
  if (req.method === 'GET' && url.pathname === '/api/cron') {
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({ jobs: getCronJobs(), cronAvailable: !!cron }));
    return;
  }

  // ── Cron: POST /api/cron/run — run a specific job or all ──────
  if (req.method === 'POST' && url.pathname === '/api/cron/run') {
    const body = await readBody(req);
    try {
      const { jobId } = JSON.parse(body || '{}');
      if (jobId) {
        const job = getCronJobs().find(j => j.id === jobId);
        if (!job) { res.writeHead(404, {'Content-Type':'application/json'}); res.end(JSON.stringify({error:'job not found'})); return; }
        const sent = await runCronJob(job);
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ ok: true, job: job.name, sent }));
      } else {
        const sent = await runFullCron();
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ ok: true, sent }));
      }
    } catch (err) {
      res.writeHead(500, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // ── Cron: POST /api/cron/reload — reschedule after settings change ─
  if (req.method === 'POST' && url.pathname === '/api/cron/reload') {
    scheduleCronJobs();
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({ ok: true, jobs: getCronJobs().filter(j=>j.enabled).length }));
    return;
  }

  // ── Auth check: GET /api/auth-check ───────────────────────────
  if (req.method === 'GET' && url.pathname === '/api/auth-check') {
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({ ok: isAdmin }));
    return;
  }

  // ── KV API: GET /api/:collection ────────────────────────────────
  if (req.method === 'GET' && url.pathname.startsWith('/api/')) {
    const key = url.pathname.slice(5);
    if (!key) {
      const data = loadDb();
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify(!isAdmin ? stripForViewer(data) : data));
      return;
    }
    const db = loadDb();
    if (!(key in db)) {
      res.writeHead(404, {'Content-Type':'application/json'});
      res.end(JSON.stringify({error: 'not found'}));
      return;
    }
    let val = db[key];
    if (!isAdmin && key === 'contacts') {
      val = val.map(c => ({ id: c.id, name: c.name }));
    }
    if (!isAdmin && key === 'settings') {
      res.writeHead(403, {'Content-Type':'application/json'});
      res.end(JSON.stringify({error: 'read-only'}));
      return;
    }
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify(val));
    return;
  }

  // ── KV API: PUT /api/:collection ────────────────────────────────
  if (req.method === 'PUT' && url.pathname.startsWith('/api/')) {
    const key = url.pathname.slice(5);
    const clientVersion = parseInt(url.searchParams.get('v') || '0');
    if (!key) {
      const body = await readBody(req);
      try {
        const data = JSON.parse(body);
        const currentVersion = getDbVersion();
        if (clientVersion && clientVersion !== currentVersion) {
          res.writeHead(409, {'Content-Type':'application/json'});
          res.end(JSON.stringify({error: 'conflict', message: 'Data har ändrats av någon annan. Ladda om sidan.', serverVersion: currentVersion}));
          return;
        }
        saveDb(data);
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ok: true, version: dbVersion}));
      } catch {
        res.writeHead(400, {'Content-Type':'application/json'});
        res.end(JSON.stringify({error: 'invalid json'}));
      }
      return;
    }
    const body = await readBody(req);
    try {
      const value = JSON.parse(body);
      const db = loadDb();
      const currentVersion = db._version || 0;
      if (clientVersion && clientVersion !== currentVersion) {
        res.writeHead(409, {'Content-Type':'application/json'});
        res.end(JSON.stringify({error: 'conflict', message: 'Data har ändrats av någon annan. Ladda om sidan.', serverVersion: currentVersion}));
        return;
      }
      db[key] = value;
      saveDb(db);
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ok: true, version: dbVersion}));
    } catch {
      res.writeHead(400, {'Content-Type':'application/json'});
      res.end(JSON.stringify({error: 'invalid json'}));
    }
    return;
  }

  // ── KV API: DELETE /api/:collection ─────────────────────────────
  if (req.method === 'DELETE' && url.pathname.startsWith('/api/')) {
    const key = url.pathname.slice(5);
    if (!key) {
      res.writeHead(400, {'Content-Type':'application/json'});
      res.end(JSON.stringify({error: 'key required'}));
      return;
    }
    const db = loadDb();
    delete db[key];
    saveDb(db);
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({ok: true}));
    return;
  }

  // ── File upload: POST /upload ─────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/upload') {
    const ct = req.headers['content-type'] || '';
    const len = parseInt(req.headers['content-length'] || '0', 10);
    if (len > MAX_UPLOAD) {
      res.writeHead(413, {'Content-Type':'application/json'});
      res.end(JSON.stringify({error: 'File too large (max 25 MB)'}));
      req.resume();
      return;
    }
    const ext = ct.includes('png') ? '.png' : ct.includes('gif') ? '.gif' : ct.includes('webp') ? '.webp' : ct.includes('svg') ? '.svg' : '.jpg';
    const name = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext;
    const buf = await readRawBody(req);
    if (buf.length > MAX_UPLOAD) {
      res.writeHead(413, {'Content-Type':'application/json'});
      res.end(JSON.stringify({error: 'File too large (max 25 MB)'}));
      return;
    }
    fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({url: '/uploads/' + name}));
    return;
  }

  // ── List uploads: GET /uploads ──────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/uploads') {
    const files = fs.readdirSync(UPLOAD_DIR).filter(f => !f.startsWith('.')).map(f => '/uploads/' + f);
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify(files));
    return;
  }

  // ── Static file serving ─────────────────────────────────────────
  let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
  filePath = path.join(__dirname, filePath);
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, {'Content-Type': contentType});
    res.end(content);
  } catch {
    res.writeHead(404, {'Content-Type':'text/plain'});
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`API: GET/PUT/DELETE /api/:key`);
  console.log(`Email: POST /api/send-email`);
  console.log(`Publish: POST /api/publish`);
  console.log(`Cron: POST /api/cron/run (manual trigger)`);
  console.log(`iCal: GET /api/cal/:email-slug.ics`);
  console.log(`Auth: ${AUTH_USER ? 'enabled (Basic)' : 'DISABLED — set ADMIN_USERNAME/ADMIN_PASSWORD in .env'}`);
  // Run initial backup on start
  runBackup();
});
