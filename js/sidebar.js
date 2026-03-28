// ── SIDEBAR ───────────────────────────────────────────────────────────────────
function renderSidebar(record) {
  const el = document.getElementById('sidebar-content');
  if (!record) {
    el.innerHTML = `<div class="empty-sidebar">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".3"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
      <p style="font-size:13px">Välj en rad för att se detaljer</p></div>`;
    return;
  }
  const builders = { events:sidebarEvent, contacts:sidebarContact, tasks:sidebarTask, teams:sidebarTeam };
  if (builders[currentTab]) el.innerHTML = builders[currentTab](record);
  initSidebarTracking();
  lucide.createIcons({nameAttr:'data-lucide', attrs:{class:'lucide-icon'}});
}

function getAssignmentLabel(eid, tid) {
  const a = assignments[eid]?.[tid];
  if (!a) return '—';
  if (a.type==='team') {
    const t = db.teams.find(t=>t.id===a.id);
    return t ? `Team ${t.number}` : '?';
  }
  return (a.ids||[]).map(id=>db.contacts.find(c=>c.id===id)?.name).filter(Boolean).join(', ') || '—';
}

function sidebarEvent(r) {
  const isNew = r._isNew;
  const taskRows = isNew ? '' : db.tasks.map(t =>
    `<li><span>${t.name}</span><span class="who">${getAssignmentLabel(r.id, t.id)}</span></li>`
  ).join('');
  const assigned = isNew ? 0 : Object.keys(assignments[r.id]||{}).length;
  const promos = r.promoSlides || [];
  const promoHtml = promos.length
    ? promos.map((url,i) => `<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <img src="${url}" style="width:48px;height:32px;object-fit:cover;border-radius:4px;border:1px solid #e5e7eb" onerror="this.style.display='none'">
        <input type="text" value="${url}" style="flex:1" placeholder="URL eller ladda upp" data-promo-idx="${i}">
        <button class="btn-ghost" onclick="removePromoSlide(${r.id},${i})" style="padding:3px 8px;font-size:11px"><i data-lucide="x" style="width:12px;height:12px"></i></button>
      </div>`).join('')
    : '<p style="font-size:13px;color:#9ca3af">Inga promo-bilder</p>';
  const deleteBtn = isNew ? '' : `<button class="btn-danger" onclick="if(confirm('Ta bort denna händelse?'))deleteEvent(${r.id})" style="font-size:12px;padding:5px 10px">Ta bort</button>`;
  const schemaSection = isNew ? '' : `<div class="sb-section">
      <h4>Schema (${assigned} tilldelade)</h4>
      <ul class="mini-list">${taskRows}</ul>
    </div>`;
  return `
  <div class="sidebar-header">
    <h3>${isNew ? 'Ny händelse' : esc(r.title)}</h3>
    <button class="sidebar-close" onclick="closeEventDetail()">×</button>
  </div>
  <div class="sidebar-body" id="sb-body">
    <div class="field-group"><label>Datum</label><input type="date" value="${r.date}" id="sb-date"></div>
    <div class="field-group"><label>Tid</label><input type="time" value="${r.time||''}" id="sb-time"></div>
    <div class="field-group"><label>Titel</label><input type="text" value="${escAttr(r.title)}" id="sb-title"></div>
    <div class="field-group"><label>Kategori</label>
      <select id="sb-category">${(db.categories||[]).map(c=>`<option${c.name===r.category?' selected':''}>${esc(c.name)}</option>`).join('')}</select>
    </div>
    <div class="field-group"><label>Beskrivning</label><textarea rows="2" id="sb-desc">${esc(r.description||'')}</textarea></div>
    <div class="field-group"><label>Infolänk</label><input type="url" value="${escAttr(r.infoLink||'')}" placeholder="https://…" id="sb-infolink"></div>
    <div class="sb-section">
      <h4>Promobilder</h4>
      <div id="sb-promos">${promoHtml}</div>
      <div style="display:flex;gap:6px;margin-top:4px">
        <label class="btn-ghost" style="font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:4px">
          <i data-lucide="upload" style="width:12px;height:12px"></i> Ladda upp
          <input type="file" accept="image/*" onchange="uploadPromoFile(this,${r.id})" style="display:none">
        </label>
        <button class="btn-ghost" onclick="addPromoSlide(${r.id})" style="font-size:12px">+ URL</button>
      </div>
    </div>
    <div class="sb-section">
      <h4>Förväntade uppgifter</h4>
      <div class="cat-task-list">${db.tasks.map(t=>
        `<label><input type="checkbox" ${(r.expectedTasks||[]).includes(t.id)?'checked':''} data-exp-task="${t.id}"> ${t.name}</label>`
      ).join('')}</div>
    </div>
    ${schemaSection}
  </div>
  <div class="sidebar-footer">
    <button class="btn-save" id="btn-save" onclick="saveEvent(${r.id})" data-is-new="${isNew?'1':''}">Spara</button>
    <span style="flex:1"></span>
    ${deleteBtn}
  </div>`;
}

