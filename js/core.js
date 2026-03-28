function sortBy(key) {
  if (sortCol===key) sortDir*=-1; else { sortCol=key; sortDir=1; }
  applyFilters();
}

// ── OUTPUTS DROPDOWN ──────────────────────────────────────────────────────────
const outputTabs = ['slides','export','mailbot','namnskyltar','sunday'];

function selectRow(id) {
  selectedId = id;
  warningConfigOpen = false;
  if (currentTab === 'events' && currentView === 'monster') {
    openDetailModal(id);
    renderTable();
  } else {
    renderTable();
    renderSidebar(db[currentTab].find(r=>r.id===id));
    requestAnimationFrame(() => {
      const row = document.querySelector('#table-body tr.selected');
      if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }
  updateHash();
}

function openDetailModal(id) {
  const ev = db.events.find(e=>e.id===id);
  if (!ev) return;
  const modal = document.getElementById('detail-modal');
  document.getElementById('detail-modal-content').innerHTML = sidebarEvent(ev);
  modal.classList.add('open');
  initSidebarTracking();
  lucide.createIcons({nameAttr:'data-lucide', attrs:{class:'lucide-icon'}});
}

function closeDetailModal() {
  document.getElementById('detail-modal').classList.remove('open');
  selectedId = null;
  renderTable();
  updateHash();
}

// ── CONTEXT MENU ──────────────────────────────────────────────────────────────
function showCtxMenu(e, id, tab) {
  e.preventDefault();
  e.stopPropagation();
  tab = tab || currentTab;
  const menu = document.getElementById('ctx-menu');
  let items = `<button onclick="selectRow(${id});hideCtxMenu()"><i data-lucide="pencil" style="width:14px;height:14px"></i> Redigera</button>`;
  if (tab === 'events') {
    items += `<button onclick="duplicateEvent(${id});hideCtxMenu()"><i data-lucide="copy" style="width:14px;height:14px"></i> Duplicera</button>`;
  }
  items += `<button class="ctx-danger" onclick="deleteRecord(${id},'${tab}');hideCtxMenu()"><i data-lucide="trash-2" style="width:14px;height:14px"></i> Ta bort</button>`;
  menu.innerHTML = items;
  menu.style.display = 'block';
  menu.style.left = Math.min(e.clientX, window.innerWidth - 180) + 'px';
  menu.style.top = Math.min(e.clientY, window.innerHeight - 120) + 'px';
  lucide.createIcons({nameAttr:'data-lucide', attrs:{class:'lucide-icon'}});
}

function deleteRecord(id, tab) {
  if (tab === 'events') { deleteEvent(id); return; }
  if (tab === 'tasks') { deleteTaskWithPreview(id); return; }
  if (!db[tab]) return;
  db[tab] = db[tab].filter(r=>r.id!==id);
  if (selectedId === id) { selectedId = null; renderSidebar(null); }
  persist(tab);
  applyFilters();
}

function deleteTaskWithPreview(taskId) {
  const task = db.tasks.find(t => t.id === taskId);
  if (!task) return;

  // Find affected events (expected or assigned)
  const affectedEvents = (db.events || []).filter(ev => {
    const hasExpected = (ev.expectedTasks || []).includes(taskId);
    const hasAssigned = !!assignments[ev.id]?.[taskId];
    return hasExpected || hasAssigned;
  });

  // Find affected teams
  const affectedTeams = (db.teams || []).filter(t => t.taskId === taskId);
  const affectedPersons = new Set();
  affectedTeams.forEach(t => t.members.forEach(m => affectedPersons.add(m)));

  // Also count people assigned directly
  affectedEvents.forEach(ev => {
    const asgn = assignments[ev.id]?.[taskId];
    if (asgn?.type === 'contact') (asgn.ids || []).forEach(id => affectedPersons.add(id));
    if (asgn?.type === 'team') {
      const team = (db.teams || []).find(t => t.id === asgn.id);
      if (team) team.members.forEach(m => affectedPersons.add(m));
    }
  });

  let listHtml = '';
  if (affectedEvents.length > 0) {
    listHtml += `<div style="margin-bottom:12px"><div style="font-size:12px;font-weight:600;color:#6b7280;margin-bottom:4px">${affectedEvents.length} händelser</div>`;
    listHtml += affectedEvents.slice(0, 20).map(ev =>
      `<div style="font-size:12px;padding:2px 0;color:#374151">${ev.date} — ${esc(ev.title)}</div>`
    ).join('');
    if (affectedEvents.length > 20) listHtml += `<div style="font-size:11px;color:#9ca3af">+${affectedEvents.length - 20} till</div>`;
    listHtml += '</div>';
  }
  if (affectedTeams.length > 0) {
    listHtml += `<div style="margin-bottom:12px"><div style="font-size:12px;font-weight:600;color:#6b7280;margin-bottom:4px">${affectedTeams.length} team tas bort</div>`;
    listHtml += affectedTeams.map(t =>
      `<div style="font-size:12px;padding:2px 0;color:#374151">Team ${t.number} (${t.members.length} medlemmar)</div>`
    ).join('');
    listHtml += '</div>';
  }

  const summary = affectedEvents.length === 0 && affectedTeams.length === 0
    ? '<p style="font-size:13px;color:#374151">Denna uppgift används inte av några händelser eller team.</p>'
    : `<p style="font-size:13px;color:#374151;margin-bottom:12px">Detta påverkar <strong>${affectedEvents.length}</strong> händelser och <strong>${affectedPersons.size}</strong> personer:</p>
       <div style="max-height:300px;overflow-y:auto;border:1px solid #e5e7eb;border-radius:6px;padding:8px">${listHtml}</div>`;

  const modal = document.getElementById('detail-modal');
  document.getElementById('detail-modal-content').innerHTML = `
    <div class="sidebar-header">
      <h3>Ta bort "${esc(task.name)}"?</h3>
      <button class="sidebar-close" onclick="closeDetailModal()">×</button>
    </div>
    <div class="sidebar-body">${summary}</div>
    <div class="sidebar-footer">
      <button class="btn-ghost" onclick="closeDetailModal()">Avbryt</button>
      <button class="btn-danger" onclick="executeDeleteTask(${taskId});closeDetailModal()">Ta bort uppgift</button>
    </div>`;
  modal.classList.add('open');
}

function executeDeleteTask(taskId) {
  // Remove from expectedTasks on all events
  (db.events || []).forEach(ev => {
    if (ev.expectedTasks) ev.expectedTasks = ev.expectedTasks.filter(id => id !== taskId);
  });
  // Remove assignments
  Object.keys(assignments).forEach(eid => { delete assignments[eid][taskId]; });
  // Remove teams for this task
  db.teams = (db.teams || []).filter(t => t.taskId !== taskId);
  // Remove the task itself
  db.tasks = db.tasks.filter(t => t.id !== taskId);
  if (selectedId === taskId) { selectedId = null; renderSidebar(null); }
  persistAssignments();
  persist('tasks');
  persist('events');
  persist('teams');
  applyFilters();
  showToast('Uppgift borttagen', 'ok');
}

function hideCtxMenu() {
  document.getElementById('ctx-menu').style.display = 'none';
}

function duplicateEvent(id) {
  const src = db.events.find(e=>e.id===id);
  if (!src) return;
  const maxId = db.events.reduce((m,e) => Math.max(m,e.id), 0) + 1;
  const copy = JSON.parse(JSON.stringify(src));
  copy.id = maxId;
  copy.volunteers = 0;
  db.events.push(copy);
  assignments[copy.id] = {};
  persist('events');
  applyFilters();
  selectRow(copy.id);
}

document.addEventListener('click', () => hideCtxMenu());
document.addEventListener('contextmenu', e => {
  if (!e.target.closest('.ctx-menu')) hideCtxMenu();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (document.body.classList.contains('slides-fullscreen')) { document.body.classList.remove('slides-fullscreen'); history.replaceState(null, '', '#slides'); return; }
    if (document.body.classList.contains('nameplate-fullscreen')) { exitNameplateFullscreen(); return; }
    if (document.body.classList.contains('sunday-fullscreen')) { exitSundayFullscreen(); return; }
    if (document.getElementById('propagate-modal').classList.contains('open')) { executePropagation(false); return; }
    if (document.getElementById('detail-modal').classList.contains('open')) { closeDetailModal(); return; }
    if (document.getElementById('gen-modal').classList.contains('open')) { closeGenModal(); return; }
  }
  if (currentTab === 'slides' && !e.target.closest('input,textarea,select')) {
    const total = document.querySelectorAll('#slides-area .slide').length;
    if (!total) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); goToSlide((slideIndex + 1) % total); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); goToSlide((slideIndex - 1 + total) % total); }
    if (e.key === ' ') { e.preventDefault(); toggleSlidePause(); }
    if (e.key === 'f') { e.preventDefault(); toggleSlideFullscreen(); }
  }
  if (currentTab === 'sunday' && !e.target.closest('input,textarea,select')) {
    if (e.key === 'f') { e.preventDefault(); toggleSundayFullscreen(); }
  }
});
