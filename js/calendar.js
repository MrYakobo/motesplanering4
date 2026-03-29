// ── CALENDAR VIEW ─────────────────────────────────────────────────────────────
let calMonth = getToday().getMonth();
let calYear = getToday().getFullYear();
let calWeekOffset = 0;
let dragEventId = null;
let calScrollInit = false;
let listScrolled = false;

// Range: render from 1 year before to 1 year after today
function getCalRange() {
  const today = getToday();
  return { startYear: today.getFullYear() - 1, endYear: today.getFullYear() + 1 };
}

function getCalContainer() {
  const wrap = document.querySelector('.table-wrap');
  let c = document.getElementById('cal-container');
  if (!c) { c = document.createElement('div'); c.id = 'cal-container'; wrap.appendChild(c); }
  c.style.display = '';
  c.style.height = '100%';
  wrap.querySelector('table').style.display = 'none';
  return c;
}

function evBadge(ev, extraCls) {
  return `<div class="${extraCls || 'cal-ev'}" style="${catCalClass(ev.category)}" draggable="true" data-ev-id="${ev.id}"
    onclick="event.stopPropagation();openDetailModal(${ev.id})"
    data-tip="${esc(ev.time || '')} ${esc(ev.title)}">${ev.time || ''} ${esc(ev.title)}</div>`;
}

function groupByDate(events) {
  const m = {};
  events.forEach(ev => { if (!m[ev.date]) m[ev.date] = []; m[ev.date].push(ev); });
  return m;
}

function moveEventToDate(evId, newDate) {
  const ev = db.events.find(e => e.id === evId);
  if (!ev || ev.date === newDate) return;
  ev.date = newDate;
  persist('events');
  const scrollEl = document.getElementById('cal-scroll-area') || document.getElementById('week-scroll-area');
  const scrollTop = scrollEl ? scrollEl.scrollTop : 0;
  applyFilters();
  const el = document.getElementById('cal-scroll-area') || document.getElementById('week-scroll-area');
  if (el) el.scrollTop = scrollTop;
}

function initDragDrop(container) {
  container.addEventListener('dragstart', e => {
    const el = e.target.closest('[data-ev-id]');
    if (!el) return;
    dragEventId = parseInt(el.dataset.evId);
    el.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragEventId);
  });
  container.addEventListener('dragend', e => {
    const el = e.target.closest('[data-ev-id]');
    if (el) el.classList.remove('dragging');
    dragEventId = null;
    container.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
  });
  container.addEventListener('dragover', e => {
    const cell = e.target.closest('[data-drop-date]');
    if (!cell) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    container.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
    cell.classList.add('drag-over');
  });
  container.addEventListener('dragleave', e => {
    const cell = e.target.closest('[data-drop-date]');
    if (cell && !cell.contains(e.relatedTarget)) cell.classList.remove('drag-over');
  });
  container.addEventListener('drop', e => {
    e.preventDefault();
    const cell = e.target.closest('[data-drop-date]');
    if (!cell || !dragEventId) return;
    cell.classList.remove('drag-over');
    moveEventToDate(dragEventId, cell.dataset.dropDate);
    dragEventId = null;
  });
}