function closeEventDetail() {
  if (currentView === 'monster' || currentView === 'calendar') {
    closeDetailModal();
  } else {
    renderSidebar(null); selectedId = null; renderTable(); updateHash();
  }
}

// track sidebar dirty state
function initSidebarTracking() {
  const body = document.getElementById('sb-body');
  if (!body) return;
  const mark = () => { const b = document.getElementById('btn-save'); if (b) b.classList.add('dirty'); };
  body.addEventListener('input', mark);
  body.addEventListener('change', mark);
}

function slugifyEmail(email) {
  return (email || '').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function sidebarContact(r) {
  const todayStr = getTodayStr();
  const upcoming = (db.events||[])
    .filter(e => e.date >= todayStr)
    .filter(e => {
      const asgn = assignments[e.id] || {};
      return Object.values(asgn).some(val => {
        if (val.type === 'contact') return (val.ids||[]).includes(r.id);
        if (val.type === 'team') { const team = db.teams.find(t=>t.id===val.id); return team && team.members.includes(r.id); }
        return false;
      });
    })
    .sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time))
    .slice(0, 10);
  const icalSlug = slugifyEmail(r.email);
  const icalUrl = r.email ? (location.origin + '/api/cal/' + icalSlug + '.ics') : '';
  const webcalUrl = icalUrl ? icalUrl.replace(/^https?:/, 'webcal:') : '';
  const icalHtml = icalUrl
    ? `<div class="sb-section">
        <h4>Kalender</h4>
        <p style="font-size:11px;color:#9ca3af;margin-bottom:8px">Importera ${esc(r.name.split(' ')[0])}s tilldelade uppgifter till en kalenderapp.</p>
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">
          <input type="text" value="${escAttr(icalUrl)}" readonly onclick="this.select()" style="flex:1;font-size:11px;background:#f9fafb;color:#6b7280;cursor:text">
          <button class="btn-ghost" onclick="navigator.clipboard.writeText('${escAttr(icalUrl)}');showToast('Kopierad!','ok')" style="flex-shrink:0;padding:5px 8px" data-tip="Kopiera länk"><i data-lucide="copy" style="width:12px;height:12px"></i></button>
        </div>
        <a href="${escAttr(webcalUrl)}" class="btn" style="display:inline-flex;align-items:center;gap:6px;text-decoration:none;font-size:12px;padding:5px 12px">📅 Öppna i kalenderapp</a>
      </div>`
    : '';
  return `
  <div class="sidebar-header">
    <h3>${r.name}</h3>
    <button class="sidebar-close" onclick="closeContactDetail()">×</button>
  </div>
  <div class="sidebar-body" id="sb-body">
    <div class="field-group"><label>Namn</label><input type="text" value="${r.name}" id="sb-cname"></div>
    <div class="field-group"><label>E-post</label><input type="email" value="${r.email}" id="sb-cemail"></div>
    <div class="field-group"><label>Telefon</label><input type="tel" value="${r.phone}" id="sb-cphone"></div>
    <div class="sb-section">
      <h4>Kommande händelser</h4>
      <ul class="mini-list">${upcoming.length ? upcoming.map(e=>{
        const asgn = assignments[e.id]||{};
        const tasks = Object.entries(asgn).filter(([tid,val]) => {
          if (val.type==='contact') return (val.ids||[]).includes(r.id);
          if (val.type==='team') { const team=db.teams.find(t=>t.id===val.id); return team&&team.members.includes(r.id); }
          return false;
        }).map(([tid])=>db.tasks.find(t=>t.id===parseInt(tid))?.name).filter(Boolean).join(', ');
        return `<li><span>${e.date}</span><span class="who">${esc(e.title)}${tasks?' · '+tasks:''}</span></li>`;
      }).join('') : '<li style="color:#9ca3af">Inga kommande tilldelningar</li>'}</ul>
    </div>
    ${icalHtml}
  </div>
  <div class="sidebar-footer">
    <button class="btn-save" id="btn-save" onclick="saveContact(${r.id})" data-is-new="${r._isNew?'1':''}">Spara</button>
  </div>`;
}

