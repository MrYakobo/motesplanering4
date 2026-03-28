// ── HASH ROUTING ──────────────────────────────────────────────────────────────
let _lastPushedHash = location.hash;
let _hashIsReplace = false;

let _suppressHash = false;

function updateHash(replace) {
  if (_suppressHash) return;
  let hash = '#' + currentTab;
  if (currentTab === 'events' && currentView === 'monster') hash = '#schema';
  else if (currentTab === 'events' && currentView === 'calendar') hash += '/calendar';
  else if (currentTab === 'events' && currentView === 'week') hash += '/week';
  else if (currentTab === 'events' && currentView === 'year') hash += '/year';
  if (currentView !== 'monster' && selectedId) hash += '/' + selectedId;
  const q = document.getElementById('search-input')?.value || '';
  if (q) hash += '?q=' + encodeURIComponent(q);
  if (location.hash === hash) return;
  if (replace || _hashIsReplace) {
    history.replaceState(null, '', hash);
  } else {
    history.pushState(null, '', hash);
  }
  _lastPushedHash = hash;
}

function applyHash() {
  const raw = location.hash.replace(/^#/, '');
  if (!raw) return;
  const [hashPath, queryStr] = raw.split('?');
  const parts = hashPath.split('/');
  let tab = parts[0];

  // Handle #schema as events/monster
  if (tab === 'schema') {
    tab = 'events';
    currentView = 'monster';
    const params = new URLSearchParams(queryStr || '');
    const q = params.get('q') || '';
    const searchEl = document.getElementById('search-input');
    if (searchEl && q) searchEl.value = q;
    _suppressHash = true;
    switchTab('events', true);
    setView('monster');
    _suppressHash = false;
    return;
  }

  if (!tabConfig[tab]) return;

  // Restore search query
  const params = new URLSearchParams(queryStr || '');
  const q = params.get('q') || '';
  const searchEl = document.getElementById('search-input');
  if (searchEl && q) searchEl.value = q;

  // Pre-set view before switchTab to avoid hash being overwritten
  const viewMap = {calendar:'calendar', week:'week', year:'year'};
  if (tab === 'events' && viewMap[parts[1]]) {
    currentView = viewMap[parts[1]];
  }

  _suppressHash = true;
  _hashIsReplace = true;
  switchTab(tab, true);
  _hashIsReplace = false;
  _suppressHash = false;

  if (tab === 'slides' && parts[1] === 'fullscreen') {
    enterSlidesFullscreen();
    return;
  }

  if (tab === 'sunday' && parts[1] === 'fullscreen') {
    enterSundayFullscreen();
    return;
  }

  if (tab === 'namnskyltar' && parts[1] === 'fullscreen') {
    const slug = parts[2] || null;
    const task = slug ? (db.tasks || []).find(t => slugifyTask(t.name) === slug) : null;
    enterNameplateFullscreen(task ? task.id : null);
    return;
  }

  if (tab === 'events' && viewMap[parts[1]]) {
    _suppressHash = true;
    setView(viewMap[parts[1]]);
    _suppressHash = false;
    if (parts[2]) {
      const id = parseInt(parts[2]);
      if (id && db.events?.find(e=>e.id===id)) selectRow(id);
    }
  } else if (parts[1] && !viewMap[parts[1]]) {
    const id = parseInt(parts[1]);
    if (id && db[tab]?.find(r=>r.id===id)) selectRow(id);
  }
}

window.addEventListener('popstate', applyHash);

// ── INIT ──────────────────────────────────────────────────────────────────────
const API = '/api/';

// ── VIEWER MODE ───────────────────────────────────────────────────────────────
let isViewerMode = false;

// ── AUTH ───────────────────────────────────────────────────────────────────────
let authHeader = localStorage.getItem('authHeader') || '';

function getAuthHeaders() {
  const h = {'Content-Type':'application/json'};
  if (authHeader) h['Authorization'] = authHeader;
  return h;
}

function showLogin() {
  const overlay = document.createElement('div');
  overlay.id = 'login-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
  overlay.innerHTML = `<div style="background:#fff;border-radius:12px;padding:32px;width:320px;box-shadow:0 12px 40px rgba(0,0,0,.2);position:relative">
    <button onclick="document.getElementById('login-overlay')?.remove()" style="position:absolute;top:12px;right:12px;background:none;border:none;color:#9ca3af;font-size:20px;cursor:pointer;line-height:1;padding:0">×</button>
    <h3 style="margin-bottom:16px;font-size:16px">Logga in</h3>
    <input id="login-user" placeholder="Användarnamn" style="width:100%;margin-bottom:8px;border:1px solid #d1d5db;border-radius:6px;padding:8px 10px;font-size:13px">
    <input id="login-pass" type="password" placeholder="Lösenord" style="width:100%;margin-bottom:16px;border:1px solid #d1d5db;border-radius:6px;padding:8px 10px;font-size:13px">
    <div id="login-error" style="color:#ef4444;font-size:12px;margin-bottom:8px;display:none">Fel användarnamn eller lösenord</div>
    <button class="btn" onclick="doLogin()" style="width:100%">Logga in</button>
  </div>`;
  document.body.appendChild(overlay);
  document.getElementById('login-user').focus();
  document.getElementById('login-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  document.getElementById('login-user').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
}

function doLogin() {
  const user = document.getElementById('login-user').value;
  const pass = document.getElementById('login-pass').value;
  const btn = document.querySelector('#login-overlay .btn');
  authHeader = 'Basic ' + btoa(user + ':' + pass);
  fetch(API + 'auth-check', { headers: { 'Authorization': authHeader } })
    .then(r => r.json())
    .then(data => {
      if (!data.ok) {
        document.getElementById('login-error').style.display = '';
        if (btn) { btn.style.background = '#ef4444'; setTimeout(() => btn.style.background = '', 1500); }
        authHeader = '';
        return;
      }
      localStorage.setItem('authHeader', authHeader);
      document.getElementById('login-overlay')?.remove();
      location.reload();
    })
    .catch(() => {
      document.getElementById('login-error').style.display = '';
      if (btn) { btn.style.background = '#ef4444'; setTimeout(() => btn.style.background = '', 1500); }
      authHeader = '';
    });
}

function doLogout() {
  authHeader = '';
  localStorage.removeItem('authHeader');
  location.reload();
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
function showToast(msg, type) {
  const t = document.createElement('div');
  const bg = type === 'error' ? '#ef4444' : type === 'warn' ? '#f59e0b' : '#10b981';
  t.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:10000;background:' + bg + ';color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,.2);transition:opacity .3s;max-width:400px';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3500);
}

function persist(key) {
  const base = key ? API + key : API;
  const url = base + (base.includes('?') ? '&' : '?') + 'v=' + dbVersion;
  const body = key ? JSON.stringify(db[key]) : JSON.stringify(db);
  fetch(url, {method:'PUT', headers: getAuthHeaders(), body})
    .then(r => {
      if (r.status === 401) { showLogin(); return null; }
      if (r.status === 409) {
        r.json().then(data => {
          showToast(data.message || 'Konflikt — ladda om sidan', 'error');
        });
        return null;
      }
      if (!r.ok) throw new Error('Kunde inte spara (' + r.status + ')');
      return r.json();
    })
    .then(data => {
      if (data && data.version) dbVersion = data.version;
    })
    .catch(err => showToast('Kunde inte spara: ' + err.message, 'error'));
}

function loadAssignments() {
  const saved = db.schedules || {};
  db.events.forEach(e => { assignments[e.id] = {}; });
  Object.entries(saved).forEach(([eid, tasks]) => {
    const numEid = parseInt(eid);
    if (!assignments[numEid]) assignments[numEid] = {};
    Object.entries(tasks).forEach(([tid, asgn]) => {
      assignments[numEid][parseInt(tid)] = asgn;
    });
  });
}

function loadApp() {
  const headers = authHeader ? { 'Authorization': authHeader } : {};
  fetch(API, { headers })
    .then(r => {
      if (!r.ok) throw new Error('Serverfel (' + r.status + ')');
      return r.json();
    })
    .then(data => {
      if (!data) return;
      db = data;
      dbVersion = db._version || 0;
      // Detect viewer mode: contacts have no email field (unauthenticated or viewer token)
      isViewerMode = db.contacts && db.contacts.length > 0 && !('email' in db.contacts[0]);
      if (isViewerMode) applyViewerMode();
      if (typeof initTheme === 'function') initTheme();
      loadAssignments();
      document.getElementById('sim-date').value = simDate || localDate(new Date());
      updateSimWarning();
      document.getElementById('view-toggle').style.display = '';
      document.getElementById('btn-generate').style.display = '';
      _suppressHash = true;
      renderFilter();
      renderYearPicker();
      applyFilters();
      _suppressHash = false;
      applyHash();
    })
    .catch(err => {
      showToast('Kunde inte ladda data: ' + err.message, 'error');
      document.getElementById('stats-bar').innerHTML =
        `<span class="stat" style="color:#ef4444">⚠ Kunde inte ladda data — kör: node server.js</span>`;
    });
}

// Try loading — if 401, show login
loadApp();

function applyViewerMode() {
  // Hide admin nav items
  ['nav-events-group','tab-schedule','tab-contacts','tab-tasks','tab-teams'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  document.querySelectorAll('nav > span[style*="width:12px"]').forEach(el => el.style.display = 'none');
  // Hide admin controls
  ['btn-generate','btn-new','search-input'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const themeMenu = document.getElementById('nav-theme');
  if (themeMenu) themeMenu.style.display = 'none';
  // Replace logout with login button
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.textContent = 'Logga in';
    logoutBtn.className = '';
    logoutBtn.style.cssText = 'background:none;border:none;color:'+acMid()+';padding:6px 12px;border-radius:6px;cursor:pointer;font-size:13px';
    logoutBtn.onclick = function() { showLogin(); };
  }
  // Move viewer-relevant buttons to nav as top-level
  const outputsBtn = document.getElementById('tab-outputs');
  if (outputsBtn) outputsBtn.style.display = 'none';
  const nav = document.querySelector('nav');
  const spacer = document.querySelector('nav .spacer');
  ['tab-slides','tab-namnskyltar','tab-sunday'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) nav.insertBefore(btn, spacer);
  });
  const dropdown = document.getElementById('nav-outputs');
  if (dropdown) dropdown.style.display = 'none';
  // Hide mailbot — viewer shouldn't send emails
  const mailBtn = document.getElementById('tab-mailbot');
  if (mailBtn) mailBtn.style.display = 'none';
  // Default to slides tab
  if (!location.hash || location.hash === '#events') {
    switchTab('slides');
  }
}
