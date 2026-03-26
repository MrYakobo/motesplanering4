// ── CALENDAR VIEW ─────────────────────────────────────────────────────────────
let calMonth = getToday().getMonth();
let calYear = getToday().getFullYear();
let calWeekOffset = 0;
let dragEventId = null;
let calScrollInit = false;
let listScrolled = false;

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
  const cat = (ev.category || 'weekday').toLowerCase();
  return `<div class="${extraCls || 'cal-ev'} cal-ev-${cat}" draggable="true" data-ev-id="${ev.id}"
    onclick="event.stopPropagation();openDetailModal(${ev.id})"
    title="${esc(ev.time || '')} ${esc(ev.title)}">${ev.time || ''} ${esc(ev.title)}</div>`;
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
  // preserve scroll position across re-render
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
  const yr = selectedYear;
  const monthNames = ['januari','februari','mars','april','maj','juni','juli','augusti','september','oktober','november','december'];
  const shortMonths = ['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec'];
  const dayHeaders = ['mån','tis','ons','tor','fre','lör','sön'];

  const byDate = groupByDate(filtered);
  const todayStr = getTodayStr();
  const curWeek = getCurrentWeekRange();
  const MAX_VIS = 3;

  document.getElementById('table-head').innerHTML = '';
  document.getElementById('table-body').innerHTML = '';

  const headerRow = `<div class="cal-header" style="font-size:10px">v.</div>` + dayHeaders.map(d => `<div class="cal-header">${d}</div>`).join('');

  let html = `<div class="cal-scroll" id="cal-scroll-area">`;

  for (let m = 0; m < 12; m++) {
    const first = new Date(yr, m, 1);
    const last = new Date(yr, m + 1, 0);
    const startDay = (first.getDay() + 6) % 7;

    // Build weeks for this month
    const startDate = new Date(first);
    startDate.setDate(1 - startDay);
    // figure out how many weeks we need (until we pass the last day)
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
        const inCurWeek = ds >= curWeek.from && ds <= curWeek.to;
        let cls = 'cal-cell';
        if (outside) cls += ' outside';
        if (isToday) cls += ' today';
        if (inCurWeek && !outside) cls += ' current-week-cell';

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

  html += '</div>';
  // Save scroll position before re-render
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
        todayCell.scrollIntoView({ block: 'center', behavior: 'instant' });
      }
    });
  } else if (savedScrollTop !== null) {
    const scrollArea = document.getElementById('cal-scroll-area');
    if (scrollArea) scrollArea.scrollTop = savedScrollTop;
  }
}

function renderWeekView() {
  const yr = selectedYear;
  const dayLabels = ['mån','tis','ons','tor','fre','lör','sön'];
  const monthNames = ['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec'];
  const todayStr = getTodayStr();
  const byDate = groupByDate(filtered);

  // Build all weeks for the year
  const janFirst = new Date(yr, 0, 1);
  const startMon = new Date(janFirst);
  startMon.setDate(janFirst.getDate() - ((janFirst.getDay() + 6) % 7));
  const decLast = new Date(yr, 11, 31);
  const endSun = new Date(decLast);
  endSun.setDate(decLast.getDate() + (7 - ((decLast.getDay() + 6) % 7)) % 7);

  document.getElementById('table-head').innerHTML = '';
  document.getElementById('table-body').innerHTML = '';

  let html = `<div class="week-scroll" id="week-scroll-area"><div class="week-container">`;

  const d = new Date(startMon);
  while (d <= endSun) {
    const wn = getWeekNumber(d);
    const monDate = localDate(d);
    const sunD = new Date(d); sunD.setDate(d.getDate() + 6);
    const sunDate = localDate(sunD);
    const monMonth = monthNames[d.getMonth()];
    const sunMonth = monthNames[sunD.getMonth()];
    const range = monMonth === sunMonth
      ? `${d.getDate()}–${sunD.getDate()} ${monMonth}`
      : `${d.getDate()} ${monMonth} – ${sunD.getDate()} ${sunMonth}`;

    html += `<div class="week-section" data-week-date="${localDate(d)}"><div class="week-section-header">Vecka ${wn} <span>${range}</span></div>`;
    html += `<div class="week-grid">`;

    for (let i = 0; i < 7; i++) {
      const day = new Date(d);
      day.setDate(d.getDate() + i);
      const ds = localDate(day);
      const isToday = ds === todayStr;
      let cls = 'week-col';
      if (isToday) cls += ' today';

      const evs = byDate[ds] || [];
      let inner = `<div class="week-col-header${isToday?' today-hdr':''}">
        ${dayLabels[i]}<span class="week-date">${day.getDate()}</span>
      </div>`;
      evs.forEach(ev => {
        const cat = (ev.category || 'weekday').toLowerCase();
        inner += `<div class="week-ev cal-ev-${cat}" draggable="true" data-ev-id="${ev.id}"
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
  const monthNames = ['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec'];
  const dayHeaders = ['m','t','o','t','f','l','s'];
  const todayStr = getTodayStr();
  const yr = selectedYear;

  // collect all event dates for this year
  const eventDates = new Set(filtered.map(e => e.date));

  document.getElementById('table-head').innerHTML = '';
  document.getElementById('table-body').innerHTML = '';

  let html = `<div class="year-grid">`;
  for (let m = 0; m < 12; m++) {
    const first = new Date(yr, m, 1);
    const startDay = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(yr, m + 1, 0).getDate();

    html += `<div class="year-month"><div class="year-month-title">${monthNames[m]} ${yr}</div><div class="year-mini-grid">`;
    html += dayHeaders.map(d => `<div class="year-mini-hdr">${d}</div>`).join('');

    // leading blanks
    for (let i = 0; i < startDay; i++) html += `<div class="year-mini-day outside"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${yr}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isToday = ds === todayStr;
      const hasEv = eventDates.has(ds);
      let cls = 'year-mini-day';
      if (isToday) cls += ' today';
      if (hasEv) cls += ' has-events';
      html += `<div class="${cls}" onclick="goToWeek('${ds}')" style="cursor:pointer">${d}</div>`;
    }
    // trailing blanks
    const total = startDay + daysInMonth;
    const trailing = (7 - total % 7) % 7;
    for (let i = 0; i < trailing; i++) html += `<div class="year-mini-day outside"></div>`;

    html += '</div></div>';
  }
  html += '</div>';
  const c = getCalContainer();
  c.innerHTML = html;
}

function calPrev() { calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderTable(); }
function calNext() { calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderTable(); }
function calToday() { const n = getToday(); calMonth = n.getMonth(); calYear = n.getFullYear(); renderTable(); }
function calShowAll(dateStr) {
  document.getElementById('search-input').value = dateStr;
  setView('list');
  applyFilters();
}
function goToWeek(dateStr) {
  // Find the Monday of the week containing dateStr
  const d = new Date(dateStr + 'T00:00:00');
  const mon = new Date(d);
  mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const monStr = localDate(mon);
  calScrollInit = true; // prevent auto-scroll to today
  setView('week');
  requestAnimationFrame(() => {
    const scrollArea = document.getElementById('week-scroll-area');
    if (!scrollArea) return;
    const section = scrollArea.querySelector(`[data-week-date="${monStr}"]`);
    if (section) section.scrollIntoView({ block: 'start', behavior: 'instant' });
  });
}
