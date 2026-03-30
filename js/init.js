// ── HASH ROUTING ──────────────────────────────────────────────────────────────
let _lastPushedHash = location.hash;
let _hashIsReplace = false;

let _suppressHash = false;

function updateHash(replace) {
  if (_suppressHash) return;
  let hash = '#' + currentTab;
  if (currentTab === 'events' && currentView === 'calendar') hash += '/calendar';
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
let isMemberMode = false;
let memberContactId = null;
let memberToken = new URLSearchParams(location.search).get('token') || localStorage.getItem('memberToken') || '';

// ── AUTH ───────────────────────────────────────────────────────────────────────
let authHeader = localStorage.getItem('authHeader') || '';

function getAuthHeaders() {
  const h = {'Content-Type':'application/json'};
  if (authHeader) h['Authorization'] = authHeader;
  if (memberToken) h['X-Member-Token'] = memberToken;
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
  memberToken = '';
  localStorage.removeItem('authHeader');
  localStorage.removeItem('memberToken');
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
  // Persist token from URL to localStorage, then clean URL
  if (memberToken && new URLSearchParams(location.search).get('token')) {
    localStorage.setItem('memberToken', memberToken);
    history.replaceState(null, '', location.pathname + location.hash);
  }

  const headers = getAuthHeaders();
  // Check role first
  fetch(API + 'me', { headers })
    .then(r => r.json())
    .then(me => {
      if (me.role === 'member') {
        isMemberMode = true;
        memberContactId = me.contactId;
      }
      return fetch(API, { headers });
    })
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
      else if (isMemberMode) applyMemberMode();
      else if (authHeader) setupUserAvatar('Admin', 'admin');
      if (typeof initTheme === 'function') initTheme();
      loadAssignments();
      document.getElementById('sim-date').value = simDate || localDate(new Date());
      updateSimWarning();
      document.getElementById('view-toggle').style.display = '';
      document.getElementById('btn-generate').style.display = '';
      document.getElementById('btn-subscribe').style.display = '';
      _suppressHash = true;
      renderFilter();
      renderYearPicker();
      applyFilters();
      _suppressHash = false;
      applyHash();
      if (window.innerWidth <= 480) {
        createMobileBottomNav();
        // Re-highlight active tab on bottom nav
        document.querySelectorAll('#mobile-bottom-nav button').forEach(b=>b.classList.remove('active'));
        const mobId = currentTab === 'schema' ? 'mob-schema' : 'mob-' + currentTab;
        const mobBtn = document.getElementById(mobId);
        if (mobBtn) mobBtn.classList.add('active');
      }
    })
    .catch(err => {
      showToast('Kunde inte ladda data: ' + err.message, 'error');
      document.getElementById('stats-bar').innerHTML =
        `<span class="stat" style="color:#ef4444">⚠ Kunde inte ladda data — kör: node server.js</span>`;
    });
}

// Try loading — if 401, show login
loadApp();

