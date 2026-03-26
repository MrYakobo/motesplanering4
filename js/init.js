// ── HASH ROUTING ──────────────────────────────────────────────────────────────
function updateHash() {
  let hash = '#' + currentTab;
  if (currentTab === 'events' && currentView === 'monster') hash += '/schedule';
  if (currentTab === 'events' && currentView === 'calendar') hash += '/calendar';
  if (currentTab === 'events' && currentView === 'week') hash += '/week';
  if (currentTab === 'events' && currentView === 'year') hash += '/year';
  if (selectedId) hash += '/' + selectedId;
  if (location.hash !== hash) history.replaceState(null, '', hash);
}

function applyHash() {
  const hash = location.hash.replace(/^#/, '');
  if (!hash) return;
  const parts = hash.split('/');
  const tab = parts[0];
  if (!tabConfig[tab]) return;

  switchTab(tab, true);

  if (tab === 'slides' && parts[1] === 'fullscreen') {
    enterSlidesFullscreen();
    return;
  }

  if (tab === 'namnskyltar' && parts[1] === 'fullscreen') {
    const taskId = parts[2] ? parseInt(parts[2]) : null;
    enterNameplateFullscreen(taskId);
    return;
  }

  const viewMap = {schedule:'monster', calendar:'calendar', week:'week', year:'year'};
  if (tab === 'events' && viewMap[parts[1]]) {
    setView(viewMap[parts[1]]);
    if (parts[2]) {
      const id = parseInt(parts[2]);
      if (id && db.events?.find(e=>e.id===id)) selectRow(id);
    }
  } else if (parts[1] && !viewMap[parts[1]]) {
    const id = parseInt(parts[1]);
    if (id && db[tab]?.find(r=>r.id===id)) selectRow(id);
  }
}

window.addEventListener('hashchange', applyHash);

// ── INIT ──────────────────────────────────────────────────────────────────────
const API = '/api/';

function persist(key) {
  // save a single collection, or entire db if no key
  const url = key ? API + key : API;
  const body = key ? JSON.stringify(db[key]) : JSON.stringify(db);
  fetch(url, {method:'PUT', headers:{'Content-Type':'application/json'}, body})
    .catch(err => console.warn('Persist failed:', err));
}

function loadAssignments() {
  const saved = db.schedules || {};
  db.events.forEach(e => { assignments[e.id] = {}; });
  // saved format: { eventId: { taskId: {type, id/ids} } }
  Object.entries(saved).forEach(([eid, tasks]) => {
    const numEid = parseInt(eid);
    if (!assignments[numEid]) assignments[numEid] = {};
    Object.entries(tasks).forEach(([tid, asgn]) => {
      assignments[numEid][parseInt(tid)] = asgn;
    });
  });
}

fetch(API)
  .then(r => r.json())
  .then(data => {
    db = data;
    loadAssignments();
    document.getElementById('sim-date').value = simDate || localDate(new Date());
    updateSimWarning();
    document.getElementById('view-toggle').style.display = '';
    document.getElementById('btn-generate').style.display = '';
    renderFilter();
    renderYearPicker();
    applyFilters();
    applyHash();
  })
  .catch(err => {
    // fallback: try loading data.json directly (for file:// or no server)
    fetch('data_prod.json').then(r=>r.json()).then(data => {
      db = data;
      loadAssignments();
      document.getElementById('view-toggle').style.display = '';
      document.getElementById('btn-generate').style.display = '';
      renderFilter();
      renderYearPicker();
      applyFilters();
      applyHash();
    }).catch(err2 => {
      document.getElementById('stats-bar').innerHTML =
        `<span class="stat" style="color:#ef4444">⚠ Failed to load data — run: node server.js</span>`;
      console.error(err2);
    });
  });
