// ── GENERATE RECURRING EVENTS ──────────────────────────────────────────────────
const dayMap = {Mån:1,Tis:2,Ons:3,Tor:4,Fre:5,Lör:6,Sön:0};
const dayLabels = ['Mån','Tis','Ons','Tor','Fre','Lör','Sön'];
let genPatterns = {};

function openGenModal() {
  // load from db
  genPatterns = JSON.parse(JSON.stringify(db.recurring_events || {}));
  renderGenModal();
  document.getElementById('gen-modal').classList.add('open');
}

function closeGenModal() {
  document.getElementById('gen-modal').classList.remove('open');
}

function renderGenModal() {
  const body = document.getElementById('gen-body');
  const today = getToday();
  const defFrom = document.getElementById('gen-from')?.value || localDate(today);
  const defTo = document.getElementById('gen-to')?.value || localDate(new Date(today.getFullYear(), today.getMonth()+3, today.getDate()));

  let html = `<div class="gen-range">
    <div><label>Från</label><br><input type="date" id="gen-from" value="${defFrom}" onchange="previewGen()"></div>
    <div><label>Till</label><br><input type="date" id="gen-to" value="${defTo}" onchange="previewGen()"></div>
  </div>`;

  html += dayLabels.map(day => {
    const entries = genPatterns[day] || [];
    const rows = entries.map((e, i) => {
      const filter = e.filter || 'ALL';
      const time = e.time || '10:00';
      const title = e.title || '';
      return `<div class="gen-row">
        <select onchange="updateGenEntry('${day}',${i},'filter',this.value);previewGen()">
          <option value="ALL" ${filter==='ALL'?'selected':''}>Varje</option>
          <option value="ODD" ${filter==='ODD'?'selected':''}>Udda v.</option>
          <option value="EVEN" ${filter==='EVEN'?'selected':''}>Jämn v.</option>
        </select>
        <input type="text" value="${time}" placeholder="HH:MM" style="width:60px" onchange="updateGenEntry('${day}',${i},'time',this.value);previewGen()">
        <input type="text" class="gen-title" value="${title}" placeholder="Titel" oninput="updateGenEntry('${day}',${i},'title',this.value);previewGen()">
        <button class="gen-rm" onclick="removeGenEntry('${day}',${i})">✕</button>
      </div>`;
    }).join('');
    return `<div class="gen-day">
      <div class="gen-day-header"><strong>${day}</strong></div>
      ${rows}
      <button class="gen-add" onclick="addGenEntry('${day}')">+ Lägg till</button>
    </div>`;
  }).join('');

  body.innerHTML = html;
  previewGen();
}

function updateGenEntry(day, idx, field, val) {
  if (!genPatterns[day]) return;
  const e = genPatterns[day][idx];
  if (field==='filter') { e.filter = val === 'ALL' ? undefined : val; if (!e.filter) delete e.filter; }
  if (field==='time') e.time = val;
  if (field==='title') e.title = val;
}

function removeGenEntry(day, idx) {
  if (!genPatterns[day]) return;
  genPatterns[day].splice(idx, 1);
  if (genPatterns[day].length === 0) delete genPatterns[day];
  renderGenModal();
}

function addGenEntry(day) {
  if (!genPatterns[day]) genPatterns[day] = [];
  genPatterns[day].push({title:'', time:'10:00'});
  renderGenModal();
}

function generateEventList() {
  const from = document.getElementById('gen-from')?.value;
  const to = document.getElementById('gen-to')?.value;
  if (!from || !to) return [];
  const results = [];
  const d = new Date(from + 'T00:00:00');
  const end = new Date(to + 'T00:00:00');
  const jsDayToLabel = [6,0,1,2,3,4,5];
  const labelFromJs = js => dayLabels[jsDayToLabel[js]];

  while (d <= end) {
    const dayLabel = labelFromJs(d.getDay());
    const entries = genPatterns[dayLabel] || [];
    const wn = getWeekNumber(d);
    entries.forEach(e => {
      const filter = e.filter || 'ALL';
      const title = e.title;
      if (!title) return;
      if (filter === 'ODD' && wn % 2 === 0) return;
      if (filter === 'EVEN' && wn % 2 !== 0) return;
      results.push({ date: localDate(d), time: e.time, title, category: e.category||'Weekday', expectedTasks: e.expectedTasks||[], promoSlides: e.promoSlides||[], infoLink: e.infoLink||'' });
    });
    d.setDate(d.getDate() + 1);
  }
  return results;
}

function previewGen() {
  const list = generateEventList();
  const area = document.getElementById('gen-preview-area');
  if (!area) return;
  if (list.length === 0) {
    area.innerHTML = '<p class="gen-count" style="padding:8px">Inga händelser att generera</p>';
    return;
  }
  area.innerHTML = `<p class="gen-count" style="margin-bottom:8px"><strong>${list.length}</strong> händelser</p>
    <div class="gen-preview" style="max-height:none">${list.map(e =>
    `<div class="gen-preview-row"><span class="gp-date">${e.date}</span><span class="gp-time">${e.time}</span><span class="gp-title">${e.title}</span></div>`
  ).join('')}</div>`;
}

function executeGenerate() {
  const list = generateEventList();
  if (list.length === 0) { alert('Inga händelser att generera. Förhandsgranska först.'); return; }
  let maxId = db.events.reduce((m,e) => Math.max(m,e.id), 0);
  let added = 0;
  list.forEach(e => {
    if (db.events.some(x => x.date===e.date && x.time===e.time && x.title===e.title)) return;
    maxId++;
    const ev = {id:maxId, title:e.title, category:e.category, date:e.date, time:e.time, description:'', volunteers:0, promoSlides:JSON.parse(JSON.stringify(e.promoSlides)), infoLink:e.infoLink, expectedTasks:JSON.parse(JSON.stringify(e.expectedTasks))};
    db.events.push(ev);
    assignments[ev.id] = {};
    added++;
  });
  db.recurring_events = genPatterns;
  closeGenModal();
  persist('events');
  persist('recurring_events');
  applyFilters();
  alert(`${added} händelser genererade!`);
}
