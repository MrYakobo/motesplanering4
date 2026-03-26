const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DB_FILE = path.join(__dirname, 'data_prod.json');

// MIME types for static files
const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
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
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // ── KV API: GET /api/:collection ────────────────────────────────
  if (req.method === 'GET' && url.pathname.startsWith('/api/')) {
    const key = url.pathname.slice(5); // strip "/api/"
    if (!key) {
      // return entire db
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
      // replace entire db
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

  // prevent directory traversal
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
});
