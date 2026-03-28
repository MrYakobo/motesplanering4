// ── SLIDES ────────────────────────────────────────────────────────────────────
let slideWeekOffset = 0;

function getSlideWeekOffset() {
  const today = getToday();
  // If today is Sunday (day 0), show next week
  return slideWeekOffset + (today.getDay() === 0 ? 1 : 0);
}

function slideBreakTitle(title) {
  // Insert soft hyphen before common Swedish compound suffixes
  return (title || '').replace(/(gudstjänst|samling|möte|kväll|morgon|stund|fest|konsert)/gi, '\u00AD$1');
}

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

function getMondayOfWeek(refDate, offset) {
  const d = new Date(refDate);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1 + offset * 7);
  d.setHours(0,0,0,0);
  return d;
}

let slideTimer = null;
let slideIndex = 0;
let slidePaused = false;

function renderSlides() {
  const area = document.getElementById('slides-area');
  const today = getToday();
  const monday = getMondayOfWeek(today, getSlideWeekOffset());
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  const weekNum = getWeekNumber(monday);
  const monStr = localDate(monday);
  const sunStr = localDate(sunday);

  const weekEvents = getPublicEvents()
    .filter(e => e.date >= monStr && e.date <= sunStr)
    .sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time));

  const dayNames = ['söndag','måndag','tisdag','onsdag','torsdag','fredag','lördag'];
  const byDay = {};
  weekEvents.forEach(e => { if (!byDay[e.date]) byDay[e.date] = []; byDay[e.date].push(e); });

  // Build column-based week slide
  const sortedDates = Object.keys(byDay).sort();
  let colsHtml = '';
  if (sortedDates.length === 0) {
    colsHtml = '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:#475569;font-size:clamp(14px,1.5vw,24px)">Inga händelser denna vecka</div>';
  } else {
    colsHtml = sortedDates.map((dateStr, colIdx) => {
      const d = new Date(dateStr + 'T00:00:00');
      const dayName = dayNames[d.getDay()];
      const evHtml = byDay[dateStr].map((ev, evIdx) => {
        const delay = (colIdx * 0.15 + evIdx * 0.08).toFixed(2);
        const desc = ev.description ? ` · ${ev.description}` : '';
        return `<div class="slide-ev" style="animation-delay:${delay}s">
          <div class="slide-ev-title">${slideBreakTitle(ev.title)}</div>
          <div class="slide-ev-meta">${ev.category || ''} · ${ev.time || ''}</div>
        </div>`;
      }).join('');
      return `<div class="slide-col" style="animation-delay:${(colIdx*0.12).toFixed(2)}s">
        <div class="slide-col-day">${dayName.charAt(0).toUpperCase()+dayName.slice(1)}</div>
        <div class="slide-col-events">${evHtml}</div>
      </div>`;
    }).join('');
  }

  const logoUrl = db.slideLogo || '';
  const logoHtml = logoUrl ? `<div class="slide-logo"><img src="${logoUrl}" alt="Logo"></div>` : '';
  const weekSlide = `<div class="slide-week">
    <div class="slide-week-header"><h2>Händer i veckan (v${weekNum})</h2></div>
    <div class="slide-columns">${colsHtml}</div>
    <div class="slide-footer">
      <div class="slide-clock" id="slide-clock"></div>
      ${logoHtml}
    </div>
  </div>`;

  // Build slides array: week overview first, then event promos, then active global promos
  const eventPromos = weekEvents.flatMap(e => (e.promoSlides || []).filter(Boolean));
  const globalPromos = (db.globalSlides || []).filter(s => s.active).map(s => s.url);
  const promos = [...eventPromos, ...globalPromos];
  const slides = [];
  slides.push(weekSlide);
  promos.forEach(url => {
    slides.push(`<div class="slide-promo"><img src="${url}" alt="Promo"></div>`);
  });

  let html = `<div class="slide-progress" id="slide-progress"></div>`;
  html += slides.map((s, i) => `<div class="slide${i===0?' active':''}">${s}</div>`).join('');
  html += `<div class="slide-controls">`;
  html += slides.map((_, i) => `<button class="slide-dot${i===0?' active':''}" onclick="goToSlide(${i})"></button>`).join('');
  if (slides.length > 1) html += `<button class="slide-pause" onclick="toggleSlidePause()" id="slide-pause-btn">⏸</button>`;
  html += `<button class="slide-pause" onclick="toggleSlideFullscreen()" data-tip="Fullskärm"><i data-lucide="maximize" style="width:14px;height:14px"></i></button>`;
  html += `</div>`;
  area.innerHTML = html;

  // Apply configurable background
  const bg = db.slideBackground || {};
  if (bg.image) {
    area.style.background = `url('${bg.image}') center/cover no-repeat`;
  } else {
    area.style.background = bg.color || '#111';
  }

  slideIndex = 0;
  slidePaused = false;
  if (slideTimer) clearTimeout(slideTimer);
  startSlideClock();
  // 10s for ≤3 cols, +2.5s per extra col, max 20s
  const weekDuration = Math.min(20, Math.max(10, 10 + (sortedDates.length - 3) * 2.5)) * 1000;
  const promoDuration = 10000;
  slideDurations = [weekDuration, ...promos.map(() => promoDuration)];
  startSlideProgress();
}

