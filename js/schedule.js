// ── MONSTER TABLE ─────────────────────────────────────────────────────────────
function renderMonster() {
  const tasks = db.tasks;
  document.getElementById('table-head').innerHTML = '<tr>'
    + `<th class="th-event" onclick="sortBy('date')">Datum / Händelse<span class="si">${sortCol==='date'?(sortDir===1?'↑':'↓'):'↕'}</span></th>`
    + tasks.map(t=>{
      const autoBtn = t.teamTask
        ? `<button onclick="event.stopPropagation();autoDistributeTeams(${t.id})" style="background:'+acLight()+';border:1px solid '+acMid()+';color:'+ac()+';cursor:pointer;font-size:10px;font-weight:600;display:inline-flex;align-items:center;gap:3px;padding:2px 6px;border-radius:4px;margin-left:4px" data-tip="Fördela team jämnt på otilldelade händelser"><i data-lucide="shuffle" style="width:11px;height:11px"></i> Fördela</button>`
        : `<button onclick="event.stopPropagation();autoDistributePersons(${t.id})" style="background:'+acLight()+';border:1px solid '+acMid()+';color:'+ac()+';cursor:pointer;font-size:10px;font-weight:600;display:inline-flex;align-items:center;gap:3px;padding:2px 6px;border-radius:4px;margin-left:4px" data-tip="Fördela personer jämnt på otilldelade händelser"><i data-lucide="shuffle" style="width:11px;height:11px"></i> Fördela</button>`;
      return `<th><div class="th-task-label">${t.name}${autoBtn}</div><div class="th-task-type">${t.teamTask?'<i data-lucide="users" style="width:10px;height:10px;vertical-align:middle"></i> team':'<i data-lucide="user" style="width:10px;height:10px;vertical-align:middle"></i> person'}</div></th>`;
    }).join('')
    + '</tr>';

  const visibleEvents = filtered.filter(ev => (ev.expectedTasks||[]).length > 0);

  document.getElementById('table-body').innerHTML = visibleEvents.map(ev => {
    const reqTasks = ev.expectedTasks || [];
    const isPast = ev.date < getTodayStr();
    const weekCls = isCurrentWeek(ev.date) ? ' current-week' : '';
    const opacityStyle = isPast ? 'opacity:0.5;' : '';
    const cells = tasks.map(task => {
      const asgn = assignments[ev.id]?.[task.id];
      const isRequired = reqTasks.includes(task.id);
      const isMissing = isRequired && !asgn && !isPast;
      const warnCls = isMissing ? ' cell-warn' : '';
      if (task.teamTask) {
        const teams = db.teams.filter(t=>t.taskId===task.id);
        const selTeam = asgn ? teams.find(t=>t.id===asgn.id) : null;
        const label = selTeam ? `Team ${selTeam.number}` : '—';
        const membersTip = selTeam ? (selTeam.members||[]).map(mid=>db.contacts.find(c=>c.id===mid)?.name).filter(Boolean).join(', ') : '';
        const uid = `tpop_${ev.id}_${task.id}`;
        return `<td onclick="event.stopPropagation()"><div class="pop-cell">
          <div class="pop-label ${!selTeam?'unset':''}${warnCls}" id="lbl_${uid}" onclick="openTeamPop('${uid}',${ev.id},${task.id})"${membersTip?` data-tip="${escAttr(membersTip)}"`:''} >${label}</div>
          <div class="pop-panel" id="pan_${uid}"></div>
        </div></td>`;
      } else {
        const ids = asgn?.ids || [];
        const label = ids.length===0 ? '—' : ids.map(id=>db.contacts.find(c=>c.id===id)?.name.split(' ')[0]).join(', ');
        const uid = `pop_${ev.id}_${task.id}`;
        return `<td onclick="event.stopPropagation()"><div class="pop-cell">
          <div class="pop-label ${ids.length===0?'unset':''}${warnCls}" id="lbl_${uid}" onclick="openPop('${uid}',${ev.id},${task.id})">${label}</div>
          <div class="pop-panel" id="pan_${uid}"></div>
        </div></td>`;
      }
    }).join('');
    const missingTasks = isPast ? [] : reqTasks.filter(tid => !assignments[ev.id]?.[tid]);
    const warnCount = missingTasks.length;
    const missingNames = missingTasks.map(tid => db.tasks.find(t=>t.id===tid)?.name).filter(Boolean).join(', ');
    const warnBadge = warnCount > 0 ? ` <span class="warn-count" data-tip="Saknas: ${missingNames}">⚠ ${warnCount}</span>` : '';
    return `<tr onclick="selectRow(${ev.id})" oncontextmenu="showCtxMenu(event,${ev.id},'events')" class="${selectedId===ev.id?'selected':''}${weekCls}" style="${opacityStyle}">
      <td class="td-event">${ev.date} ${ev.time||''}<br><span style="font-size:12px;color:#6b7280">${esc(ev.title)}</span>${warnBadge}</td>${cells}</tr>`;
  }).join('') || `<tr><td colspan="${tasks.length+1}" style="padding:24px;text-align:center;color:#9ca3af">Inga resultat</td></tr>`;
  lucide.createIcons({nameAttr:'data-lucide', attrs:{class:'lucide-icon'}});
  // Scroll to current week row in schedule view
  if (!listScrolled) {
    listScrolled = true;
    requestAnimationFrame(() => {
      const row = document.querySelector('#table-body tr.current-week');
      if (row) row.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
  }
}

function setTeamAssign(eid, tid, val) {
  if (!val) delete assignments[eid][tid];
  else assignments[eid][tid] = {type:'team', id:parseInt(val)};
  updateVolCount(eid);
}

function openTeamSidebar(teamId) {
  const team = db.teams.find(t=>t.id===teamId);
  if (!team) return;
  const modal = document.getElementById('detail-modal');
  document.getElementById('detail-modal-content').innerHTML = sidebarTeam(team);
  modal.classList.add('open');
  initSidebarTracking();
  lucide.createIcons({nameAttr:'data-lucide', attrs:{class:'lucide-icon'}});
}

function togglePerson(eid, tid, cid, checked) {
  if (!assignments[eid][tid]) assignments[eid][tid] = {type:'contact', ids:[]};
  const ids = assignments[eid][tid].ids;
  if (checked && !ids.includes(cid)) ids.push(cid);
  if (!checked) assignments[eid][tid].ids = ids.filter(i=>i!==cid);
  if (assignments[eid][tid].ids.length===0) delete assignments[eid][tid];
  // update label
  const cur = assignments[eid][tid]?.ids || [];
  const label = cur.length===0 ? '—' : cur.map(id=>db.contacts.find(c=>c.id===id)?.name.split(' ')[0]).join(', ');
  const lbl = document.getElementById(`lbl_pop_${eid}_${tid}`);
  if (lbl) { lbl.textContent = label; lbl.classList.toggle('unset', cur.length===0); }
  updateVolCount(eid);
}

function updateVolCount(eid) {
  db.events.find(e=>e.id===eid).volunteers = Object.keys(assignments[eid]||{}).length;
  persistAssignments();
}

function persistAssignments() {
  db.schedules = assignments;
  persist('schedules');
}

let autoDistStartIdx = 0;

function autoDistributeTeams(taskId) {
  autoDistStartIdx = 0;
  showAutoDistPreview(taskId);
}

function showAutoDistPreview(taskId) {
  const todayStr = getTodayStr();
  const task = db.tasks.find(t => t.id === taskId);
  const teams = db.teams.filter(t => t.taskId === taskId).sort((a,b) => a.number - b.number);
  if (teams.length === 0) { showToast('Inga team för denna uppgift', 'warn'); return; }

  const candidates = filtered
    .filter(ev => ev.date >= todayStr && (ev.expectedTasks||[]).includes(taskId) && !assignments[ev.id]?.[taskId])
    .sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time));

  if (candidates.length === 0) { showToast('Inga otilldelade händelser att fördela', 'warn'); return; }

  const plan = candidates.map((ev, i) => ({ ev, team: teams[(i + autoDistStartIdx) % teams.length] }));
  const listHtml = plan.map(p => {
    const members = (p.team.members || []).map(mid => db.contacts.find(c=>c.id===mid)?.name).filter(Boolean).join(', ');
    return `<div style="display:flex;gap:8px;padding:4px 0;border-bottom:1px solid #f0f0f0;font-size:12px;align-items:baseline">
      <span style="min-width:80px;color:#6b7280">${p.ev.date}</span>
      <span style="flex:1">${esc(p.ev.title)}</span>
      <span style="color:'+ac()+';font-weight:600;white-space:nowrap"${members ? ` data-tip="${escAttr(members)}"` : ''}>Team ${p.team.number}</span>
    </div>`;
  }).join('');

  const teamOptions = teams.map((t, i) =>
    `<option value="${i}" ${i === autoDistStartIdx ? 'selected' : ''}>Team ${t.number}</option>`
  ).join('');

  const modal = document.getElementById('detail-modal');
  document.getElementById('detail-modal-content').innerHTML = `
    <div class="sidebar-header">
      <h3>Fördela ${esc(task?.name || '')}</h3>
      <button class="sidebar-close" onclick="closeDetailModal()">×</button>
    </div>
    <div class="sidebar-body" style="overflow-y:auto">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <span style="font-size:13px;color:#374151">Börja med:</span>
        <select onchange="autoDistStartIdx=parseInt(this.value);showAutoDistPreview(${taskId})" style="border:1px solid #d1d5db;border-radius:6px;padding:5px 8px;font-size:13px">${teamOptions}</select>
        <span style="font-size:12px;color:#9ca3af">${candidates.length} händelser · ${teams.length} team</span>
      </div>
      <div style="max-height:400px;overflow-y:auto;border:1px solid #e5e7eb;border-radius:6px;padding:8px">${listHtml}</div>
    </div>
    <div class="sidebar-footer">
      <button class="btn-ghost" onclick="closeDetailModal()">Avbryt</button>
      <button class="btn" onclick="executeAutoDistribute(${taskId});closeDetailModal()">Tilldela ${candidates.length} händelser</button>
    </div>`;
  modal.classList.add('open');
  lucide.createIcons({nameAttr:'data-lucide', attrs:{class:'lucide-icon'}});
}