function openContactModal(id) {
  const c = db.contacts.find(x=>x.id===id);
  if (!c) return;
  const modal = document.getElementById('detail-modal');
  document.getElementById('detail-modal-content').innerHTML = sidebarContact(c);
  modal.classList.add('open');
  initSidebarTracking();
  lucide.createIcons({nameAttr:'data-lucide', attrs:{class:'lucide-icon'}});
}

function closeContactDetail() {
  const useModal = ['teams','mailbot'].includes(currentTab);
  if (useModal) {
    closeDetailModal();
    if (currentTab === 'teams') renderTeamBoard();
    if (currentTab === 'mailbot') renderMailbot();
  } else {
    renderSidebar(null); selectedId = null; renderTable(); updateHash();
  }
}

function saveContact(id) {
  const isNew = document.getElementById('btn-save')?.dataset.isNew === '1';
  if (isNew) {
    const c = {
      id: id,
      name: document.getElementById('sb-cname').value,
      email: document.getElementById('sb-cemail').value,
      phone: document.getElementById('sb-cphone').value,
    };
    db.contacts.push(c);
    persist('contacts');
    closeDetailModal();
    applyFilters();
    return;
  }
  const c = db.contacts.find(x=>x.id===id);
  if (!c) return;
  c.name = document.getElementById('sb-cname').value;
  c.email = document.getElementById('sb-cemail').value;
  c.phone = document.getElementById('sb-cphone').value;
  persist('contacts');
  const useModal = ['teams','mailbot'].includes(currentTab);
  if (useModal) {
    closeDetailModal();
    if (currentTab === 'teams') renderTeamBoard();
    if (currentTab === 'mailbot') renderMailbot();
  } else {
    applyFilters();
    renderSidebar(c);
  }
}

function sidebarTask(r) {
  const isNew = r._isNew;
  return `
  <div class="sidebar-header">
    <h3>${isNew ? 'Ny uppgift' : r.name}</h3>
    <button class="sidebar-close" onclick="${isNew ? 'closeDetailModal()' : 'renderSidebar(null);selectedId=null;renderTable()'}">×</button>
  </div>
  <div class="sidebar-body" id="sb-body">
    <div class="field-group"><label>Namn</label><input type="text" value="${r.name}" id="sb-tname"></div>
    <div class="field-group"><label>Alternativ</label>
      <div class="checkbox-row"><input type="checkbox" id="sb-tteam" ${r.teamTask?'checked':''}><label for="sb-tteam" style="text-transform:none;font-size:13px;color:#374151">Teamuppgift</label></div>
      <div class="checkbox-row"><input type="checkbox" id="sb-tmailbot" ${r.mailbot?'checked':''}><label for="sb-tmailbot" style="text-transform:none;font-size:13px;color:#374151">Mailbot aktiverad</label></div>
    </div>
    <div class="field-group"><label>Påminnelsefras</label><input type="text" value="${r.phrase}" id="sb-tphrase"></div>
  </div>
  <div class="sidebar-footer">
    <button class="btn-save" id="btn-save" onclick="saveTask(${r.id})" data-is-new="${isNew?'1':''}">Spara</button>
  </div>`;
}

function saveTask(id) {
  const isNew = document.getElementById('btn-save')?.dataset.isNew === '1';
  if (isNew) {
    const t = {
      id: id,
      name: document.getElementById('sb-tname').value,
      teamTask: document.getElementById('sb-tteam').checked,
      mailbot: document.getElementById('sb-tmailbot').checked,
      phrase: document.getElementById('sb-tphrase').value,
    };
    db.tasks.push(t);
    persist('tasks');
    closeDetailModal();
    applyFilters();
    return;
  }
  const t = db.tasks.find(x=>x.id===id);
  if (!t) return;
  t.name = document.getElementById('sb-tname').value;
  t.teamTask = document.getElementById('sb-tteam').checked;
  t.mailbot = document.getElementById('sb-tmailbot').checked;
  t.phrase = document.getElementById('sb-tphrase').value;
  persist('tasks');
  applyFilters();
  renderSidebar(t);
}