function createMobileBottomNav() {
  if (document.getElementById('mobile-bottom-nav')) return;
  const nav = document.createElement('div');
  nav.id = 'mobile-bottom-nav';
  nav.style.display = 'none'; // CSS shows it at ≤480px
  const tabs = isViewerMode
    ? [
        {id:'home', icon:'home', label:'Hem'},
        {id:'slides', icon:'monitor', label:'Slides'},
        {id:'namnskyltar', icon:'id-card', label:'Skyltar'},
        {id:'sunday', icon:'clipboard-list', label:'Söndag'},
      ]
    : [
        {id:'events', icon:'calendar', label:'Händelser'},
        {id:'schema', icon:'table', label:'Schema'},
        {id:'events/calendar', icon:'calendar-days', label:'Månadsvy', action: function() { switchTab('events'); setView('calendar'); closeMobileMore(); }},
        {id:'events/week', icon:'calendar-range', label:'Veckovy', action: function() { switchTab('events'); setView('week'); closeMobileMore(); }},
        {id:'more', icon:'menu', label:'Mer'},
      ];
  tabs.forEach(function(t) {
    const btn = document.createElement('button');
    btn.id = 'mob-' + t.id.replace('/','_');
    btn.innerHTML = '<i data-lucide="' + t.icon + '"></i><span>' + t.label + '</span>';
    if (t.id === 'more') {
      btn.onclick = function() { toggleMobileMore(); };
    } else if (t.action) {
      btn.onclick = t.action;
    } else {
      btn.onclick = function() { switchTab(t.id); closeMobileMore(); };
    }
    nav.appendChild(btn);
  });
  // Move user avatar into bottom nav
  const userNav = document.getElementById('nav-user');
  if (userNav) {
    const avatarWrap = document.createElement('button');
    avatarWrap.id = 'mob-user';
    avatarWrap.style.cssText = 'flex:none;width:36px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:none;border:none;cursor:pointer;padding:2px 0';
    const avatar = document.getElementById('user-avatar');
    if (avatar && avatar.style.display !== 'none') {
      const av = avatar.cloneNode(true);
      av.id = 'mob-user-avatar';
      av.removeAttribute('onclick');
      avatarWrap.appendChild(av);
    } else {
      avatarWrap.innerHTML = '<i data-lucide="user" style="width:14px;height:14px;color:#9ca3af"></i>';
    }
    avatarWrap.onclick = function(e) {
      e.stopPropagation();
      toggleMobileUserMenu();
    };
    nav.appendChild(avatarWrap);
  }
  document.body.appendChild(nav);
  lucide.createIcons({nameAttr:'data-lucide', attrs:{class:'lucide-icon'}});
}

function toggleMobileMore() {
  let sheet = document.getElementById('mobile-more-sheet');
  if (sheet) { closeMobileMore(); return; }
  sheet = document.createElement('div');
  sheet.id = 'mobile-more-sheet';
  sheet.style.cssText = 'position:fixed;bottom:44px;left:0;right:0;z-index:39;background:#1a1a2e;border-top:1px solid #2d2d4e;padding:8px;display:flex;flex-direction:column;gap:2px;max-height:60vh;overflow-y:auto';
  const items = [
    {id:'contacts', icon:'users', label:'Kontakter'},
    {id:'teams', icon:'users-round', label:'Team'},
    {id:'categories', icon:'tags', label:'Kategorier'},
    {id:'slides', icon:'monitor', label:'Slides'},
    {id:'export', icon:'file-text', label:'Månadsblad'},
    {id:'mailbot', icon:'mail', label:'Påminnelsemail'},
    {id:'namnskyltar', icon:'id-card', label:'Namnskyltar'},
    {id:'sunday', icon:'clipboard-list', label:'Söndag'},
  ];
  items.forEach(function(t) {
    const btn = document.createElement('button');
    btn.style.cssText = 'background:none;border:none;color:#ccc;padding:10px 14px;font-size:14px;text-align:left;display:flex;align-items:center;gap:10px;border-radius:6px;cursor:pointer;width:100%';
    btn.innerHTML = '<i data-lucide="' + t.icon + '" style="width:18px;height:18px"></i> ' + t.label;
    btn.onclick = function() { switchTab(t.id); closeMobileMore(); };
    sheet.appendChild(btn);
  });
  // Backdrop
  const backdrop = document.createElement('div');
  backdrop.id = 'mobile-more-backdrop';
  backdrop.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:44px;z-index:38;background:rgba(0,0,0,.3)';
  backdrop.onclick = closeMobileMore;
  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);
  lucide.createIcons({nameAttr:'data-lucide', attrs:{class:'lucide-icon'}});
}

function closeMobileMore() {
  const sheet = document.getElementById('mobile-more-sheet');
  const backdrop = document.getElementById('mobile-more-backdrop');
  if (sheet) sheet.remove();
  if (backdrop) backdrop.remove();
}