function executeAutoDistribute(taskId) {
  const todayStr = getTodayStr();
  const teams = db.teams.filter(t => t.taskId === taskId).sort((a,b) => a.number - b.number);
  const candidates = filtered
    .filter(ev => ev.date >= todayStr && (ev.expectedTasks||[]).includes(taskId) && !assignments[ev.id]?.[taskId])
    .sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time));

  candidates.forEach((ev, i) => {
    const team = teams[(i + autoDistStartIdx) % teams.length];
    if (!assignments[ev.id]) assignments[ev.id] = {};
    assignments[ev.id][taskId] = { type: 'team', id: team.id };
  });

  persistAssignments();
  renderMonster();
  showToast(`${candidates.length} händelser tilldelade`, 'ok');
}

// ── PERSON AUTO-DISTRIBUTE ────────────────────────────────────────────────────
let personDistPool = [];
let personDistStartIdx = 0;

function autoDistributePersons(taskId) {
  const todayStr = getTodayStr();
  const task = db.tasks.find(t => t.id === taskId);
  if (!task) return;

  const candidates = filtered
    .filter(ev => ev.date >= todayStr && (ev.expectedTasks||[]).includes(taskId) && !assignments[ev.id]?.[taskId])
    .sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time));

  if (candidates.length === 0) { showToast('Inga otilldelade händelser att fördela', 'warn'); return; }

  // Find unique persons assigned to this task in the last 6 months
  const sixMonthsAgo = new Date(getToday());
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const cutoff = localDate(sixMonthsAgo);
  const recentPersonIds = new Set();
  (db.events || []).forEach(ev => {
    if (ev.date < cutoff || ev.date >= todayStr) return;
    const asgn = assignments[ev.id]?.[taskId];
    if (asgn?.type === 'contact') (asgn.ids || []).forEach(id => recentPersonIds.add(id));
  });

  // Build pool: recent persons, all checked by default
  personDistPool = [...recentPersonIds].map(cid => {
    const c = db.contacts.find(x => x.id === cid);
    return c ? { id: c.id, name: c.name, checked: true } : null;
  }).filter(Boolean).sort((a,b) => a.name.localeCompare(b.name));

  if (personDistPool.length === 0) {
    // Fallback: offer all contacts
    personDistPool = db.contacts.map(c => ({ id: c.id, name: c.name, checked: false })).sort((a,b) => a.name.localeCompare(b.name));
  }

  personDistStartIdx = 0;
  showPersonDistPreview(taskId);
}

