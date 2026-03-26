function newRecord() {
  if (currentTab === 'slides') return;
  if (currentTab === 'events') {
    newEventOnDate(getTodayStr());
    return;
  }
  if (currentTab === 'tasks') {
    newTask();
    return;
  }
  alert('New ' + tabConfig[currentTab].label.slice(0,-1) + ' — wire up to your backend!');
}

function newContact() {
  const maxId = db.contacts.reduce((m,c) => Math.max(m,c.id), 0) + 1;
  const draft = {id:maxId, name:'', email:'', phone:'', _isNew:true};
  const modal = document.getElementById('detail-modal');
  document.getElementById('detail-modal-content').innerHTML = sidebarContact(draft);
  modal.classList.add('open');
  initSidebarTracking();
  lucide.createIcons({nameAttr:'data-lucide', attrs:{class:'lucide-icon'}});
  const btn = document.getElementById('btn-save');
  if (btn) btn.classList.add('dirty');
}

function newTask() {
  const maxId = db.tasks.reduce((m,t) => Math.max(m,t.id), 0) + 1;
  const draft = {id:maxId, name:'', teamTask:false, mailbot:false, phrase:'', _isNew:true};
  const modal = document.getElementById('detail-modal');
  document.getElementById('detail-modal-content').innerHTML = sidebarTask(draft);
  modal.classList.add('open');
  initSidebarTracking();
  lucide.createIcons({nameAttr:'data-lucide', attrs:{class:'lucide-icon'}});
  const btn = document.getElementById('btn-save');
  if (btn) btn.classList.add('dirty');
}

function newEventOnDate(dateStr) {
  const maxId = db.events.reduce((m,e) => Math.max(m,e.id), 0) + 1;
  const draft = {id:maxId, title:'', category:'Weekday', date:dateStr, time:'10:00', description:'', volunteers:0, promoSlides:[], infoLink:'', expectedTasks:[], _isNew:true};
  const modal = document.getElementById('detail-modal');
  document.getElementById('detail-modal-content').innerHTML = sidebarEvent(draft);
  modal.classList.add('open');
  initSidebarTracking();
  lucide.createIcons({nameAttr:'data-lucide', attrs:{class:'lucide-icon'}});
  const btn = document.getElementById('btn-save');
  if (btn) btn.classList.add('dirty');
}

// ── SAVE EVENT + SMART PROPAGATION ────────────────────────────────────────────
function saveEvent(id) {
  const isNew = document.getElementById('btn-save')?.dataset.isNew === '1';

  if (isNew) {
    // Create new event from form values
    const ev = {
      id: id,
      date: document.getElementById('sb-date').value,
      time: document.getElementById('sb-time').value,
      title: document.getElementById('sb-title').value,
      category: document.getElementById('sb-category').value,
      description: document.getElementById('sb-desc').value,
      infoLink: document.getElementById('sb-infolink').value,
      promoSlides: [...document.querySelectorAll('#sb-promos input[data-promo-idx]')].map(i=>i.value).filter(Boolean),
      expectedTasks: [...document.querySelectorAll('[data-exp-task]')].filter(cb=>cb.checked).map(cb=>parseInt(cb.dataset.expTask)),
      volunteers: 0,
    };
    db.events.push(ev);
    assignments[ev.id] = {};
    persist('events');
    closeDetailModal();
    applyFilters();
    return;
  }

  const ev = db.events.find(e=>e.id===id);
  if (!ev) return;
  // snapshot original date before reading form
  const oldDate = ev.date;
  const oldTitle = ev.title;
  const skipFields = new Set(['id','date','time','volunteers','_isNew']);
  // snapshot all propagatable fields before edit
  const oldSnap = {};
  Object.keys(ev).forEach(k => { if (!skipFields.has(k)) oldSnap[k] = JSON.stringify(ev[k]); });
  // read sidebar values
  ev.date = document.getElementById('sb-date').value;
  ev.time = document.getElementById('sb-time').value;
  ev.title = document.getElementById('sb-title').value;
  ev.category = document.getElementById('sb-category').value;
  ev.description = document.getElementById('sb-desc').value;
  ev.infoLink = document.getElementById('sb-infolink').value;
  ev.promoSlides = [...document.querySelectorAll('#sb-promos input[data-promo-idx]')].map(i=>i.value).filter(Boolean);
  ev.expectedTasks = [...document.querySelectorAll('[data-exp-task]')].filter(cb=>cb.checked).map(cb=>parseInt(cb.dataset.expTask));

  // check which propagatable fields changed
  const changedFields = Object.keys(oldSnap).filter(k => JSON.stringify(ev[k]) !== oldSnap[k]);

  const futureMatches = db.events.filter(e => e.id !== id && e.title === oldTitle && e.date > oldDate);

  if (changedFields.length > 0 && futureMatches.length > 0) {
    showPropagatePopup(ev, futureMatches, oldTitle, changedFields);
  } else {
    persist('events');
    applyFilters();
    if (['monster','calendar','week','year'].includes(currentView)) { closeDetailModal(); }
    else { renderSidebar(ev); }
  }
}

function showPropagatePopup(ev, matches, oldTitle, changedFields) {
  const count = matches.length;
  const overlay = document.getElementById('propagate-modal');
  document.getElementById('prop-msg').innerHTML =
    `Du ändrade <strong>"${oldTitle}"</strong>. Det finns <strong>${count}</strong> framtida händelse${count>1?'r':''} med samma titel.<br>Vill du uppdatera dem också?`;
  const fieldLabel = k => {
    const val = ev[k];
    const display = Array.isArray(val) ? `(${val.length} st)` : (val || '(tom)');
    return `${k} → ${display}`;
  };
  document.getElementById('prop-fields').innerHTML = changedFields.map(k =>
    `<label><input type="checkbox" checked data-prop="${k}"> ${fieldLabel(k)}</label>`
  ).join('');
  overlay._ev = ev;
  overlay._matches = matches;
  overlay.classList.add('open');
}

