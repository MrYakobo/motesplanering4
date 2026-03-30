// ── CORE RENDER ───────────────────────────────────────────────────────────────
function switchTab(tab, skipHash) {
  if (slideTimer) { clearTimeout(slideTimer); slideTimer = null; }
  if (slideClockTimer) { clearInterval(slideClockTimer); slideClockTimer = null; }
  // Close mobile sidebar/popups when switching tabs
  var sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.remove('mobile-open');
  closeMobileMore();
  if (typeof closeMobileUserMenu === 'function') closeMobileUserMenu();
  currentTab = tab; selectedId = null; sortCol = null; sortDir = 1;
  if (tab === 'events' && currentView === 'monster') currentView = 'list';
  document.querySelectorAll('nav button[id^=tab-]').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+tab)?.classList.add('active');
  // Update mobile bottom nav
  document.querySelectorAll('#mobile-bottom-nav button').forEach(b=>b.classList.remove('active'));
  const mobBtn = document.getElementById('mob-' + tab);
  if (mobBtn) mobBtn.classList.add('active');
  // Highlight "Outputs" parent when an output tab is active
  const outBtn = document.getElementById('tab-outputs');
  if (outBtn) outBtn.classList.toggle('active', outputTabs.includes(tab));
  // Highlight "Händelser" parent when events or categories is active
  const evBtn = document.getElementById('tab-events');
  if (evBtn) evBtn.classList.toggle('active', tab === 'events' || tab === 'categories');
  // Highlight Schema nav button
  const schBtn = document.getElementById('tab-schema');
  if (schBtn) schBtn.classList.toggle('active', tab === 'schema');
  // Highlight Kategorier sub-link
  const catSub = document.getElementById('tab-categories');
  if (catSub) catSub.classList.toggle('active', tab === 'categories');
  // Highlight the correct event view sub-link
  if (tab === 'events') {
    const viewToSub = {list:'tab-ev-list', calendar:'tab-ev-calendar', week:'tab-ev-week', year:'tab-ev-year'};
    ['tab-ev-list','tab-ev-calendar','tab-ev-week','tab-ev-year','tab-categories'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active');
    });
    const activeSubId = viewToSub[currentView];
    if (activeSubId) {
      const el = document.getElementById(activeSubId);
      if (el) el.classList.add('active');
    }
  }
  updateSectionTitle();
  // Sync data-tip from tabConfig
  Object.entries(tabConfig).forEach(([k,v]) => {
    const el = document.getElementById('tab-'+k);
    if (el && v.desc) el.setAttribute('data-tip', v.desc);
  });
  document.getElementById('search-input').value = '';

  const isSlides = tab === 'slides';
  const isExport = tab === 'export';
  const isTeams = tab === 'teams';
  const isMailbot = tab === 'mailbot';
  const isNamn = tab === 'namnskyltar';
  const isCats = tab === 'categories';
  const isSunday = tab === 'sunday';
  const isHome = tab === 'home';
  const isSchema = tab === 'schema';
  const isSpecial = isSlides || isExport || isTeams || isMailbot || isCats || isNamn || isSunday || isHome || isSchema;
  const isEvents = tab === 'events';
  document.getElementById('table-area').style.display = (isSpecial) ? 'none' : '';
  document.getElementById('slides-area').style.display = isSlides ? '' : 'none';
  document.getElementById('export-area').style.display = isExport ? '' : 'none';
  document.getElementById('team-board-area').style.display = isTeams ? '' : 'none';
  document.getElementById('categories-area').style.display = isCats ? '' : 'none';
  document.getElementById('mailbot-area').style.display = isMailbot ? '' : 'none';
  document.getElementById('namnskyltar-area').style.display = isNamn ? '' : 'none';
  document.getElementById('sunday-area').style.display = isSunday ? '' : 'none';
  document.getElementById('schema-area').style.display = isSchema ? '' : 'none';
  document.getElementById('landing-area').style.display = isHome ? '' : 'none';
  document.getElementById('search-input').style.display = (isSpecial && !isSchema) ? 'none' : '';
  document.getElementById('btn-generate').style.display = isEvents ? '' : 'none';
  document.getElementById('btn-subscribe').style.display = isEvents ? '' : 'none';
  document.getElementById('view-toggle').style.display = isEvents ? '' : 'none';
  document.getElementById('stats-bar').style.display = isSchema ? '' : (isSpecial ? 'none' : '');
  if (tab !== 'events') currentView = 'list';
  document.getElementById('sidebar').style.display = (isTeams || isMailbot || isCats || isNamn || isSunday || isHome || isSchema) ? 'none' : '';

  if (isSlides) { renderSlides(); renderSlidesSidebar(); if (!skipHash) updateHash(); return; }
  if (isExport) { renderExport(); renderSidebar(null); if (!skipHash) updateHash(); return; }
  if (isTeams) { renderTeamBoard(); if (!skipHash) updateHash(); return; }
  if (isCats) { renderCategories(); if (!skipHash) updateHash(); return; }
  if (isMailbot) { renderMailbot(); if (!skipHash) updateHash(); return; }
  if (isNamn) { renderNamnskyltar(); if (!skipHash) updateHash(); return; }
  if (isSunday) { renderSunday(); if (!skipHash) updateHash(); return; }
  if (isHome) { renderLanding(); if (!skipHash) updateHash(); return; }
  if (isSchema) { renderSchema(); if (!skipHash) updateHash(); return; }
  renderFilter();
  renderYearPicker();
  applyFilters();
  renderSidebar(null);
  if (!skipHash) updateHash();
}