function showPersonDistPreview(taskId) {
  const todayStr = getTodayStr();
  const task = db.tasks.find(t => t.id === taskId);
  const candidates = filtered
    .filter(ev => ev.date >= todayStr && (ev.expectedTasks||[]).includes(taskId) && !assignments[ev.id]?.[taskId])
    .sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time));

  const selected = personDistPool.filter(p => p.checked);

  // Build preview plan
  const plan = selected.length > 0
    ? candidates.map((ev, i) => ({ ev, person: selected[(i + personDistStartIdx) % selected.length] }))
    : [];

  const listHtml = plan.map(p =>
    `<div style="display:flex;gap:8px;padding:4px 0;border-bottom:1px solid #f0f0f0;font-size:12px">
      <span style="min-width:80px;color:#6b7280">${p.ev.date}</span>
      <span style="flex:1">${esc(p.ev.title)}</span>
      <span style="color:'+ac()+';font-weight:600;white-space:nowrap">${esc(p.person.name)}</span>
    </div>`
  ).join('');

  const personChecks = personDistPool.map((p, i) =>
    `<label style="display:flex;align-items:center;gap:6px;padding:3px 4px;font-size:12px;cursor:pointer;border-radius:4px" onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background=''">
      <input type="checkbox" ${p.checked?'checked':''} onchange="personDistPool[${i}].checked=this.checked;showPersonDistPreview(${taskId})" style="accent-color:'+ac()+'">
      ${esc(p.name)}
    </label>`
  ).join('');

  const startOptions = selected.map((p, i) =>
    `<option value="${i}" ${i === personDistStartIdx ? 'selected' : ''}>${esc(p.name)}</option>`
  ).join('');

  const modal = document.getElementById('detail-modal');
  document.getElementById('detail-modal-content').innerHTML = `
    <div class="sidebar-header">
      <h3>Fördela ${esc(task?.name || '')}</h3>
      <button class="sidebar-close" onclick="closeDetailModal()">×</button>
    </div>
    <div class="sidebar-body" style="overflow-y:auto">
      <div style="margin-bottom:12px">
        <div style="font-size:12px;font-weight:600;color:#6b7280;margin-bottom:6px">Välj personer att rotera (senaste 6 mån):</div>
        <div style="max-height:180px;overflow-y:auto;border:1px solid #e5e7eb;border-radius:6px;padding:6px">${personChecks}</div>
      </div>
      ${selected.length > 0 ? `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <span style="font-size:13px;color:#374151">Börja med:</span>
        <select onchange="personDistStartIdx=parseInt(this.value);showPersonDistPreview(${taskId})" style="border:1px solid #d1d5db;border-radius:6px;padding:5px 8px;font-size:13px">${startOptions}</select>
        <span style="font-size:12px;color:#9ca3af">${candidates.length} händelser · ${selected.length} personer</span>
      </div>
      <div style="max-height:400px;overflow-y:auto;border:1px solid #e5e7eb;border-radius:6px;padding:8px">${listHtml}</div>
      ` : '<p style="font-size:13px;color:#9ca3af;margin-top:8px">Välj minst en person för att se fördelning</p>'}
    </div>
    <div class="sidebar-footer">
      <button class="btn-ghost" onclick="closeDetailModal()">Avbryt</button>
      ${selected.length > 0 ? `<button class="btn" onclick="executePersonDistribute(${taskId});closeDetailModal()">Tilldela ${candidates.length} händelser</button>` : ''}
    </div>`;
  modal.classList.add('open');
  lucide.createIcons({nameAttr:'data-lucide', attrs:{class:'lucide-icon'}});
}

