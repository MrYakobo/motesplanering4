// ── MONSTER TABLE ─────────────────────────────────────────────────────────────
function renderMonster() {
  const tasks = db.tasks;
  document.getElementById('table-head').innerHTML = '<tr>'
    + `<th class="th-event" onclick="sortBy('date')">Date / Event<span class="si">${sortCol==='date'?(sortDir===1?'↑':'↓'):'↕'}</span></th>`
    + tasks.map(t=>`<th><div class="th-task-label">${t.name}</div><div class="th-task-type">${t.teamTask?'<i data-lucide="users" style="width:10px;height:10px;vertical-align:middle"></i> team':'<i data-lucide="user" style="width:10px;height:10px;vertical-align:middle"></i> person'}</div></th>`).join('')
    + '</tr>';

  const visibleEvents = filtered.filter(ev => (ev.expectedTasks||[]).length > 0);

  document.getElementById('table-body').innerHTML = visibleEvents.map(ev => {
    const reqTasks = ev.expectedTasks || [];
    const weekCls = isCurrentWeek(ev.date) ? ' current-week' : '';
    const cells = tasks.map(task => {
      const asgn = assignments[ev.id]?.[task.id];
      const isRequired = reqTasks.includes(task.id);
      const isMissing = isRequired && !asgn;
      const warnCls = isMissing ? ' cell-warn' : '';
      if (task.teamTask) {
        const teams = db.teams.filter(t=>t.taskId===task.id);
        const selTeam = asgn ? teams.find(t=>t.id===asgn.id) : null;
        const label = selTeam ? `Team ${selTeam.number}` : '—';
        const uid = `tpop_${ev.id}_${task.id}`;
        return `<td onclick="event.stopPropagation()"><div class="pop-cell">
          <div class="pop-label ${!selTeam?'unset':''}${warnCls}" id="lbl_${uid}" onclick="openTeamPop('${uid}',${ev.id},${task.id})">${label}</div>
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
    const missingTasks = reqTasks.filter(tid => !assignments[ev.id]?.[tid]);
    const warnCount = missingTasks.length;
    const missingNames = missingTasks.map(tid => db.tasks.find(t=>t.id===tid)?.name).filter(Boolean).join(', ');
    const warnBadge = warnCount > 0 ? ` <span class="warn-count" title="Saknas: ${missingNames}">⚠ ${warnCount}</span>` : '';
    return `<tr onclick="selectRow(${ev.id})" oncontextmenu="showCtxMenu(event,${ev.id},'events')" class="${selectedId===ev.id?'selected':''}${weekCls}">
      <td class="td-event">${ev.date} ${ev.time||''}<br><span style="font-size:12px;color:#6b7280">${esc(ev.title)}</span>${warnBadge}</td>${cells}</tr>`;
  }).join('') || `<tr><td colspan="${tasks.length+1}" style="padding:24px;text-align:center;color:#9ca3af">No results</td></tr>`;
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
  currentTab = 'teams';
  selectedId = teamId;
  renderSidebar(team);
  // switch back to events tab visually but keep sidebar showing team
  currentTab = 'events';
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
      <input type="radio" name="tpick_${uid}" value="${t.id}" ${curId===t.id?'checked':''} onchange="pickTeam('${uid}',${eid},${tid},${t.id})" style="accent-color:#4f46e5">
      <span style="flex:1">Team ${t.number}${hint}</span>
      <button class="team-gear" onclick="event.stopPropagation();openTeamSidebar(${t.id})" title="Redigera team"><i data-lucide="settings" style="width:12px;height:12px"></i></button>
    </label>`;
  }).join('');
  html += '</div>';
  pan.innerHTML = html;
  pan.classList.add('open');
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
  openPopId = uid;
  pan.querySelector('.pop-search').focus();
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
document.addEventListener('click', e => {
  if (!e.target.closest('.pop-cell')) closePops();
});
