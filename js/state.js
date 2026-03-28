// ── DATA ──────────────────────────────────────────────────────────────────────
function localDate(d) { const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; }
function esc(s) { const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }
function escAttr(s) { return (s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function ac() { return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(); }
function acHover() { return getComputedStyle(document.documentElement).getPropertyValue('--accent-hover').trim(); }
function acLight() { return getComputedStyle(document.documentElement).getPropertyValue('--accent-light').trim(); }
function acMid() { return getComputedStyle(document.documentElement).getPropertyValue('--accent-mid').trim(); }
let simDate = localStorage.getItem('simDate') || null;
function getToday() { return simDate ? new Date(simDate+'T00:00:00') : new Date(); }
function getTodayStr() { return localDate(getToday()); }
function setSimDate(v) {
  simDate = v || null;
  if (simDate) localStorage.setItem('simDate', simDate); else localStorage.removeItem('simDate');
  const el = document.getElementById('sim-date');
  if (el) el.value = simDate || localDate(new Date());
  updateSimWarning();
  if (currentTab==='events') applyFilters();
  if (currentTab==='mailbot') renderMailbot();
  if (currentTab==='slides') renderSlides();
  if (currentTab==='export') renderExport();
  if (currentTab==='namnskyltar') renderNamnskyltar();
  if (currentTab==='sunday') renderSunday();
}
function clearSimDate() { setSimDate(null); }
function updateSimWarning() {
  let w = document.getElementById('sim-warning');
  if (simDate) {
    if (!w) {
      w = document.createElement('span');
      w.id = 'sim-warning';
      w.style.cssText = 'background:#fef3c7;color:#92400e;font-size:11px;padding:2px 10px;border-radius:4px;display:inline-flex;align-items:center;gap:6px;margin-left:8px';
      const spacer = document.querySelector('nav .spacer');
      if (spacer) spacer.after(w);
    }
    w.innerHTML = `⚠ Simulerat datum: <strong>${simDate}</strong> — inte dagens datum <button onclick="clearSimDate()" style="background:none;border:1px solid #92400e;border-radius:3px;color:#92400e;padding:0 6px;font-size:10px;cursor:pointer">Återställ</button>`;
    w.style.display = '';
  } else if (w) {
    w.style.display = 'none';
  }
}
let db = {};
let dbVersion = 0;
let schedules = {};

// ── STATE ─────────────────────────────────────────────────────────────────────
let currentTab = 'events';
let selectedId = null;
let sortCol = null;
let sortDir = 1;
let filtered = [];
let currentView = 'list';
let selectedYear = getToday().getFullYear();
const assignments = {};
let exportMonths = 2;
let exportStartDate = getTodayStr();
let teamBoardTaskId = null;

// ── TAB CONFIG ────────────────────────────────────────────────────────────────
const BADGE_COLORS = [
  { id:'blue',   bg:'#dbeafe', fg:'#1d4ed8' },
  { id:'green',  bg:'#d1fae5', fg:'#065f46' },
  { id:'amber',  bg:'#fef3c7', fg:'#92400e' },
  { id:'gray',   bg:'#f3f4f6', fg:'#6b7280' },
  { id:'red',    bg:'#fee2e2', fg:'#991b1b' },
  { id:'purple', bg:'#ede9fe', fg:'#5b21b6' },
  { id:'pink',   bg:'#fce7f3', fg:'#9d174d' },
  { id:'teal',   bg:'#ccfbf1', fg:'#115e59' },
];

function getCatColor(catName) {
  const cat = (db.categories||[]).find(c => c.name === catName);
  const colorId = cat && cat.color;
  return BADGE_COLORS.find(c => c.id === colorId) || BADGE_COLORS[3]; // default gray
}

function catBadgeStyle(catName) {
  const c = getCatColor(catName);
  return `background:${c.bg};color:${c.fg}`;
}

function catCalClass(catName) {
  const c = getCatColor(catName);
  return `background:${c.bg};color:${c.fg}`;
}
const tabConfig = {
  events: {
    label:'Händelser',
    desc:'Alla händelser, schema och kalender',
    cols:[
      {key:'date',      label:'Datum',     render:(v,r)=>`<span style="font-size:12px;white-space:nowrap">${v} ${r.time||''}</span>`},
      {key:'weekday',   label:'Dag',       render:(v,r)=>{const d=new Date(r.date+'T00:00:00');return ['söndag','måndag','tisdag','onsdag','torsdag','fredag','lördag'][d.getDay()]}},
      {key:'title',     label:'Titel',     render:(v,r)=>esc(r.title)},
      {key:'category',  label:'Kategori',  render:(v,r)=>{return `<span class="badge" style="${catBadgeStyle(r.category)};font-size:11px;white-space:nowrap">${esc(r.category||'—')}</span>`}},
      {key:'description',label:'Beskrivning',render:(v,r)=>r.description||'<span style="color:#9ca3af">—</span>'},
      {key:'infoLink',  label:'Infolänk',  render:(v,r)=>r.infoLink?`<a href="${r.infoLink}" target="_blank" onclick="event.stopPropagation()" style="color:'+ac()+';font-size:12px">${r.infoLink.replace(/^https?:\/\//,'').slice(0,30)}</a>`:'<span style="color:#9ca3af">—</span>'},
    ],
    filter:null,
    stats:d=>{
      const todayStr = getTodayStr();
      const warns = d.reduce((n,ev) => {
        if (ev.date < todayStr) return n;
        const req = ev.expectedTasks || [];
        return n + req.filter(tid => !assignments[ev.id]?.[tid]).length;
      }, 0);
      const warnHtml = warns > 0 ? ` <span class="stat warn-count">⚠ ${warns} saknas</span>` : '';
      updateScheduleBadge(warns);
      const warnStat = currentView === 'monster' && warns > 0 ? ` <span class="stat warn-count">⚠ ${warns} saknas</span>` : '';
      return `<span class="stat">Totalt: <strong>${d.length}</strong></span>${warnStat} <button onclick="newEventOnDate(getTodayStr())" style="background:none;border:none;color:'+ac()+';cursor:pointer;font-size:13px;display:inline-flex;align-items:center;gap:4px;padding:0 4px"><i data-lucide="plus-circle" style="width:14px;height:14px"></i> Ny händelse</button>`;
    },
  },
  contacts: {
    label:'Kontakter',
    desc:'Hantera volontärer och kontaktuppgifter',
    cols:[
      {key:'name', label:'Namn', render:v=>v},
      {key:'email',label:'E-post',render:v=>`<a href="mailto:${v}" onclick="event.stopPropagation()">${v}</a>`},
      {key:'phone',label:'Telefon',render:v=>v||'<span style="color:#9ca3af">—</span>'},
    ],
    filter:null,
    stats:d=>`<span class="stat">Totalt: <strong>${d.length}</strong> kontakter</span>
      <button onclick="newContact()" style="background:none;border:none;color:'+ac()+';cursor:pointer;font-size:13px;display:inline-flex;align-items:center;gap:4px;padding:0 4px"><i data-lucide="plus-circle" style="width:14px;height:14px"></i> Ny kontakt</button>`,
  },
  tasks: {
    label:'Uppgifter',
    desc:'Roller och uppgifter som kan tilldelas',
    cols:[
      {key:'name',    label:'Namn',           render:v=>v},
      {key:'teamTask',label:'Teamuppgift',    render:v=>`<span class="badge badge-${v?'yes':'no'}">${v?'Ja':'Nej'}</span>`},
      {key:'mailbot', label:'Mailbot',         render:v=>`<span class="badge badge-${v?'yes':'no'}">${v?'Ja':'Nej'}</span>`},
      {key:'phrase',  label:'Påminnelsefras', render:v=>v?`"${v}"` :'<span style="color:#9ca3af">—</span>'},
    ],
    filter:null,
    stats:d=>`<span class="stat">Totalt: <strong>${d.length}</strong> uppgifter</span>
      <span class="stat">Mailbot aktiv: <strong>${d.filter(t=>t.mailbot).length}</strong></span>
      <button onclick="newTask()" style="background:none;border:none;color:'+ac()+';cursor:pointer;font-size:13px;display:inline-flex;align-items:center;gap:4px;padding:0 4px"><i data-lucide="plus-circle" style="width:14px;height:14px"></i> Ny uppgift</button>`,
  },
  categories: {
    label:'Kategorier',
    desc:'Organisera händelser i kategorier med färger',
    cols:[],
    filter:null,
    stats:()=>'',
  },
  teams: {
    label:'Team',
    desc:'Gruppera volontärer i team per uppgift',
    cols:[
      {key:'taskId', label:'Uppgift', render:v=>db.tasks?.find(t=>t.id===v)?.name||v},
      {key:'number', label:'Team #', render:v=>v},
      {key:'members',label:'Medlemmar',render:v=>v.map(id=>db.contacts?.find(c=>c.id===id)?.name).join(', ')||'<span style="color:#9ca3af">—</span>'},
    ],
    filter:null,
    stats:d=>`<span class="stat">Totalt: <strong>${d.length}</strong> team</span>`,
  },
  slides: {
    label:'Slides',
    desc:'Bildspel för storskärm med veckans program',
    cols:[],
    filter:null,
    stats:()=>'',
  },
  export: {
    label:'Månadsblad',
    desc:'Generera och publicera månadsblad till hemsidan',
    cols:[],
    filter:null,
    stats:()=>'',
  },
  mailbot: {
    label:'Påminnelsemail',
    desc:'Förhandsgranska och skicka påminnelsemail',
    cols:[],
    filter:null,
    stats:()=>'',
  },
  namnskyltar: {
    label:'Namnskyltar',
    desc:'Fullskärmsskyltar med namn och roll',
    cols:[],
    filter:null,
    stats:()=>'',
  },
  sunday: {
    label:'Söndag',
    desc:'Tjänstgöringslista för dagens händelser',
    cols:[],
    filter:null,
    stats:()=>'',
  },
};
