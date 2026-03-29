// ── TEAM BOARD ────────────────────────────────────────────────────────────────
function renderTeamBoard() {
  const area = document.getElementById('team-board-area');
  const teamTasks = db.tasks.filter(t => t.teamTask);
  if (!teamBoardTaskId && teamTasks.length > 0) teamBoardTaskId = teamTasks[0].id;

  const teams = db.teams.filter(t => t.taskId === teamBoardTaskId).sort((a,b) => a.number - b.number);
  const allInTeams = new Set(teams.flatMap(t => t.members));

  const taskLinks = teamTasks.map(t =>
    `<button onclick="teamBoardTaskId=${t.id};renderTeamBoard()" class="tb-task-link${t.id===teamBoardTaskId?' active':''}">${t.name}</button>`
  ).join('') + `<button onclick="onTeamTaskSelect('__new__')" class="tb-task-link tb-task-add"><i data-lucide="plus" style="width:12px;height:12px"></i> Ny teamuppgift</button>`;

  let html = `<div class="team-board-toolbar">
    ${taskLinks}
    <span style="flex:1"></span>
    <span style="font-size:13px;color:#6b7280">${teams.length} team · ${allInTeams.size} personer</span>
  </div>
  <div class="team-board" id="team-board">`;

  // Pool column
  html += `<div class="team-col pool-col">
    <div class="team-col-header">Alla personer <span class="team-col-count">${db.contacts.length}</span></div>
    <input class="pool-search" type="text" placeholder="Sök…" oninput="filterPool(this.value)">
    <div class="team-col-body" id="pool-body" data-team-id="pool">`;
  db.contacts.sort((a,b) => a.name.localeCompare(b.name)).forEach(c => {
    const inTeam = allInTeams.has(c.id);
    html += `<div class="pool-card${inTeam?' in-team':''}" draggable="true" data-contact-id="${c.id}" data-name="${c.name.toLowerCase()}" onclick="openContactModal(${c.id})">${c.name}</div>`;
  });
  html += `</div>
    <button onclick="newContactFromTeams()" style="border:none;border-top:1px solid #e5e7eb;padding:8px 12px;font-size:12px;color:'+ac()+';cursor:pointer;text-align:left;background:none;width:100%;flex-shrink:0;display:flex;align-items:center;gap:4px"><i data-lucide="plus-circle" style="width:12px;height:12px"></i> Ny person</button>
  </div>`;
  teams.forEach(team => {
    html += `<div class="team-col">
      <div class="team-col-header">
        <span>Team ${team.number}</span>
        <button class="card-remove" onclick="if(confirm('Ta bort Team ${team.number}?'))deleteTeamCol(${team.id})" data-tip="Ta bort team"><i data-lucide="x" style="width:14px;height:14px"></i></button>
      </div>
      <div class="team-col-body" data-team-id="${team.id}">`;
    team.members.forEach(mid => {
      const c = db.contacts.find(x => x.id === mid);
      if (!c) return;
      html += `<div class="team-card" draggable="true" data-contact-id="${c.id}" onclick="openContactModal(${c.id})">
        <span>${c.name}</span>
        <button class="card-remove" onclick="event.stopPropagation();removeFromTeam(${team.id},${c.id})"><i data-lucide="x" style="width:12px;height:12px"></i></button>
      </div>`;
    });
    html += `</div></div>`;
  });

  // "+ Nytt team" column
  const nextNum = teams.length > 0 ? Math.max(...teams.map(t=>t.number)) + 1 : 1;
  const taskName = db.tasks.find(t=>t.id===teamBoardTaskId)?.name || 'team';
  html += `<div class="team-col" style="min-width:120px;flex:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:13px" onclick="createTeamCol(${teamBoardTaskId},${nextNum})">
    <div style="text-align:center"><i data-lucide="plus-circle" style="width:24px;height:24px;margin-bottom:4px"></i><br>Nytt ${taskName}</div>
  </div>`;

  html += '</div>';
  area.innerHTML = html;
  area.style.display = '';
  lucide.createIcons({nameAttr:'data-lucide', attrs:{class:'lucide-icon'}});
  initTeamBoardDrag();
}

function filterPool(q) {
  q = q.toLowerCase();
  document.querySelectorAll('#pool-body .pool-card').forEach(el => {
    el.style.display = el.dataset.name.includes(q) ? '' : 'none';
  });
}