function executePropagation(apply) {
  const overlay = document.getElementById('propagate-modal');
  if (apply) {
    const ev = overlay._ev;
    const matches = overlay._matches;
    const fields = [...document.querySelectorAll('#prop-fields input[data-prop]')]
      .filter(cb=>cb.checked).map(cb=>cb.dataset.prop);
    matches.forEach(m => {
      fields.forEach(f => {
        m[f] = typeof ev[f] === 'object' ? JSON.parse(JSON.stringify(ev[f])) : ev[f];
      });
    });
  }
  overlay.classList.remove('open');
  persist('events');
  applyFilters();
  const ev = overlay._ev;
  if (['monster','calendar','week','year'].includes(currentView)) { closeDetailModal(); }
  else { renderSidebar(ev); }
}

function deleteEvent(id) {
  db.events = db.events.filter(e=>e.id!==id);
  delete assignments[id];
  selectedId = null;
  persist('events');
  if (currentView === 'monster' || currentView === 'calendar' || currentView === 'week') {
    closeDetailModal();
  } else {
    renderSidebar(null);
  }
  applyFilters();
}

function addPromoSlide(id) {
  const ev = db.events.find(e=>e.id===id);
  if (!ev) return;
  if (!ev.promoSlides) ev.promoSlides = [];
  ev.promoSlides.push('');
  rerenderEventForm(ev);
}

function removePromoSlide(id, idx) {
  const ev = db.events.find(e=>e.id===id);
  if (!ev) return;
  ev.promoSlides.splice(idx, 1);
  rerenderEventForm(ev);
}

function uploadPromoFile(input, id) {
  const file = input.files[0];
  if (!file) return;
  fetch('/upload', { method: 'POST', headers: {'Content-Type': file.type}, body: file })
    .then(r => r.json())
    .then(data => {
      const ev = db.events.find(e=>e.id===id);
      if (!ev) return;
      if (!ev.promoSlides) ev.promoSlides = [];
      ev.promoSlides.push(data.url);
      rerenderEventForm(ev);
      const btn = document.getElementById('btn-save');
      if (btn) btn.classList.add('dirty');
    })
    .catch(err => alert('Upload failed: ' + err));
}

function rerenderEventForm(ev) {
  const isModal = document.getElementById('detail-modal').classList.contains('open');
  if (isModal) {
    document.getElementById('detail-modal-content').innerHTML = sidebarEvent(ev);
    initSidebarTracking();
    lucide.createIcons({nameAttr:'data-lucide', attrs:{class:'lucide-icon'}});
  } else {
    renderSidebar(ev);
  }
}

// ── WARNING CONFIG ─────────────────────────────────────────────────────────────
let warningConfigOpen = false;

function toggleWarningConfig() {
  warningConfigOpen = !warningConfigOpen;
  if (warningConfigOpen) {
    selectedId = null;
    renderTable();
    renderWarningConfig();
  } else {
    renderSidebar(null);
  }
}

function renderWarningConfig() {
  const el = document.getElementById('sidebar-content');
  // group events by title to show unique "event types"
  const titleMap = {};
  (db.events||[]).forEach(ev => {
    if (!titleMap[ev.title]) titleMap[ev.title] = {category:ev.category, expectedTasks:ev.expectedTasks||[], count:0};
    titleMap[ev.title].count++;
  });

  const html = Object.entries(titleMap).sort((a,b)=>a[0].localeCompare(b[0])).map(([title, info]) => {
    const taskChecks = db.tasks.map(t =>
      `<label><input type="checkbox" ${info.expectedTasks.includes(t.id)?'checked':''} onchange="toggleTitleTasks('${title.replace(/'/g,"\\'")}',${t.id},this.checked)"> ${t.name}</label>`
    ).join('');
    const catCls = info.category === 'Sunday' ? 'sunday' : info.category === 'Special' ? 'special' : 'weekday';
    return `<div class="cat-section">
      <div class="cat-section-label">
        <span class="badge badge-${catCls}">${title}</span>
        <span style="font-size:12px;color:#6b7280">${info.expectedTasks.length} uppgifter · ${info.count} händelser</span>
      </div>
      <div class="cat-task-list">${taskChecks}</div>
    </div>`;
  }).join('');

  el.innerHTML = `
    <div class="sidebar-header">
      <h3>Förväntade uppgifter</h3>
      <button class="sidebar-close" onclick="toggleWarningConfig()">×</button>
    </div>
    <div class="sidebar-body">
      <p style="font-size:13px;color:#6b7280;margin-bottom:14px">Ändra förväntade uppgifter per händelsetyp. Ändringen gäller alla händelser med samma titel.</p>
      ${html}
    </div>`;
}

function toggleTitleTasks(title, taskId, checked) {
  db.events.filter(e=>e.title===title).forEach(ev => {
    if (!ev.expectedTasks) ev.expectedTasks = [];
    if (checked && !ev.expectedTasks.includes(taskId)) ev.expectedTasks.push(taskId);
    if (!checked) ev.expectedTasks = ev.expectedTasks.filter(id => id !== taskId);
  });
  persist('events');
  renderWarningConfig();
  if (currentView === 'monster') renderMonster();
  applyFilters();
}