function setView(v) {
  currentView = v;
  calScrollInit = false;
  listScrolled = false;
  document.querySelector('.table-wrap').classList.toggle('monster', false);
  const calViews = ['calendar','week','year'];
  document.getElementById('sidebar').style.display = calViews.includes(v) ? 'none' : '';
  // Toggle nav highlights
  const evBtn = document.getElementById('tab-events');
  if (evBtn) evBtn.classList.toggle('active', true);
  const schBtn = document.getElementById('tab-schema');
  if (schBtn) schBtn.classList.remove('active');
  // Update mobile bottom nav
  document.querySelectorAll('#mobile-bottom-nav button').forEach(b=>b.classList.remove('active'));
  const mobBtn = document.getElementById('mob-events');
  if (mobBtn) mobBtn.classList.add('active');
  // Highlight the correct sub-link in the Händelser dropdown
  const viewToSub = {list:'tab-ev-list', calendar:'tab-ev-calendar', week:'tab-ev-week', year:'tab-ev-year'};
  ['tab-ev-list','tab-ev-calendar','tab-ev-week','tab-ev-year','tab-categories'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });
  const activeSubId = viewToSub[v];
  if (activeSubId) {
    const el = document.getElementById(activeSubId);
    if (el) el.classList.add('active');
  }
  if (v !== 'list') { selectedId = null; renderSidebar(null); }
  // Update section title for current view
  updateSectionTitle();
  renderTable();
  updateHash();
}

const viewLabels = {
  list:     { label: 'Händelser — Lista',   desc: 'Alla händelser i listvy' },
  calendar: { label: 'Händelser — Månad',   desc: 'Månadskalender' },
  week:     { label: 'Händelser — Vecka',   desc: 'Veckokalender' },
  year:     { label: 'Händelser — År',      desc: 'Årsöversikt' },
  monster:  { label: 'Schema',              desc: 'Tilldela personer och team till händelser' },
};

function updateSectionTitle() {
  if (currentTab === 'events') {
    const v = viewLabels[currentView] || viewLabels.list;
    document.getElementById('section-title').innerHTML = v.label + ' <span style="font-weight:400;font-size:12px;color:#9ca3af;margin-left:8px">' + v.desc + '</span>';
  } else {
    const cfg = tabConfig[currentTab];
    document.getElementById('section-title').innerHTML = cfg.label + (cfg.desc ? ' <span style="font-weight:400;font-size:12px;color:#9ca3af;margin-left:8px">' + cfg.desc + '</span>' : '');
  }
}

function updateScheduleBadge(count) {
  const el = document.getElementById('schedule-badge');
  if (!el) return;
  el.className = 'schedule-badge';
  if (count > 0) {
    el.textContent = count > 99 ? '99+' : count;
    el.style.background = '#f59e0b';
  } else {
    el.textContent = '✓';
    el.style.background = '#10b981';
  }
}