function onTeamTaskSelect(val) {
  if (val === '__new__') {
    const name = prompt('Namn på ny teamuppgift:');
    if (!name) { return; }
    const maxId = db.tasks.reduce((m,t) => Math.max(m,t.id), 0) + 1;
    db.tasks.push({id:maxId, name, teamTask:true, mailbot:false, phrase:''});
    persist('tasks');
    teamBoardTaskId = maxId;
    renderTeamBoard();
  } else {
    teamBoardTaskId = parseInt(val);
    renderTeamBoard();
  }
}

function createTeamCol(taskId, num) {
  const maxId = db.teams.reduce((m,t) => Math.max(m,t.id), 0) + 1;
  db.teams.push({id:maxId, taskId, number:num, members:[]});
  persist('teams');
  renderTeamBoard();
}

function deleteTeamCol(teamId) {
  db.teams = db.teams.filter(t => t.id !== teamId);
  persist('teams');
  renderTeamBoard();
}

function removeFromTeam(teamId, contactId) {
  const team = db.teams.find(t => t.id === teamId);
  if (!team) return;
  // Member mode: use scoped endpoint for own membership
  if (isMemberMode && contactId === memberContactId) {
    fetch('/api/me/leave-team', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ teamId }) })
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(data => { team.members = team.members.filter(id => id !== contactId); if (data.version) dbVersion = data.version; renderTeamBoard(); })
      .catch(err => showToast('Kunde inte spara: ' + err.message, 'error'));
    return;
  }
  team.members = team.members.filter(id => id !== contactId);
  persist('teams');
  renderTeamBoard();
}

function addToTeam(teamId, contactId) {
  const team = db.teams.find(t => t.id === teamId);
  if (!team) return;
  if (!team.members.includes(contactId)) team.members.push(contactId);
  // Member mode: use scoped endpoint for own membership
  if (isMemberMode && contactId === memberContactId) {
    fetch('/api/me/join-team', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ teamId }) })
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(data => { if (data.version) dbVersion = data.version; renderTeamBoard(); })
      .catch(err => showToast('Kunde inte spara: ' + err.message, 'error'));
    return;
  }
  persist('teams');
}

function moveContactBetweenTeams(contactId, fromTeamId, toTeamId) {
  if (fromTeamId === toTeamId) return;
  // Remove from old team
  if (fromTeamId !== 'pool') {
    const from = db.teams.find(t => t.id === parseInt(fromTeamId));
    if (from) from.members = from.members.filter(id => id !== contactId);
  }
  // Add to new team
  if (toTeamId !== 'pool') {
    const to = db.teams.find(t => t.id === parseInt(toTeamId));
    if (to && !to.members.includes(contactId)) to.members.push(contactId);
  }
  persist('teams');
  renderTeamBoard();
}

function initTeamBoardDrag() {
  const board = document.getElementById('team-board');
  if (!board) return;
  let dragContactId = null;
  let dragFromTeam = null;

  board.addEventListener('dragstart', e => {
    const card = e.target.closest('[data-contact-id]');
    if (!card) return;
    dragContactId = parseInt(card.dataset.contactId);
    const col = card.closest('[data-team-id]');
    dragFromTeam = col ? col.dataset.teamId : null;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragContactId);
  });

  board.addEventListener('dragend', e => {
    const card = e.target.closest('[data-contact-id]');
    if (card) card.classList.remove('dragging');
    board.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    dragContactId = null;
    dragFromTeam = null;
  });

  board.addEventListener('dragover', e => {
    const body = e.target.closest('[data-team-id]');
    if (!body) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    board.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    body.classList.add('drag-over');
  });

  board.addEventListener('dragleave', e => {
    const body = e.target.closest('[data-team-id]');
    if (body && !body.contains(e.relatedTarget)) body.classList.remove('drag-over');
  });

  board.addEventListener('drop', e => {
    e.preventDefault();
    const body = e.target.closest('[data-team-id]');
    if (!body || dragContactId === null) return;
    body.classList.remove('drag-over');
    const toTeamId = body.dataset.teamId;
    moveContactBetweenTeams(dragContactId, dragFromTeam, toTeamId);
    dragContactId = null;
    dragFromTeam = null;
  });
}

function newContactFromTeams() {
  const maxId = (db.contacts || []).reduce((m, c) => Math.max(m, c.id), 0) + 1;
  const c = { id: maxId, name: '', email: '', phone: '', _isNew: true };
  const modal = document.getElementById('detail-modal');
  document.getElementById('detail-modal-content').innerHTML = sidebarContact(c);
  modal.classList.add('open');
  initSidebarTracking();
  lucide.createIcons({nameAttr:'data-lucide', attrs:{class:'lucide-icon'}});
  document.getElementById('sb-cname')?.focus();
}
