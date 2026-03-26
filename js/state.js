// ── DATA ──────────────────────────────────────────────────────────────────────
function localDate(d) { const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; }
function esc(s) { const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }
function escAttr(s) { return (s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
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
}
function clearSimDate() { setSimDate(null); }
function updateSimWarning() {
  let w = document.getElementById('sim-warning');
  if (simDate) {
    if (!w) {
      w = document.createElement('div');
      w.id = 'sim-warning';
      w.style.cssText = 'background:#fef3c7;color:#92400e;font-size:12px;padding:4px 16px;display:flex;align-items:center;gap:8px;flex-shrink:0';
      document.querySelector('.main').prepend(w);
    }
    w.innerHTML = `⚠ Simulerat datum: <strong>${simDate}</strong> — inte dagens datum <button onclick="clearSimDate()" style="background:none;border:1px solid #92400e;border-radius:4px;color:#92400e;padding:1px 8px;font-size:11px;cursor:pointer;margin-left:4px">Återställ</button>`;
    w.style.display = '';
  } else if (w) {
    w.style.display = 'none';
  }
}
let db = {};
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
const tabConfig = {
  events: {
    label:'Events',
    cols:[
      {key:'date',      label:'Date',      render:(v,r)=>`<span style="font-size:12px;white-space:nowrap">${v} ${r.time||''}</span>`},
      {key:'weekday',   label:'Day',       render:(v,r)=>{const d=new Date(r.date+'T00:00:00');return ['söndag','måndag','tisdag','onsdag','torsdag','fredag','lördag'][d.getDay()]}},
      {key:'title',     label:'Title',     render:(v,r)=>esc(r.title)},
      {key:'category',  label:'Category',  render:(v,r)=>{const c=(r.category||'Weekday').toLowerCase();return `<span class="badge badge-${c}" style="font-size:11px">${r.category||'Weekday'}</span>`}},
      {key:'description',label:'Description',render:(v,r)=>r.description||'<span style="color:#9ca3af">—</span>'},
      {key:'infoLink',  label:'Info link',  render:(v,r)=>r.infoLink?`<a href="${r.infoLink}" target="_blank" onclick="event.stopPropagation()" style="color:#4f46e5;font-size:12px">${r.infoLink.replace(/^https?:\/\//,'').slice(0,30)}</a>`:'<span style="color:#9ca3af">—</span>'},
    ],
    filter:null,
    stats:d=>{
      const warns = d.reduce((n,ev) => {
        const req = ev.expectedTasks || [];
        return n + req.filter(tid => !assignments[ev.id]?.[tid]).length;
      }, 0);
      const warnHtml = warns > 0 ? ` <span class="stat warn-count">⚠ ${warns} saknas</span>` : '';
      updateScheduleBadge(warns);
      const warnStat = currentView === 'monster' && warns > 0 ? ` <span class="stat warn-count">⚠ ${warns} saknas</span>` : '';
      return `<span class="stat">Total: <strong>${d.length}</strong></span>${warnStat} <button onclick="newEventOnDate(getTodayStr())" style="background:none;border:none;color:#4f46e5;cursor:pointer;font-size:13px;display:inline-flex;align-items:center;gap:4px;padding:0 4px"><i data-lucide="plus-circle" style="width:14px;height:14px"></i> Ny händelse</button>`;
    },
  },
  contacts: {
    label:'Contacts',
    cols:[
      {key:'name', label:'Name', render:v=>v},
      {key:'email',label:'Email',render:v=>`<a href="mailto:${v}" onclick="event.stopPropagation()">${v}</a>`},
      {key:'phone',label:'Phone',render:v=>v||'<span style="color:#9ca3af">—</span>'},
    ],
    filter:null,
    stats:d=>`<span class="stat">Total contacts: <strong>${d.length}</strong></span>
      <button onclick="newContact()" style="background:none;border:none;color:#4f46e5;cursor:pointer;font-size:13px;display:inline-flex;align-items:center;gap:4px;padding:0 4px"><i data-lucide="plus-circle" style="width:14px;height:14px"></i> Ny kontakt</button>`,
  },
  tasks: {
    label:'Tasks',
    cols:[
      {key:'name',    label:'Name',           render:v=>v},
      {key:'teamTask',label:'Team task',       render:v=>`<span class="badge badge-${v?'yes':'no'}">${v?'Yes':'No'}</span>`},
      {key:'mailbot', label:'Mailbot',         render:v=>`<span class="badge badge-${v?'yes':'no'}">${v?'Yes':'No'}</span>`},
      {key:'phrase',  label:'Reminder phrase', render:v=>v?`"${v}"` :'<span style="color:#9ca3af">—</span>'},
    ],
    filter:null,
    stats:d=>`<span class="stat">Total tasks: <strong>${d.length}</strong></span>
      <span class="stat">Mailbot enabled: <strong>${d.filter(t=>t.mailbot).length}</strong></span>
      <button onclick="newTask()" style="background:none;border:none;color:#4f46e5;cursor:pointer;font-size:13px;display:inline-flex;align-items:center;gap:4px;padding:0 4px"><i data-lucide="plus-circle" style="width:14px;height:14px"></i> Ny uppgift</button>`,
  },
  categories: {
    label:'Categories',
    cols:[],
    filter:null,
    stats:()=>'',
  },
  teams: {
    label:'Teams',
    cols:[
      {key:'taskId', label:'Task',   render:v=>db.tasks?.find(t=>t.id===v)?.name||v},
      {key:'number', label:'Team #', render:v=>v},
      {key:'members',label:'Members',render:v=>v.map(id=>db.contacts?.find(c=>c.id===id)?.name).join(', ')||'<span style="color:#9ca3af">—</span>'},
    ],
    filter:null,
    stats:d=>`<span class="stat">Total teams: <strong>${d.length}</strong></span>`,
  },
  slides: {
    label:'Slides',
    cols:[],
    filter:null,
    stats:()=>'',
  },
  export: {
    label:'Export',
    cols:[],
    filter:null,
    stats:()=>'',
  },
  mailbot: {
    label:'Mailbot',
    cols:[],
    filter:null,
    stats:()=>'',
  },
  namnskyltar: {
    label:'Namnskyltar',
    cols:[],
    filter:null,
    stats:()=>'',
  },
};