let slideDurations = [];

function startSlideProgress() {
  if (slideTimer) clearTimeout(slideTimer);
  const bar = document.getElementById('slide-progress');
  if (!bar) return;
  if (slidePaused) { bar.style.display = 'none'; return; }
  bar.style.display = '';
  const dur = slideDurations[slideIndex] || 10000;
  bar.classList.remove('animating');
  bar.style.width = '0%';
  void bar.offsetWidth;
  bar.classList.add('animating');
  bar.style.transitionDuration = dur + 'ms';
  bar.style.width = '100%';

  if (slideDurations.length <= 1) return;
  slideTimer = setTimeout(() => {
    if (!slidePaused) {
      const total = document.querySelectorAll('#slides-area .slide').length;
      goToSlide((slideIndex + 1) % total, true);
    }
  }, dur);
}

function goToSlide(i, auto) {
  if (!auto && !slidePaused) { slidePaused = true; const btn = document.getElementById('slide-pause-btn'); if (btn) btn.textContent = '▶'; }
  slideIndex = i;
  const area = document.getElementById('slides-area');
  if (!area) return;
  area.querySelectorAll('.slide').forEach((s, idx) => s.classList.toggle('active', idx === i));
  area.querySelectorAll('.slide-dot').forEach((d, idx) => d.classList.toggle('active', idx === i));
  startSlideProgress();
}

function toggleSlidePause() {
  slidePaused = !slidePaused;
  const btn = document.getElementById('slide-pause-btn');
  if (btn) btn.textContent = slidePaused ? '▶' : '⏸';
  if (slidePaused) {
    if (slideTimer) { clearTimeout(slideTimer); slideTimer = null; }
    const bar = document.getElementById('slide-progress');
    if (bar) bar.style.display = 'none';
  } else {
    startSlideProgress();
  }
}

function toggleSlideFullscreen() {
  document.body.classList.toggle('slides-fullscreen');
  const isFull = document.body.classList.contains('slides-fullscreen');
  history.replaceState(null, '', isFull ? '#slides/fullscreen' : '#slides');
}

let slideClockTimer = null;
function startSlideClock() {
  if (slideClockTimer) clearInterval(slideClockTimer);
  updateSlideClock();
  slideClockTimer = setInterval(updateSlideClock, 10000);
}
function updateSlideClock() {
  const el = document.getElementById('slide-clock');
  if (!el) return;
  const now = new Date();
  el.textContent = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
}

function enterSlidesFullscreen() {
  if (currentTab !== 'slides') switchTab('slides', true);
  document.body.classList.add('slides-fullscreen');
}

function getWeekEventListHtml() {
  const today = getToday();
  const monday = getMondayOfWeek(today, getSlideWeekOffset());
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  const monStr = localDate(monday);
  const sunStr = localDate(sunday);
  const dayNames = ['sön','mån','tis','ons','tor','fre','lör'];
  const events = getPublicEvents()
    .filter(e => e.date >= monStr && e.date <= sunStr)
    .sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time));
  if (events.length === 0) return '<p style="font-size:13px;color:#9ca3af">Inga händelser denna vecka</p>';
  return events.map(ev => {
    const d = new Date(ev.date + 'T00:00:00');
    const day = dayNames[d.getDay()];
    return `<div onclick="switchTab('events',true);selectRow(${ev.id})" style="display:flex;align-items:center;gap:8px;padding:6px 4px;border-bottom:1px solid #f0f0f0;cursor:pointer;border-radius:4px;font-size:13px" onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background=''">
      <span style="min-width:28px;color:#9ca3af;font-size:11px;font-weight:600">${day}</span>
      <span style="min-width:40px;color:#6b7280;font-size:12px">${ev.time || ''}</span>
      <span style="flex:1;color:#374151;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(ev.title)}</span>
      <span class="badge" style="${catBadgeStyle(ev.category)};font-size:10px">${esc(ev.category || '')}</span>
    </div>`;
  }).join('');
}