function sidebarTeam(r) {
  const taskName = db.tasks.find(t=>t.id===r.taskId)?.name || '?';
  const memberNames = r.members.map(id => db.contacts.find(c=>c.id===id)?.name).filter(Boolean);
  return `
  <div class="sidebar-header">
    <h3>${taskName} — Team ${r.number}</h3>
    <button class="sidebar-close" onclick="renderSidebar(null);selectedId=null;renderTable()">×</button>
  </div>
  <div class="sidebar-body" id="sb-body">
    <div class="field-group"><label>Task</label>
      <select id="sb-teamtask">${db.tasks.filter(t=>t.teamTask).map(t=>`<option value="${t.id}"${t.id===r.taskId?' selected':''}>${t.name}</option>`).join('')}</select>
    </div>
    <div class="field-group"><label>Team #</label><input type="number" value="${r.number}" style="width:80px" id="sb-teamnum"></div>
    <div class="sb-section">
      <h4>Medlemmar (${r.members.length})</h4>
      <div class="sb-member-picker" id="sb-members">
        <input class="pop-search" type="text" placeholder="Sök person…" oninput="filterSbMembers()" id="sb-member-search" style="width:100%;margin-bottom:6px;border:1px solid #d1d5db;border-radius:6px;padding:7px 10px;font-size:13px">
        <div class="sb-member-list" id="sb-member-list" style="max-height:240px;overflow-y:auto">
          ${db.contacts.map(c=>`
            <label data-name="${c.name.toLowerCase()}" style="display:flex;align-items:center;gap:8px;padding:4px 6px;border-radius:4px;cursor:pointer;font-size:13px;color:#374151">
              <input type="checkbox" data-member-id="${c.id}" ${r.members.includes(c.id)?'checked':''} style="accent-color:'+ac()+'"> ${c.name}
            </label>`).join('')}
        </div>
        <div id="sb-member-add-area" style="margin-top:6px">
          <button class="pop-add" onclick="showSbMemberAdd(${r.id})" style="width:100%;border:1px solid #e5e7eb;border-radius:6px">+ Lägg till ny person</button>
        </div>
      </div>
    </div>
  </div>
  <div class="sidebar-footer">
    <button class="btn-save" id="btn-save" onclick="saveTeam(${r.id})">Spara</button>
  </div>`;
}

function filterSbMembers() {
  const q = document.getElementById('sb-member-search').value.toLowerCase();
  document.querySelectorAll('#sb-member-list label').forEach(lbl => {
    lbl.style.display = lbl.dataset.name.includes(q) ? '' : 'none';
  });
}

function showSbMemberAdd(teamId) {
  const area = document.getElementById('sb-member-add-area');
  area.innerHTML = `<div style="display:flex;gap:4px">
    <input type="text" id="sb-member-new-name" placeholder="Fullständigt namn" style="flex:1;border:1px solid #d1d5db;border-radius:5px;padding:5px 8px;font-size:12px;outline:none">
    <button class="btn" style="padding:5px 10px;font-size:12px" onclick="addSbMember(${teamId})">Spara</button>
  </div>`;
  const inp = document.getElementById('sb-member-new-name');
  inp.focus();
  inp.addEventListener('keydown', e => { if (e.key==='Enter') addSbMember(teamId); });
}

function addSbMember(teamId) {
  const inp = document.getElementById('sb-member-new-name');
  if (!inp) return;
  const name = inp.value.trim();
  if (!name) return;
  let contact = db.contacts.find(c => c.name.toLowerCase() === name.toLowerCase());
  if (!contact) {
    const maxId = db.contacts.reduce((m,c) => Math.max(m,c.id), 0) + 1;
    contact = {id:maxId, name, email:'', phone:''};
    db.contacts.push(contact);
    persist('contacts');
  }
  // Check them in and re-render
  const team = db.teams.find(t=>t.id===teamId);
  if (team && !team.members.includes(contact.id)) {
    team.members.push(contact.id);
  }
  currentTab = 'teams';
  renderSidebar(team);
  // mark dirty
  const btn = document.getElementById('btn-save');
  if (btn) btn.classList.add('dirty');
}

function saveTeam(id) {
  const t = db.teams.find(x=>x.id===id);
  if (!t) return;
  t.taskId = parseInt(document.getElementById('sb-teamtask').value);
  t.number = parseInt(document.getElementById('sb-teamnum').value);
  t.members = [...document.querySelectorAll('[data-member-id]')].filter(cb=>cb.checked).map(cb=>parseInt(cb.dataset.memberId));
  persist('teams');
  applyFilters();
  renderSidebar(t);
}