function renderFilter() {
  const sel = document.getElementById('filter-select');
  const cfg = tabConfig[currentTab].filter;
  if (!cfg) { sel.style.display='none'; return; }
  sel.style.display='';
  sel.innerHTML = cfg.options.map(o=>`<option>${o}</option>`).join('');
}

function renderYearPicker() {
  const ySel = document.getElementById('year-select');
  ySel.style.display = 'none';
}

function setYear(y) {
  selectedYear = parseInt(y);
  applyFilters();
}

function applyFilters() {
  if (currentTab === 'slides') return;
  if (currentTab === 'schema') { renderSchema(); updateHash(true); return; }
  const q = document.getElementById('search-input').value.toLowerCase();
  const sel = document.getElementById('filter-select');
  const fv = sel.style.display!=='none' ? sel.value : 'All';
  const cfg = tabConfig[currentTab];
  let data = [...(db[currentTab]||[])];
  // year filter for events — removed, show all years
  if (fv!=='All') data = data.filter(r=>String(r[cfg.filter.key]).toLowerCase()===fv.toLowerCase());
  if (q) data = data.filter(r=>{
    if (currentTab === 'events') {
      return r.title.toLowerCase().includes(q) || r.date.includes(q) || (r.time||'').includes(q) || (r.category||'').toLowerCase().includes(q) || (r.description||'').toLowerCase().includes(q);
    }
    return cfg.cols.some(c=>String(r[c.key]).toLowerCase().includes(q));
  });
  if (currentTab === 'events') {
    data.sort((a,b) => (a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));
  } else if (sortCol!==null) {
    data.sort((a,b)=>{
      let av=a[sortCol],bv=b[sortCol];
      return (av<bv?-1:av>bv?1:0)*sortDir;
    });
  }
  filtered = data;
  renderTable();
  document.getElementById('stats-bar').innerHTML = cfg.stats(data);
  lucide.createIcons({nameAttr:'data-lucide', attrs:{class:'lucide-icon'}});
  // Highlight search field when filter is active
  const searchEl = document.getElementById('search-input');
  searchEl.style.background = q ? '#eff6ff' : '';
  searchEl.style.borderColor = q ? '#93c5fd' : '';
  updateHash(true);
}

function getCurrentWeekRange() {
  const now = getToday();
  const mon = getMondayOfWeek(now, 0);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { from: localDate(mon), to: localDate(sun) };
}

function isCurrentWeek(dateStr) {
  const w = getCurrentWeekRange();
  return dateStr >= w.from && dateStr <= w.to;
}