function renderCalendar() {
  const { startYear, endYear } = getCalRange();
  const monthNames = ['januari','februari','mars','april','maj','juni','juli','augusti','september','oktober','november','december'];
  const shortMonths = ['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec'];
  const dayHeaders = ['mån','tis','ons','tor','fre','lör','sön'];

  const byDate = groupByDate(filtered);
  const todayStr = getTodayStr();
  const MAX_VIS = 3;

  document.getElementById('table-head').innerHTML = '';
  document.getElementById('table-body').innerHTML = '';

  const headerRow = `<div class="cal-header" style="font-size:10px">v.</div>` + dayHeaders.map(d => `<div class="cal-header">${d}</div>`).join('');

  let html = `<div class="cal-scroll" id="cal-scroll-area">`;

  for (let yr = startYear; yr <= endYear; yr++) {
    for (let m = 0; m < 12; m++) {
      const first = new Date(yr, m, 1);
      const last = new Date(yr, m + 1, 0);
      const startDay = (first.getDay() + 6) % 7;
      const startDate = new Date(first);
      startDate.setDate(1 - startDay);
      const weeks = [];
      const wd = new Date(startDate);
      while (true) {
        weeks.push(new Date(wd));
        wd.setDate(wd.getDate() + 7);
        if (wd > last && wd.getDay() === 1) break;
        if (weeks.length >= 6) break;
      }

      html += `<div class="cal-month-section">`;
      html += `<div class="cal-month-label">${monthNames[m]} <span>${yr}</span></div>`;
      html += `<div class="cal-grid">${headerRow}`;

      weeks.forEach(weekMon => {
        const wn = getWeekNumber(weekMon);
        html += `<div class="cal-wk">${wn}</div>`;
        for (let i = 0; i < 7; i++) {
          const day = new Date(weekMon);
          day.setDate(weekMon.getDate() + i);
          const ds = localDate(day);
          const outside = day.getMonth() !== m;
          const isToday = ds === todayStr;
          let cls = 'cal-cell';
          if (outside) cls += ' outside';
          if (isToday) cls += ' today';

          const evs = byDate[ds] || [];
          const visible = evs.slice(0, MAX_VIS);
          const extra = evs.length - MAX_VIS;

          const dayLabel = day.getDate() === 1 && !outside ? `1 ${shortMonths[day.getMonth()]}` : `${day.getDate()}`;
          let inner = `<div class="cal-day-num">${dayLabel}</div>`;
          visible.forEach(ev => { inner += evBadge(ev); });
          if (extra > 0) inner += `<div class="cal-more" onclick="event.stopPropagation();calShowAll('${ds}')">+${extra} till</div>`;
          html += `<div class="${cls}" data-drop-date="${ds}" onclick="if(!event.target.closest('[data-ev-id],.cal-more'))newEventOnDate('${ds}')">${inner}</div>`;
        }
      });

      html += '</div></div>';
    }
  }

  html += '</div>';
  const oldScroll = document.getElementById('cal-scroll-area');
  const savedScrollTop = oldScroll ? oldScroll.scrollTop : null;

  const c = getCalContainer();
  c.innerHTML = html;
  initDragDrop(c);

  if (!calScrollInit) {
    calScrollInit = true;
    requestAnimationFrame(() => {
      const scrollArea = document.getElementById('cal-scroll-area');
      if (!scrollArea) return;
      const todayCell = scrollArea.querySelector('.cal-cell.today');
      if (todayCell) {
        const monthSection = todayCell.closest('.cal-month-section');
        if (monthSection) {
          monthSection.scrollIntoView({ block: 'start', behavior: 'instant' });
        }
      }
    });
  } else if (savedScrollTop !== null) {
    const scrollArea = document.getElementById('cal-scroll-area');
    if (scrollArea) scrollArea.scrollTop = savedScrollTop;
  }
}

function renderWeekView() {
  const { startYear, endYear } = getCalRange();
  const dayLabels = ['mån','tis','ons','tor','fre','lör','sön'];
  const monthNames = ['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec'];
  const todayStr = getTodayStr();
  const byDate = groupByDate(filtered);

  const janFirst = new Date(startYear, 0, 1);
  const startMon = new Date(janFirst);
  startMon.setDate(janFirst.getDate() - ((janFirst.getDay() + 6) % 7));
  const decLast = new Date(endYear, 11, 31);
  const endSun = new Date(decLast);
  endSun.setDate(decLast.getDate() + (7 - ((decLast.getDay() + 6) % 7)) % 7);

  document.getElementById('table-head').innerHTML = '';
  document.getElementById('table-body').innerHTML = '';

  let html = `<div class="week-scroll" id="week-scroll-area"><div class="week-container">`;

  const d = new Date(startMon);
  while (d <= endSun) {
    const wn = getWeekNumber(d);
    const sunD = new Date(d); sunD.setDate(d.getDate() + 6);
    const monMonth = monthNames[d.getMonth()];
    const sunMonth = monthNames[sunD.getMonth()];
    const range = monMonth === sunMonth
      ? `${d.getDate()}–${sunD.getDate()} ${monMonth} ${d.getFullYear()}`
      : `${d.getDate()} ${monMonth} – ${sunD.getDate()} ${sunMonth} ${sunD.getFullYear()}`;

    html += `<div class="week-section" data-week-date="${localDate(d)}"><div class="week-section-header">Vecka ${wn} <span>${range}</span></div>`;
    html += `<div class="week-grid">`;

    for (let i = 0; i < 7; i++) {
      const day = new Date(d);
      day.setDate(d.getDate() + i);
      const ds = localDate(day);
      const isToday = ds === todayStr;
      const isHighlight = ds === highlightDate;
      let cls = 'week-col';
      if (isToday) cls += ' today';
      if (isHighlight && !isToday) cls += ' highlight';

      const evs = byDate[ds] || [];
      let inner = `<div class="week-col-header${isToday?' today-hdr':''}">
        ${dayLabels[i]}<span class="week-date">${day.getDate()}</span>
      </div>`;
      evs.forEach(ev => {
        inner += `<div class="week-ev" style="${catCalClass(ev.category)}" draggable="true" data-ev-id="${ev.id}"
          onclick="event.stopPropagation();openDetailModal(${ev.id})">
          <div class="week-ev-time">${ev.time || ''}</div>
          <div class="week-ev-title">${ev.title}</div>
        </div>`;
      });
      html += `<div class="${cls}" data-drop-date="${ds}" onclick="if(!event.target.closest('[data-ev-id]'))newEventOnDate('${ds}')">${inner}</div>`;
    }

    html += `</div></div>`;
    d.setDate(d.getDate() + 7);
  }

  html += '</div></div>';
  const oldWeekScroll = document.getElementById('week-scroll-area');
  const savedWeekTop = oldWeekScroll ? oldWeekScroll.scrollTop : null;

  const c = getCalContainer();
  c.innerHTML = html;
  initDragDrop(c);

  const weekBtn = document.createElement('div');
  weekBtn.id = 'week-today-btn';
  weekBtn.className = 'scroll-today';
  weekBtn.innerHTML = '<button onclick="weekScrollToToday()">↕ Idag</button>';
  c.appendChild(weekBtn);

  const scrollArea2 = document.getElementById('week-scroll-area');
  if (scrollArea2) {
    scrollArea2.addEventListener('scroll', updateWeekTodayVisibility);
    requestAnimationFrame(updateWeekTodayVisibility);
  }

  if (!calScrollInit) {
    calScrollInit = true;
    requestAnimationFrame(() => {
      const scrollArea = document.getElementById('week-scroll-area');
      if (!scrollArea) return;
      const todayCol = scrollArea.querySelector('.week-col.today');
      if (todayCol) todayCol.scrollIntoView({ block: 'center', behavior: 'instant' });
    });
  } else if (savedWeekTop !== null) {
    const scrollArea = document.getElementById('week-scroll-area');
    if (scrollArea) scrollArea.scrollTop = savedWeekTop;
  }
}

