function sortBy(key) {
  if (sortCol===key) sortDir*=-1; else { sortCol=key; sortDir=1; }
  applyFilters();
}

function selectRow(id) {
  selectedId = id;
  warningConfigOpen = false;
  if (currentTab === 'events' && currentView === 'monster') {
    openDetailModal(id);
    renderTable();
  } else {
    renderTable();
    renderSidebar(db[currentTab].find(r=>r.id===id));
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
  if (!db[tab]) return;
  db[tab] = db[tab].filter(r=>r.id!==id);
  if (selectedId === id) { selectedId = null; renderSidebar(null); }
  persist(tab);
  applyFilters();
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
});