function scrollToToday() {
  const row = document.querySelector('#table-body tr.current-week, #table-body tr.today-row, #table-body tr.today-line');
  if (row) {
    row.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
}

function updateScrollTodayVisibility() {
  const btn = document.getElementById('scroll-today-wrap');
  if (!btn) return;
  const row = document.querySelector('#table-body tr.current-week, #table-body tr.today-row, #table-body tr.today-line');
  if (!row) { btn.style.display = 'none'; return; }
  const wrap = document.querySelector('.table-wrap');
  const wrapRect = wrap.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  const visible = rowRect.bottom > wrapRect.top && rowRect.top < wrapRect.bottom;
  btn.style.display = visible ? 'none' : '';
  // Show arrow direction
  if (!visible) {
    const above = rowRect.bottom <= wrapRect.top;
    btn.querySelector('button').textContent = (above ? '↑' : '↓') + ' Idag';
  }
}

// Listen for scroll on the table wrap to toggle the button
document.addEventListener('DOMContentLoaded', () => {
  const wrap = document.querySelector('.table-wrap');
  if (wrap) wrap.addEventListener('scroll', updateScrollTodayVisibility);
});

function renderTable() {
  // hide/show calendar container and add bar
  const calC = document.getElementById('cal-container');
  const tbl = document.querySelector('.table-wrap table');
  const calViews = ['calendar','week','year'];
  if (currentTab === 'events' && calViews.includes(currentView)) {
    if (tbl) tbl.style.display = 'none';
    const stBtn = document.getElementById('scroll-today-wrap');
    if (stBtn) stBtn.remove();
    if (currentView === 'calendar') renderCalendar();
    else if (currentView === 'week') renderWeekView();
    else if (currentView === 'year') renderYearView();
    return;
  } else {
    if (calC) calC.style.display = 'none';
    if (tbl) tbl.style.display = '';
  }
  if (currentTab === 'events' && currentView === 'monster') { renderMonster(); return; }
  const cfg = tabConfig[currentTab];
  const sortable = currentTab !== 'events';
  const isEventsList = currentTab === 'events' && currentView === 'list';
  const arrowCol = isEventsList ? '<th style="width:20px;padding:0;cursor:default"></th>' : '';
  document.getElementById('table-head').innerHTML = '<tr>'+arrowCol+cfg.cols.map(c=>
    sortable
      ? `<th onclick="sortBy('${c.key}')" class="${sortCol===c.key?'sorted':''}">${c.label}<span class="si">${sortCol===c.key?(sortDir===1?'↑':'↓'):'↕'}</span></th>`
      : `<th style="cursor:default">${c.label}</th>`
  ).join('')+'<th style="width:40px"></th></tr>';
  const todayStr = isEventsList ? getTodayStr() : null;
  const hasTodayEvent = isEventsList && filtered.some(r => r.date === todayStr);
  document.getElementById('table-body').innerHTML = filtered.map((row, idx) => {
    const weekCls = currentTab === 'events' && isCurrentWeek(row.date) ? ' current-week' : '';
    const todayCls = currentTab === 'events' && row.date === todayStr ? ' today-row' : '';
    const isToday = isEventsList && row.date === todayStr;
    const arrowTd = isEventsList
      ? `<td style="width:20px;padding:0;text-align:center;vertical-align:middle">${isToday ? '<span data-tip="Idag"><i data-lucide="arrow-right" style="width:14px;height:14px;color:'+ac()+'"></i></span>' : ''}</td>`
      : '';
    // Purple line between rows when today has no event
    let todayLine = '';
    if (isEventsList && !hasTodayEvent) {
      const prev = idx > 0 ? filtered[idx - 1] : null;
      if (prev && prev.date < todayStr && row.date > todayStr) {
        const colSpan = cfg.cols.length + 2;
        todayLine = `<tr class="today-line"><td colspan="${colSpan}" style="padding:0;height:2px;background:${ac()};position:relative"><span style="position:absolute;left:8px;top:-8px;font-size:10px;color:${ac()};font-weight:600;pointer-events:none">idag</span></td></tr>`;
      }
    }
    const isPast = isEventsList && row.date < todayStr;
    const pastStyle = isPast ? 'opacity:0.5;' : '';
    return todayLine + `<tr onclick="selectRow(${row.id})" class="${selectedId===row.id?'selected':''}${weekCls}${todayCls}" style="${pastStyle}">
      ${arrowTd}${cfg.cols.map(c=>`<td>${c.render(row[c.key],row)}</td>`).join('')}
      <td class="td-actions" onclick="event.stopPropagation()"><button class="actions-btn" onclick="showCtxMenu(event,${row.id},'${currentTab}')"><i data-lucide="ellipsis" style="width:16px;height:16px"></i></button></td>
    </tr>`;
  }).join('') || `<tr><td colspan="${cfg.cols.length + (isEventsList?2:1)}" style="padding:24px;text-align:center;color:#9ca3af">Inga resultat</td></tr>`;
  lucide.createIcons({nameAttr:'data-lucide', attrs:{class:'lucide-icon'}});
  // Scroll to current week on first render & add "scroll to today" button
  const tableWrap = document.getElementById('table-area');
  if (currentTab === 'events' && currentView === 'list') {
    if (!listScrolled) {
      listScrolled = true;
      requestAnimationFrame(() => {
        const row = document.querySelector('#table-body tr.today-row, #table-body tr.today-line, #table-body tr.current-week');
        if (row) row.scrollIntoView({ block: 'start', behavior: 'instant' });
      });
    }
    // Show/hide floating "scroll to today" button based on visibility
    let stBtn = document.getElementById('scroll-today-wrap');
    if (!stBtn) {
      stBtn = document.createElement('div');
      stBtn.id = 'scroll-today-wrap';
      stBtn.className = 'scroll-today';
      stBtn.style.display = 'none';
      stBtn.innerHTML = '<button onclick="scrollToToday()">↕ Idag</button>';
      tableWrap.appendChild(stBtn);
    }
    updateScrollTodayVisibility();
  } else {
    const stBtn = document.getElementById('scroll-today-wrap');
    if (stBtn) stBtn.remove();
  }
}