function toggleMobileUserMenu() {
  let sheet = document.getElementById('mobile-user-sheet');
  if (sheet) { closeMobileUserMenu(); return; }
  closeMobileMore();
  const menu = document.getElementById('user-menu');
  if (!menu) return;
  sheet = document.createElement('div');
  sheet.id = 'mobile-user-sheet';
  sheet.style.cssText = 'position:fixed;bottom:44px;left:0;right:0;z-index:39;background:#1a1a2e;border-top:1px solid #2d2d4e;padding:0;max-height:60vh;overflow-y:auto';
  sheet.innerHTML = menu.innerHTML;
  // Ensure all buttons have correct styling outside nav-dropdown context
  sheet.querySelectorAll('button').forEach(function(btn) {
    btn.style.background = 'none';
    btn.style.border = 'none';
    btn.style.cursor = 'pointer';
  });
  // Wire up button clicks to also close the sheet
  sheet.querySelectorAll('button').forEach(function(btn) {
    const orig = btn.getAttribute('onclick');
    if (orig) {
      btn.removeAttribute('onclick');
      btn.addEventListener('click', function() {
        closeMobileUserMenu();
        new Function(orig)();
      });
    }
  });
  var backdrop = document.createElement('div');
  backdrop.id = 'mobile-user-backdrop';
  backdrop.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:44px;z-index:38;background:rgba(0,0,0,.3)';
  backdrop.onclick = closeMobileUserMenu;
  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);
  lucide.createIcons({nameAttr:'data-lucide', attrs:{class:'lucide-icon'}});
}

function closeMobileUserMenu() {
  var sheet = document.getElementById('mobile-user-sheet');
  var backdrop = document.getElementById('mobile-user-backdrop');
  if (sheet) sheet.remove();
  if (backdrop) backdrop.remove();
}

