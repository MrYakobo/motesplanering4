const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DB_FILE = path.join(__dirname, 'data_prod.json');

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

function saveDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
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

// Schedule cron jobs if node-cron is available
if (cron) {
  // 6 days ahead — personal reminders at 09:00
  cron.schedule('0 9 * * *', () => {
    console.log('[cron] Running 6-day reminders…');
    runCronReminders(6);
  });
  // 6 days ahead — mailchats at 09:05
  cron.schedule('5 9 * * *', () => {
    console.log('[cron] Running 6-day mailchats…');
    runCronMailchats(6);
  });
  // 1 day ahead — personal reminders at 18:00
  cron.schedule('0 18 * * *', () => {
    console.log('[cron] Running 1-day reminders…');
    runCronReminders(1);
  });
  console.log('[cron] Scheduled: 09:00 (6d reminders), 09:05 (6d mailchats), 18:00 (1d reminders)');
} else {
  console.log('[cron] node-cron not installed — cron jobs disabled. Run: npm install node-cron');
}

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
      password: s.password,
      privateKey: s.privateKeyPath ? fs.readFileSync(s.privateKeyPath) : undefined,
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

  // ── Manual cron trigger: POST /api/cron/run ───────────────────
  if (req.method === 'POST' && url.pathname === '/api/cron/run') {
    try {
      const sent = await runFullCron();
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: true, sent }));
    } catch (err) {
      res.writeHead(500, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // ── KV API: GET /api/:collection ────────────────────────────────
  if (req.method === 'GET' && url.pathname.startsWith('/api/')) {
    const key = url.pathname.slice(5);
    if (!key) {
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify(loadDb()));
      return;
    }
    const db = loadDb();
    if (!(key in db)) {
      res.writeHead(404, {'Content-Type':'application/json'});
      res.end(JSON.stringify({error: 'not found'}));
      return;
    }
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify(db[key]));
    return;
  }

  // ── KV API: PUT /api/:collection ────────────────────────────────
  if (req.method === 'PUT' && url.pathname.startsWith('/api/')) {
    const key = url.pathname.slice(5);
    if (!key) {
      const body = await readBody(req);
      try {
        const data = JSON.parse(body);
        saveDb(data);
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ok: true}));
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
      db[key] = value;
      saveDb(db);
      res.writeHead(200, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ok: true}));
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
    const ext = ct.includes('png') ? '.png' : ct.includes('gif') ? '.gif' : ct.includes('webp') ? '.webp' : ct.includes('svg') ? '.svg' : '.jpg';
    const name = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext;
    const buf = await readRawBody(req);
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
});
