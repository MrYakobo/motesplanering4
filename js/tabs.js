// ── CORE RENDER ───────────────────────────────────────────────────────────────
function switchTab(tab, skipHash) {
  if (slideTimer) { clearTimeout(slideTimer); slideTimer = null; }
  if (slideClockTimer) { clearInterval(slideClockTimer); slideClockTimer = null; }
  currentTab = tab; selectedId = null; sortCol = null; sortDir = 1;
  document.querySelectorAll('nav button[id^=tab-]').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
  document.getElementById('section-title').textContent = tabConfig[tab].label;
  document.getElementById('search-input').value = '';

  const isSlides = tab === 'slides';
  const isExport = tab === 'export';
  const isTeams = tab === 'teams';
  const isMailbot = tab === 'mailbot';
  const isNamn = tab === 'namnskyltar';
  const isCats = tab === 'categories';
  const isSpecial = isSlides || isExport || isTeams || isMailbot || isCats || isNamn;
  const isEvents = tab === 'events';
  document.getElementById('table-area').style.display = isSpecial ? 'none' : '';
  document.getElementById('slides-area').style.display = isSlides ? '' : 'none';
  document.getElementById('export-area').style.display = isExport ? '' : 'none';
  document.getElementById('team-board-area').style.display = isTeams ? '' : 'none';
  document.getElementById('categories-area').style.display = isCats ? '' : 'none';
  document.getElementById('mailbot-area').style.display = isMailbot ? '' : 'none';
  document.getElementById('namnskyltar-area').style.display = isNamn ? '' : 'none';
  document.getElementById('search-input').style.display = isSpecial ? 'none' : '';
  document.getElementById('btn-generate').style.display = isEvents ? '' : 'none';
  document.getElementById('view-toggle').style.display = isEvents ? '' : 'none';
  document.getElementById('stats-bar').style.display = isSpecial ? 'none' : '';
  if (!isEvents) currentView = 'list';
  document.getElementById('sidebar').style.display = (isTeams || isMailbot || isCats || isNamn) ? 'none' : '';

  if (isSlides) { renderSlides(); renderSlidesSidebar(); if (!skipHash) updateHash(); return; }
  if (isExport) { renderExport(); renderSidebar(null); if (!skipHash) updateHash(); return; }
  if (isTeams) { renderTeamBoard(); if (!skipHash) updateHash(); return; }
  if (isCats) { renderCategories(); if (!skipHash) updateHash(); return; }
  if (isMailbot) { renderMailbot(); if (!skipHash) updateHash(); return; }
  if (isNamn) { renderNamnskyltar(); if (!skipHash) updateHash(); return; }
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
  ['list','calendar','week','year','monster'].forEach(k => {
    const el = document.getElementById('vt-'+k);
    if (el) el.classList.toggle('active', v===k);
  });
  document.querySelector('.table-wrap').classList.toggle('monster', v==='monster');
  const calViews = ['monster','calendar','week','year'];
  document.getElementById('sidebar').style.display = calViews.includes(v) ? 'none' : '';
  if (v !== 'list') { selectedId = null; renderSidebar(null); }
  renderTable();
  updateHash();
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
  if (currentTab !== 'events') { ySel.style.display = 'none'; return; }
  const years = [...new Set((db.events||[]).map(e => e.date.slice(0,4)))].sort();
  if (years.length === 0) { ySel.style.display = 'none'; return; }
  // if current selectedYear has no events, snap to nearest available year
  if (!years.includes(String(selectedYear))) {
    selectedYear = parseInt(years[years.length - 1]);
  }
  ySel.style.display = '';
  ySel.innerHTML = years.map(y => `<option value="${y}" ${String(selectedYear)===y?'selected':''}>${y}</option>`).join('');
}

function setYear(y) {
  selectedYear = parseInt(y);
  applyFilters();
}

function applyFilters() {
  if (currentTab === 'slides') return;
  const q = document.getElementById('search-input').value.toLowerCase();
  const sel = document.getElementById('filter-select');
  const fv = sel.style.display!=='none' ? sel.value : 'All';
  const cfg = tabConfig[currentTab];
  let data = [...(db[currentTab]||[])];
  // year filter for events
  if (currentTab === 'events') {
    data = data.filter(r => r.date.startsWith(String(selectedYear)));
  }
  if (fv!=='All') data = data.filter(r=>String(r[cfg.filter.key]).toLowerCase()===fv.toLowerCase());
  if (q) data = data.filter(r=>{
    if (currentTab === 'events') {
      return r.title.toLowerCase().includes(q) || r.date.includes(q) || (r.time||'').includes(q);
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

function renderTable() {
  // hide/show calendar container and add bar
  const calC = document.getElementById('cal-container');
  const tbl = document.querySelector('.table-wrap table');
  const calViews = ['calendar','week','year'];
  if (currentTab === 'events' && calViews.includes(currentView)) {
    if (tbl) tbl.style.display = 'none';
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
  document.getElementById('table-head').innerHTML = '<tr>'+cfg.cols.map(c=>
    sortable
      ? `<th onclick="sortBy('${c.key}')" class="${sortCol===c.key?'sorted':''}">${c.label}<span class="si">${sortCol===c.key?(sortDir===1?'↑':'↓'):'↕'}</span></th>`
      : `<th style="cursor:default">${c.label}</th>`
  ).join('')+'<th style="width:40px"></th></tr>';
  document.getElementById('table-body').innerHTML = filtered.map(row => {
    const weekCls = currentTab === 'events' && isCurrentWeek(row.date) ? ' current-week' : '';
    return `<tr onclick="selectRow(${row.id})" class="${selectedId===row.id?'selected':''}${weekCls}">
      ${cfg.cols.map(c=>`<td>${c.render(row[c.key],row)}</td>`).join('')}
      <td class="td-actions" onclick="event.stopPropagation()"><button class="actions-btn" onclick="showCtxMenu(event,${row.id},'${currentTab}')"><i data-lucide="ellipsis" style="width:16px;height:16px"></i></button></td>
    </tr>`;
  }).join('') || `<tr><td colspan="${cfg.cols.length+1}" style="padding:24px;text-align:center;color:#9ca3af">No results</td></tr>`;
  lucide.createIcons({nameAttr:'data-lucide', attrs:{class:'lucide-icon'}});
  // Scroll to current week row in list view
  if (currentTab === 'events' && !listScrolled) {
    listScrolled = true;
    requestAnimationFrame(() => {
      const row = document.querySelector('#table-body tr.current-week');
      if (row) row.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
  }
}