function applyViewerMode() {
  // Hide admin nav items
  ['nav-events-group','tab-schema','tab-contacts','tab-tasks','tab-teams'].forEach(id => {
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
  // Hide user menu, show login link instead
  const userNav = document.getElementById('nav-user');
  if (userNav) {
    userNav.innerHTML = '<button onclick="showLogin()" style="color:'+acMid()+';font-size:13px;padding:6px 12px;border:none;background:none;cursor:pointer">Logga in</button>';
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
  // Add home button
  const homeBtn = document.createElement('button');
  homeBtn.id = 'tab-home';
  homeBtn.onclick = function() { switchTab('home'); };
  homeBtn.innerHTML = '<i data-lucide="home" style="width:14px;height:14px"></i> Hem';
  nav.insertBefore(homeBtn, nav.querySelector('#tab-slides'));
  const dropdown = document.getElementById('nav-outputs');
  if (dropdown) dropdown.style.display = 'none';
  // Hide mailbot — viewer shouldn't send emails
  const mailBtn = document.getElementById('tab-mailbot');
  if (mailBtn) mailBtn.style.display = 'none';
  // Show landing page or default to slides
  if (!location.hash || location.hash === '#' || location.hash === '#events') {
    switchTab('home');
  }
}

function renderLanding() {
  const area = document.getElementById('landing-area');
  if (!area) return;
  const orgName = (db.settings && db.settings.orgName) || 'Mötesplanering';
  const orgLogo = (db.settings && db.settings.orgLogo) || '';
  const logoHtml = orgLogo ? '<img src="' + orgLogo + '" style="height:72px;width:auto;margin-bottom:16px;opacity:.9" alt="">' : '';

  const todayStr = getTodayStr();
  const todayEvents = (db.events||[]).filter(function(e) { return e.date === todayStr; }).sort(function(a,b) { return (a.time||'').localeCompare(b.time||''); });
  const nextEvent = todayEvents[0];
  const nextLabel = nextEvent ? esc(nextEvent.title) + ' kl ' + (nextEvent.time||'') : 'Inga händelser idag';

  const cardStyle = 'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:20px;cursor:pointer;transition:all .15s;text-decoration:none;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;min-width:160px;flex:1';
  const cardHover = 'onmouseover="this.style.background=\'rgba(255,255,255,.12)\';this.style.borderColor=\'rgba(255,255,255,.15)\'" onmouseout="this.style.background=\'rgba(255,255,255,.06)\';this.style.borderColor=\'rgba(255,255,255,.08)\'"';

  area.innerHTML = '<div style="min-height:100%;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);display:flex;flex-direction:column;align-items:center;padding:60px 24px 40px;overflow-y:auto;font-family:system-ui,sans-serif">' +
    '<div style="text-align:center;max-width:600px;width:100%">' +
    logoHtml +
    '<h1 style="font-size:clamp(32px,5vw,48px);font-weight:800;color:#fff;margin-bottom:6px;letter-spacing:-.03em">' + esc(orgName) + '</h1>' +
    '<p style="font-size:15px;color:rgba(255,255,255,.4);margin-bottom:48px">Mötesplanering & volontärschema</p>' +

    // Today highlight
    '<div style="background:rgba(255,255,255,.05);border-radius:12px;padding:14px 20px;margin-bottom:40px;display:inline-flex;align-items:center;gap:10px">' +
    '<i data-lucide="clock" style="width:18px;height:18px;color:' + ac() + '"></i>' +
    '<span style="font-size:14px;color:rgba(255,255,255,.7)">' + nextLabel + '</span>' +
    '</div>' +

    // Action cards
    '<div style="display:flex;gap:14px;flex-wrap:wrap;justify-content:center;margin-bottom:48px">' +
    '<a href="#sunday" style="' + cardStyle + '" ' + cardHover + '>' +
    '<i data-lucide="clipboard-list" style="width:28px;height:28px;color:' + ac() + '"></i>' +
    '<span style="font-size:14px;font-weight:600;color:#fff">Dagens tjänstgöring</span>' +
    '<span style="font-size:11px;color:rgba(255,255,255,.35)">Vem gör vad idag</span></a>' +

    '<a href="#slides" style="' + cardStyle + '" ' + cardHover + '>' +
    '<i data-lucide="monitor" style="width:28px;height:28px;color:' + ac() + '"></i>' +
    '<span style="font-size:14px;font-weight:600;color:#fff">Bildspel</span>' +
    '<span style="font-size:11px;color:rgba(255,255,255,.35)">Veckans program på storskärm</span></a>' +

    '<a href="#namnskyltar" style="' + cardStyle + '" ' + cardHover + '>' +
    '<i data-lucide="id-card" style="width:28px;height:28px;color:' + ac() + '"></i>' +
    '<span style="font-size:14px;font-weight:600;color:#fff">Namnskyltar</span>' +
    '<span style="font-size:11px;color:rgba(255,255,255,.35)">Fullskärm med namn & roll</span></a>' +
    '</div>' +

    // Features
    '<div style="display:flex;gap:32px;flex-wrap:wrap;justify-content:center;margin-bottom:40px">' +
    '<div style="text-align:center;width:120px"><i data-lucide="calendar" style="width:20px;height:20px;color:rgba(255,255,255,.3);margin-bottom:6px"></i><div style="font-size:12px;color:rgba(255,255,255,.5)">Kalender</div></div>' +
    '<div style="text-align:center;width:120px"><i data-lucide="users" style="width:20px;height:20px;color:rgba(255,255,255,.3);margin-bottom:6px"></i><div style="font-size:12px;color:rgba(255,255,255,.5)">Volontärer</div></div>' +
    '<div style="text-align:center;width:120px"><i data-lucide="mail" style="width:20px;height:20px;color:rgba(255,255,255,.3);margin-bottom:6px"></i><div style="font-size:12px;color:rgba(255,255,255,.5)">Påminnelser</div></div>' +
    '<div style="text-align:center;width:120px"><i data-lucide="shuffle" style="width:20px;height:20px;color:rgba(255,255,255,.3);margin-bottom:6px"></i><div style="font-size:12px;color:rgba(255,255,255,.5)">Auto-fördelning</div></div>' +
    '</div>' +

    '</div></div>';

  lucide.createIcons({nameAttr:'data-lucide', attrs:{class:'lucide-icon'}});
}

function applyMemberMode() {
  // Hide admin-only tabs: settings, mailbot, export, generate
  ['tab-settings','tab-mailbot','tab-export','tab-generate'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  // Hide new-record buttons (members can't create events/tasks/contacts)
  ['btn-generate','btn-new'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const me = db.contacts?.find(c => c.id === memberContactId);
  if (me) setupUserAvatar(me.name, 'member');
}

function setupUserAvatar(fullName, role) {
  const avatar = document.getElementById('user-avatar');
  if (!avatar) return;
  const parts = fullName.split(' ').filter(Boolean);
  const initials = parts.length >= 2 ? (parts[0][0] + parts[parts.length-1][0]).toUpperCase() : (parts[0] || '?').slice(0,2).toUpperCase();
  avatar.textContent = initials;
  avatar.style.display = '';
  avatar.onclick = function(e) {
    e.stopPropagation();
    document.getElementById('nav-user').classList.toggle('open');
  };
  document.addEventListener('click', function(e) {
    const nav = document.getElementById('nav-user');
    if (nav && !nav.contains(e.target)) nav.classList.remove('open');
  });

  const menu = document.getElementById('user-menu');
  if (!menu) return;
  menu.style.cssText = 'right:0;left:auto;min-width:280px;padding:0;border-radius:12px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.5)';

  let html = '';
  // Profile header with large avatar
  html += '<div style="padding:20px;display:flex;align-items:center;gap:14px;border-bottom:1px solid #2d2d4e">';
  html += '<div style="width:56px;height:56px;border-radius:50%;background:' + ac() + ';color:#fff;font-size:22px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + initials + '</div>';
  html += '<div><div style="font-size:16px;font-weight:600;color:#fff">' + esc(fullName) + '</div>';
  html += '<div style="font-size:12px;color:#9ca3af">' + (role === 'admin' ? 'Administratör' : 'Medlem') + '</div></div>';
  html += '</div>';

  // Menu items
  html += '<div style="padding:6px">';
  if (role === 'member') {
    html += '<button onclick="showMyEvents();document.getElementById(\'nav-user\').classList.remove(\'open\')" style="width:100%;text-align:left;padding:10px 14px;font-size:13px;color:#ccc;display:flex;align-items:center;gap:10px;border-radius:6px"><i data-lucide="calendar-check" style="width:16px;height:16px"></i> Mina händelser</button>';
    html += '<button onclick="editMyDetails();document.getElementById(\'nav-user\').classList.remove(\'open\')" style="width:100%;text-align:left;padding:10px 14px;font-size:13px;color:#ccc;display:flex;align-items:center;gap:10px;border-radius:6px"><i data-lucide="user-pen" style="width:16px;height:16px"></i> Redigera mina uppgifter</button>';
  }
  if (role === 'admin') {
    html += '<button onclick="openSettings();document.getElementById(\'nav-user\').classList.remove(\'open\')" style="width:100%;text-align:left;padding:10px 14px;font-size:13px;color:#ccc;display:flex;align-items:center;gap:10px;border-radius:6px"><i data-lucide="settings" style="width:16px;height:16px"></i> Inställningar</button>';
  }
  html += '</div>';

  // Logout
  html += '<div style="padding:6px;border-top:1px solid #2d2d4e">';
  html += '<button onclick="doLogout()" style="width:100%;text-align:left;padding:10px 14px;font-size:13px;color:#f87171;display:flex;align-items:center;gap:10px;border-radius:6px"><i data-lucide="log-out" style="width:16px;height:16px"></i> Logga ut</button>';
  html += '</div>';

  menu.innerHTML = html;
  lucide.createIcons({nameAttr:'data-lucide', attrs:{class:'lucide-icon'}});
}

function editMyDetails() {
  const c = db.contacts?.find(x => x.id === memberContactId);
  if (!c) return;
  const body = UI.field('Namn', UI.input('my-name', c.name)) +
    UI.field('E-post', UI.input('my-email', c.email || '', {type:'email'})) +
    UI.field('Telefon', UI.input('my-phone', c.phone || '', {type:'tel'}));
  UI.openModal('Mina uppgifter', body, UI.button('Spara', 'saveMyDetails()'));
}

function saveMyDetails() {
  const body = JSON.stringify({
    name: document.getElementById('my-name').value,
    email: document.getElementById('my-email').value,
    phone: document.getElementById('my-phone').value,
  });
  fetch(API + 'me/contact', { method: 'PUT', headers: getAuthHeaders(), body })
    .then(r => { if (!r.ok) throw new Error('Kunde inte spara'); return r.json(); })
    .then(data => {
      if (data.ok) {
        const c = db.contacts?.find(x => x.id === memberContactId);
        if (c) { c.name = data.contact.name; c.email = data.contact.email; c.phone = data.contact.phone; }
        closeDetailModal();
        setupUserAvatar(c.name, 'member');
        showToast('Uppgifter sparade', 'ok');
      }
    })
    .catch(err => showToast(err.message, 'error'));
}

function showMyEvents() {
  const cid = memberContactId;
  if (!cid) return;
  const todayStr = getTodayStr();
  const upcoming = (db.events||[])
    .filter(e => e.date >= todayStr)
    .filter(e => {
      const asgn = assignments[e.id] || {};
      return Object.values(asgn).some(val => {
        if (val.type === 'contact') return (val.ids||[]).includes(cid);
        if (val.type === 'team') { const team = (db.teams||[]).find(t=>t.id===val.id); return team && team.members.includes(cid); }
        return false;
      });
    })
    .sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time))
    .slice(0, 20);

  const listHtml = upcoming.length > 0
    ? upcoming.map(e => {
        const asgn = assignments[e.id]||{};
        const tasks = Object.entries(asgn).filter(([tid,val]) => {
          if (val.type==='contact') return (val.ids||[]).includes(cid);
          if (val.type==='team') { const team=(db.teams||[]).find(t=>t.id===val.id); return team&&team.members.includes(cid); }
          return false;
        }).map(([tid])=>(db.tasks||[]).find(t=>t.id===parseInt(tid))?.name).filter(Boolean).join(', ');
        return '<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:13px">' +
          '<span style="min-width:80px;color:#6b7280">' + e.date + '</span>' +
          '<span style="flex:1;color:#374151;font-weight:500">' + esc(e.title) + '</span>' +
          '<span style="color:' + ac() + ';font-size:12px">' + esc(tasks) + '</span></div>';
      }).join('')
    : '<p style="color:#9ca3af;font-size:13px">Inga kommande tilldelningar</p>';

  const me = db.contacts?.find(c => c.id === cid);
  const icalSlug = me ? slugifyEmail(me.email) : '';
  const icalUrl = icalSlug ? (location.origin + '/api/cal/' + icalSlug + '.ics') : '';
  const webcalUrl = icalUrl ? icalUrl.replace(/^https?:/, 'webcal:') : '';
  const calLink = icalUrl
    ? '<div style="margin-top:12px;padding-top:12px;border-top:1px solid #f0f0f0;display:flex;align-items:center;gap:8px">' +
      '<a href="' + webcalUrl + '" style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:' + ac() + ';text-decoration:none"><i data-lucide="calendar-plus" style="width:14px;height:14px"></i> Lägg till i kalenderapp</a>' +
      '<button onclick="navigator.clipboard.writeText(\'' + escAttr(icalUrl) + '\');showToast(\'Kopierad!\',\'ok\')" style="background:none;border:none;color:#9ca3af;cursor:pointer;font-size:11px" data-tip="Kopiera iCal-länk"><i data-lucide="copy" style="width:12px;height:12px"></i></button>' +
      '</div>'
    : '';

  const modal = document.getElementById('detail-modal');
  document.getElementById('detail-modal-content').innerHTML =
    '<div class="sidebar-header"><h3>Mina händelser</h3><button class="sidebar-close" onclick="closeDetailModal()">×</button></div>' +
    '<div class="sidebar-body">' + listHtml + calLink + '</div>';
  modal.classList.add('open');
  lucide.createIcons({nameAttr:'data-lucide', attrs:{class:'lucide-icon'}});
}