function getEventPromoListHtml() {
  const today = getToday();
  const monday = getMondayOfWeek(today, getSlideWeekOffset());
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  const monStr = localDate(monday);
  const sunStr = localDate(sunday);
  const eventsWithPromos = getPublicEvents()
    .filter(e => e.date >= monStr && e.date <= sunStr && (e.promoSlides || []).some(Boolean))
    .sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time));
  if (eventsWithPromos.length === 0) return '<p style="font-size:13px;color:#9ca3af">Inga eventbilder denna vecka</p>';
  return eventsWithPromos.map(ev => {
    const thumbs = ev.promoSlides.filter(Boolean).map(url =>
      `<img src="${url}" style="width:40px;height:28px;object-fit:cover;border-radius:3px;border:1px solid #e5e7eb" onerror="this.style.display='none'">`
    ).join('');
    return `<div onclick="switchTab('events',true);selectRow(${ev.id})" style="display:flex;align-items:center;gap:8px;padding:6px 4px;border-bottom:1px solid #f0f0f0;cursor:pointer;border-radius:4px" onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background=''">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:500;color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${ev.title}</div>
        <div style="font-size:11px;color:#9ca3af">${ev.date} ${ev.time||''} · ${ev.promoSlides.filter(Boolean).length} bild${ev.promoSlides.filter(Boolean).length>1?'er':''}</div>
      </div>
      <div style="display:flex;gap:2px;flex-shrink:0">${thumbs}</div>
    </div>`;
  }).join('');
}

function renderSlidesSidebar() {
  const el = document.getElementById('sidebar-content');
  if (!db.globalSlides) db.globalSlides = [];
  const slides = db.globalSlides;

  const listHtml = slides.length === 0
    ? '<p style="font-size:13px;color:#9ca3af;padding:8px 0">Inga globala slides ännu</p>'
    : slides.map((s, i) => `<div style="position:relative;margin-bottom:8px">
        <img src="${s.url}" style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:6px;border:1px solid #e5e7eb;display:block;opacity:${s.active?'1':'0.35'};transition:opacity .2s" onerror="this.style.display='none'">
        <input type="checkbox" ${s.active?'checked':''} onchange="toggleGlobalSlide(${i},this.checked)" style="accent-color:'+ac()+';position:absolute;top:6px;left:6px;width:18px;height:18px;cursor:pointer">
        <button onclick="removeGlobalSlide(${i})" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,.5);border:none;color:#fff;cursor:pointer;padding:2px 4px;border-radius:4px"><i data-lucide="x" style="width:12px;height:12px"></i></button>
      </div>`).join('');

  const logoUrl = db.slideLogo || '';
  const logoPreview = logoUrl
    ? `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <img src="${logoUrl}" style="height:32px;width:auto;border-radius:4px;background:#111;padding:4px">
        <button class="btn-ghost" onclick="db.slideLogo='';persist('slideLogo');renderSlides();renderSlidesSidebar()" style="font-size:11px;padding:3px 8px">Ta bort</button>
      </div>`
    : '';

  const bgConf = db.slideBackground || {};
  const bgColors = ['#111','#1a1a2e','#0f172a','#18181b','#1e293b','#27272a','#0c0a09','#020617'];
  const bgSwatches = bgColors.map(c =>
    `<button onclick="setSlideBackground('${c}',null)" style="width:24px;height:24px;border-radius:4px;border:2px solid ${(bgConf.color||'#111')===c && !bgConf.image?ac():'transparent'};background:${c};cursor:pointer;padding:0"></button>`
  ).join('');
  const bgImagePreview = bgConf.image
    ? `<div style="display:flex;align-items:center;gap:8px;margin-top:8px">
        <img src="${bgConf.image}" style="height:32px;width:56px;object-fit:cover;border-radius:4px;border:1px solid #e5e7eb">
        <button class="btn-ghost" onclick="setSlideBackground('#111',null)" style="font-size:11px;padding:3px 8px">Ta bort</button>
      </div>`
    : '';

  el.innerHTML = `
  <div class="sidebar-header">
    <h3>Slideshow</h3>
  </div>
  <div class="sidebar-body">
    <div class="sb-section" style="margin-top:0;padding-top:0;border:none">
      <h4>Bakgrund</h4>
      <div style="display:flex;gap:4px;align-items:center;margin-bottom:6px">${bgSwatches}
        <label style="width:24px;height:24px;border-radius:4px;border:2px dashed #9ca3af;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;font-size:10px;color:#9ca3af" data-tip="Ladda upp bakgrundsbild">
          <i data-lucide="image" style="width:12px;height:12px"></i>
          <input type="file" accept="image/*" onchange="uploadSlideBackground(this)" style="display:none">
        </label>
      </div>${bgImagePreview}
    </div>
    <div class="sb-section">
      <h4>Logotyp</h4>
      <p style="font-size:12px;color:#6b7280;margin-bottom:8px">Visas i nedre högra hörnet på veckoschemat.</p>
      ${logoPreview}
      <label class="btn-ghost" style="font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:4px">
        <i data-lucide="upload" style="width:12px;height:12px"></i> ${logoUrl ? 'Byt logotyp' : 'Ladda upp logotyp'}
        <input type="file" accept="image/*" onchange="uploadSlideLogo(this)" style="display:none">
      </label>
    </div>
    <div class="sb-section">
      <h4>Globala slides</h4>
      <p style="font-size:12px;color:#6b7280;margin-bottom:12px">Bilder som visas i slideshowen oavsett vecka. Bocka i för att aktivera.</p>
      ${listHtml}
      <div style="margin-top:12px;display:flex;gap:6px">
        <label class="btn-ghost" style="font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:4px">
          <i data-lucide="upload" style="width:12px;height:12px"></i> Ladda upp
          <input type="file" accept="image/*" onchange="uploadGlobalSlide(this)" style="display:none">
        </label>
        <button class="btn-ghost" onclick="addGlobalSlideUrl()" style="font-size:12px">+ URL</button>
      </div>
    </div>
    <div class="sb-section">
      <h4>Händelser denna vecka</h4>
      ${getWeekEventListHtml()}
    </div>
    <div class="sb-section">
      <h4>Eventbilder denna vecka</h4>
      ${getEventPromoListHtml()}
    </div>
  </div>`;
  lucide.createIcons({nameAttr:'data-lucide', attrs:{class:'lucide-icon'}});
}