function executePersonDistribute(taskId) {
  const todayStr = getTodayStr();
  const selected = personDistPool.filter(p => p.checked);
  if (selected.length === 0) return;

  const candidates = filtered
    .filter(ev => ev.date >= todayStr && (ev.expectedTasks||[]).includes(taskId) && !assignments[ev.id]?.[taskId])
    .sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time));

  candidates.forEach((ev, i) => {
    const person = selected[(i + personDistStartIdx) % selected.length];
    if (!assignments[ev.id]) assignments[ev.id] = {};
    assignments[ev.id][taskId] = { type: 'contact', ids: [person.id] };
  });

  persistAssignments();
  renderMonster();
  showToast(`${candidates.length} händelser tilldelade`, 'ok');
}

let openPopId = null;
function openTeamPop(uid, eid, tid) {
  const pan = document.getElementById('pan_'+uid);
  if (openPopId === uid) { pan.classList.remove('open'); openPopId = null; return; }
  closePops();
  const task = db.tasks.find(t=>t.id===tid);
  const teams = db.teams.filter(t=>t.taskId===tid);
  const curId = assignments[eid]?.[tid]?.id || null;
  let html = `<div class="pop-list">`;
  html += `<label data-name="—" style="color:#9ca3af"><input type="radio" name="tpick_${uid}" value="" ${!curId?'checked':''} onchange="pickTeam('${uid}',${eid},${tid},0)"> —</label>`;
  html += teams.map(t => {
    const members = (t.members||[]).map(id=>db.contacts.find(c=>c.id===id)?.name).filter(Boolean).join(', ');
    const hint = members ? `<span style="font-size:11px;color:#9ca3af;margin-left:4px">${members}</span>` : '';
    return `<label data-name="team ${t.number}" style="display:flex;align-items:center;gap:6px">
      <input type="radio" name="tpick_${uid}" value="${t.id}" ${curId===t.id?'checked':''} onchange="pickTeam('${uid}',${eid},${tid},${t.id})" style="accent-color:'+ac()+'">
      <span style="flex:1">Team ${t.number}${hint}</span>
      <button class="team-gear" onclick="event.stopPropagation();openTeamSidebar(${t.id})" data-tip="Redigera team"><i data-lucide="settings" style="width:12px;height:12px"></i></button>
    </label>`;
  }).join('');
  html += '</div>';
  pan.innerHTML = html;
  pan.classList.add('open');
  repositionPop(pan);
  openPopId = uid;
  lucide.createIcons({nameAttr:'data-lucide', attrs:{class:'lucide-icon'}});
}