function renderYearView() {
  const { startYear, endYear } = getCalRange();
  const monthNames = ['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec'];
  const dayHeaders = ['m','t','o','t','f','l','s'];
  const todayStr = getTodayStr();
  const curWeek = getCurrentWeekRange();

  const eventDates = new Set(filtered.map(e => e.date));

  document.getElementById('table-head').innerHTML = '';
  document.getElementById('table-body').innerHTML = '';

  let html = `<div style="overflow-y:auto;height:100%;padding:8px">`;
  for (let yr = startYear; yr <= endYear; yr++) {
    html += `<div style="margin-bottom:24px"><div style="font-size:20px;font-weight:800;color:#1a1a2e;padding:8px 16px">${yr}</div>`;
    html += `<div class="year-grid">`;
    for (let m = 0; m < 12; m++) {
      const first = new Date(yr, m, 1);
      const last = new Date(yr, m + 1, 0);
      const startDay = (first.getDay() + 6) % 7;
      const startDate = new Date(first);
      startDate.setDate(1 - startDay);
      const weeks = [];
      const wd = new Date(startDate);
      while (true) {
        weeks.push(new Date(wd));
        wd.setDate(wd.getDate() + 7);
        if (wd > last && wd.getDay() === 1) break;
        if (weeks.length >= 6) break;
      }

      html += `<div class="year-month"><div class="year-month-title">${monthNames[m]}</div><div class="year-mini-grid" style="grid-template-columns:24px repeat(7,1fr)">`;
      html += `<div class="year-mini-hdr" style="color:'+acMid()+'">v</div>`;
      html += dayHeaders.map(d => `<div class="year-mini-hdr">${d}</div>`).join('');

      weeks.forEach(weekMon => {
        const wn = getWeekNumber(weekMon);
        const weekSun = new Date(weekMon);
        weekSun.setDate(weekMon.getDate() + 6);
        const weekMonStr = localDate(weekMon);
        const weekSunStr = localDate(weekSun);
        const isCurWeek = weekMonStr <= curWeek.to && weekSunStr >= curWeek.from;

        const weekStyle = isCurWeek ? 'color:'+ac()+';font-weight:700' : '';
        html += `<div class="year-mini-hdr" style="font-size:9px;${weekStyle}">${wn}</div>`;

        for (let i = 0; i < 7; i++) {
          const day = new Date(weekMon);
          day.setDate(weekMon.getDate() + i);
          const ds = localDate(day);
          const outside = day.getMonth() !== m;
          const isToday = ds === todayStr;
          const hasEv = eventDates.has(ds);
          let cls = 'year-mini-day';
          if (outside) cls += ' outside';
          if (isToday) cls += ' today';
          if (hasEv && !outside) cls += ' has-events';
          const borderStyle = isToday ? 'outline:1.5px solid '+ac()+';outline-offset:-1px;border-radius:3px;' : '';
          html += `<div class="${cls}" style="${borderStyle}cursor:pointer" onclick="goToWeek('${ds}')">${day.getDate()}</div>`;
        }
      });

      html += '</div></div>';
    }
    html += '</div></div>';
  }
  html += '</div>';
  const c = getCalContainer();
  c.innerHTML = html;

  // Scroll to current year section
  requestAnimationFrame(() => {
    const todayEl = c.querySelector('.year-mini-day.today');
    if (todayEl) todayEl.scrollIntoView({ block: 'center', behavior: 'instant' });
  });
}