function toggleGlobalSlide(idx, checked) {
  db.globalSlides[idx].active = checked;
  persist('globalSlides');
  renderSlides();
  renderSlidesSidebar();
}

function removeGlobalSlide(idx) {
  db.globalSlides.splice(idx, 1);
  persist('globalSlides');
  renderSlides();
  renderSlidesSidebar();
}

function uploadGlobalSlide(input) {
  const file = input.files[0];
  if (!file) return;
  const headers = Object.assign({'Content-Type': file.type}, authHeader ? {'Authorization': authHeader} : {});
  fetch('/upload', { method: 'POST', headers, body: file })
    .then(r => {
      if (r.status === 413) throw new Error('Filen är för stor (max 25 MB)');
      if (r.status === 401) { showLogin(); return null; }
      if (!r.ok) throw new Error('Serverfel (' + r.status + ')');
      return r.json();
    })
    .then(data => {
      if (!data) return;
      if (!db.globalSlides) db.globalSlides = [];
      db.globalSlides.push({ url: data.url, label: '', active: true });
      persist('globalSlides');
      renderSlides();
      renderSlidesSidebar();
    })
    .catch(err => showToast('Uppladdning misslyckades: ' + err.message, 'error'));
}

function addGlobalSlideUrl() {
  const url = prompt('Bild-URL:');
  if (!url) return;
  if (!db.globalSlides) db.globalSlides = [];
  db.globalSlides.push({ url, label: '', active: true });
  persist('globalSlides');
  renderSlides();
  renderSlidesSidebar();
}

function uploadSlideLogo(input) {
  const file = input.files[0];
  if (!file) return;
  const headers = Object.assign({'Content-Type': file.type}, authHeader ? {'Authorization': authHeader} : {});
  fetch('/upload', { method: 'POST', headers, body: file })
    .then(r => {
      if (r.status === 413) throw new Error('Filen är för stor (max 25 MB)');
      if (r.status === 401) { showLogin(); return null; }
      if (!r.ok) throw new Error('Serverfel (' + r.status + ')');
      return r.json();
    })
    .then(data => {
      if (!data) return;
      db.slideLogo = data.url;
      persist('slideLogo');
      renderSlides();
      renderSlidesSidebar();
    })
    .catch(err => showToast('Uppladdning misslyckades: ' + err.message, 'error'));
}

function setSlideBackground(color, image) {
  db.slideBackground = { color: color || '#111', image: image || '' };
  persist('slideBackground');
  renderSlides();
  renderSlidesSidebar();
}

function uploadSlideBackground(input) {
  const file = input.files[0];
  if (!file) return;
  const headers = Object.assign({'Content-Type': file.type}, authHeader ? {'Authorization': authHeader} : {});
  fetch('/upload', { method: 'POST', headers, body: file })
    .then(r => {
      if (r.status === 413) throw new Error('Filen är för stor (max 25 MB)');
      if (r.status === 401) { showLogin(); return null; }
      if (!r.ok) throw new Error('Serverfel (' + r.status + ')');
      return r.json();
    })
    .then(data => {
      if (!data) return;
      setSlideBackground(null, data.url);
    })
    .catch(err => showToast('Uppladdning misslyckades: ' + err.message, 'error'));
}