function pickTeam(uid, eid, tid, teamId) {
  if (!assignments[eid]) assignments[eid] = {};
  if (!teamId) { delete assignments[eid][tid]; }
  else { assignments[eid][tid] = {type:'team', id:teamId}; }
  const lbl = document.getElementById('lbl_'+uid);
  if (lbl) {
    const t = teamId ? db.teams.find(t=>t.id===teamId) : null;
    lbl.textContent = t ? `Team ${t.number}` : '—';
    lbl.classList.toggle('unset', !teamId);
  }
  updateVolCount(eid);
  closePops();
}

function openPop(uid, eid, tid) {
  const pan = document.getElementById('pan_'+uid);
  if (openPopId === uid) { pan.classList.remove('open'); openPopId = null; return; }
  closePops();
  // build contents dynamically
  const curIds = assignments[eid]?.[tid]?.ids || [];
  let html = `<input class="pop-search" type="text" placeholder="Sök person…" oninput="filterPopList('${uid}')">`;
  html += `<div class="pop-list" id="plist_${uid}">`;
  html += db.contacts.map(c => {
    const checked = curIds.includes(c.id) ? 'checked' : '';
    return `<label data-name="${c.name.toLowerCase()}"><input type="checkbox" ${checked} onchange="togglePerson(${eid},${tid},${c.id},this.checked)"> ${c.name}</label>`;
  }).join('');
  html += '</div>';
  html += `<div class="pop-add-area" id="padd_${uid}"><button class="pop-add" onclick="event.stopPropagation();showAddPersonInput('${uid}',${eid},${tid})">+ Lägg till ny person</button></div>`;
  pan.innerHTML = html;
  pan.classList.add('open');
  repositionPop(pan);
  openPopId = uid;
  pan.querySelector('.pop-search').focus();
  // Scroll to first checked person
  requestAnimationFrame(() => {
    const checked = pan.querySelector('.pop-list input[type=checkbox]:checked');
    if (checked) checked.closest('label').scrollIntoView({ block: 'nearest' });
  });
}
function filterPopList(uid) {
  const pan = document.getElementById('pan_'+uid);
  if (!pan) return;
  const q = pan.querySelector('.pop-search').value.toLowerCase();
  pan.querySelectorAll('.pop-list label').forEach(lbl => {
    lbl.style.display = lbl.dataset.name.includes(q) ? '' : 'none';
  });
}
function showAddPersonInput(uid, eid, tid) {
  const area = document.getElementById('padd_'+uid);
  if (!area) return;
  area.innerHTML = `<div style="display:flex;gap:4px;padding:6px 8px;border-top:1px solid #e5e7eb">
    <input type="text" id="pinp_${uid}" placeholder="Fullständigt namn" style="flex:1;border:1px solid #d1d5db;border-radius:5px;padding:4px 8px;font-size:12px;outline:none">
    <button class="btn" style="padding:4px 10px;font-size:12px" onclick="event.stopPropagation();addContactInline('${uid}',${eid},${tid})">Spara</button>
  </div>`;
  const inp = document.getElementById('pinp_'+uid);
  inp.focus();
  inp.addEventListener('keydown', e => { if (e.key==='Enter') { e.stopPropagation(); addContactInline(uid,eid,tid); } });
}
function addContactInline(uid, eid, tid) {
  const inp = document.getElementById('pinp_'+uid);
  if (!inp) return;
  const q = inp.value.trim();
  if (!q) return;
  const existing = db.contacts.find(c => c.name.toLowerCase() === q.toLowerCase());
  if (existing) {
    if (!assignments[eid]) assignments[eid] = {};
    if (!assignments[eid][tid]) assignments[eid][tid] = {type:'contact', ids:[]};
    if (!assignments[eid][tid].ids.includes(existing.id)) assignments[eid][tid].ids.push(existing.id);
  } else {
    const maxId = db.contacts.reduce((m,c) => Math.max(m,c.id), 0) + 1;
    const newC = {id:maxId, name:q, email:'', phone:''};
    db.contacts.push(newC);
    persist('contacts');
    if (!assignments[eid]) assignments[eid] = {};
    if (!assignments[eid][tid]) assignments[eid][tid] = {type:'contact', ids:[]};
    assignments[eid][tid].ids.push(newC.id);
  }
  const cur = assignments[eid][tid]?.ids || [];
  const label = cur.length===0 ? '—' : cur.map(id=>db.contacts.find(c=>c.id===id)?.name.split(' ')[0]).join(', ');
  const lbl = document.getElementById('lbl_'+uid);
  if (lbl) { lbl.textContent = label; lbl.classList.toggle('unset', cur.length===0); }
  updateVolCount(eid);
  openPopId = null;
  openPop(uid, eid, tid);
}
function closePops() {
  document.querySelectorAll('.pop-panel.open').forEach(p=>p.classList.remove('open'));
  openPopId = null;
}

function repositionPop(pan) {
  pan.style.left = '0';
  pan.style.right = '';
  pan.style.maxHeight = '';
  requestAnimationFrame(() => {
    const rect = pan.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8) {
      pan.style.left = 'auto';
      pan.style.right = '0';
    }
    const spaceBelow = window.innerHeight - rect.top - 8;
    if (spaceBelow < rect.height) {
      pan.style.maxHeight = Math.max(160, spaceBelow) + 'px';
    }
  });
}
document.addEventListener('click', e => {
  if (!e.target.closest('.pop-cell')) closePops();
});