function calPrev() { calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderTable(); }
function calNext() { calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderTable(); }
function calToday() { const n = getToday(); calMonth = n.getMonth(); calYear = n.getFullYear(); renderTable(); }
function calShowAll(dateStr) {
  document.getElementById('search-input').value = dateStr;
  setView('list');
  applyFilters();
}
let highlightDate = null;

function goToWeek(dateStr) {
  highlightDate = dateStr;
  const d = new Date(dateStr + 'T00:00:00');
  const mon = new Date(d);
  mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const monStr = localDate(mon);
  calScrollInit = true;
  setView('week');
  requestAnimationFrame(() => {
    const scrollArea = document.getElementById('week-scroll-area');
    if (!scrollArea) return;
    const section = scrollArea.querySelector(`[data-week-date="${monStr}"]`);
    if (section) section.scrollIntoView({ block: 'start', behavior: 'instant' });
  });
}

function weekScrollToToday() {
  const scrollArea = document.getElementById('week-scroll-area');
  if (!scrollArea) return;
  const todayCol = scrollArea.querySelector('.week-col.today');
  if (todayCol) todayCol.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function updateWeekTodayVisibility() {
  const btn = document.getElementById('week-today-btn');
  if (!btn) return;
  const scrollArea = document.getElementById('week-scroll-area');
  const todayCol = scrollArea?.querySelector('.week-col.today');
  if (!todayCol) { btn.style.display = 'none'; return; }
  const areaRect = scrollArea.getBoundingClientRect();
  const todayRect = todayCol.getBoundingClientRect();
  const visible = todayRect.bottom > areaRect.top && todayRect.top < areaRect.bottom;
  btn.style.display = visible ? 'none' : '';
  if (!visible) {
    const above = todayRect.bottom <= areaRect.top;
    btn.querySelector('button').textContent = (above ? '↑' : '↓') + ' Idag';
  }
}

// ── CATEGORY SUBSCRIBE ────────────────────────────────────────────────────────
function slugifyCategory(name) {
  return (name || '').toLowerCase().replace(/[åä]/g,'a').replace(/ö/g,'o').replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function openSubscribeModal() {
  const cats = (db.categories || []).filter(c => !c.hidden);
  const modal = document.getElementById('subscribe-modal');
  const content = document.getElementById('subscribe-modal-content');
  if (!cats.length) {
    content.innerHTML = '<p style="color:#9ca3af;font-size:13px">Inga kategorier finns.</p>';
    modal.classList.add('open');
    return;
  }
  content.innerHTML = '<p style="font-size:13px;color:#6b7280;margin-bottom:12px">Välj en kategori att prenumerera på i din kalenderapp.</p>' +
    cats.map(c => {
      const slug = slugifyCategory(c.name);
      const url = location.origin + '/api/cal/cat/' + slug + '.ics';
      const webcal = url.replace(/^https?:/, 'webcal:');
      return `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px 14px;margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span class="badge" style="${catBadgeStyle(c.name)};font-size:12px">${esc(c.name)}</span>
          <span style="flex:1"></span>
          <a href="${escAttr(webcal)}" class="btn" style="text-decoration:none;font-size:11px;padding:4px 10px;display:inline-flex;align-items:center;gap:4px"><i data-lucide="calendar-plus" style="width:12px;height:12px"></i> Öppna</a>
          <button class="btn-ghost" onclick="navigator.clipboard.writeText('${escAttr(url)}');showToast('Länk kopierad!','ok')" style="padding:4px 8px" data-tip="Kopiera länk"><i data-lucide="copy" style="width:12px;height:12px"></i></button>
        </div>
        <input type="text" value="${escAttr(url)}" readonly onclick="this.select()" style="width:100%;font-size:11px;background:#f9fafb;color:#6b7280;border:1px solid #e5e7eb;border-radius:4px;padding:4px 8px;box-sizing:border-box">
      </div>`;
    }).join('');
  modal.classList.add('open');
  lucide.createIcons({nameAttr:'data-lucide', attrs:{class:'lucide-icon'}});
}

function closeSubscribeModal() {
  document.getElementById('subscribe-modal').classList.remove('open');
}
