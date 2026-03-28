// ── CATEGORIES TAB ────────────────────────────────────────────────────────────
function ensureCategories() {
  if (!db.categories) {
    const used = [...new Set((db.events||[]).map(e=>e.category).filter(Boolean))];
    db.categories = used.map((name,i) => ({id:i+1, name}));
    persist('categories');
  }
}

function isCatPublic(catName) {
  const cat = (db.categories||[]).find(c => c.name === catName);
  return !cat || !cat.hidden;
}

function getPublicEvents() {
  return (db.events||[]).filter(e => isCatPublic(e.category));
}

let catSearchQuery = '';

function renderCategories() {
  ensureCategories();
  const area = document.getElementById('categories-area');
  const cats = db.categories || [];
  const events = db.events || [];
  const q = catSearchQuery.toLowerCase();

  const catNames = new Set(cats.map(c=>c.name));
  const uncategorized = events.filter(e => !e.category || !catNames.has(e.category));

  const filteredCats = q ? cats.filter(c => c.name.toLowerCase().includes(q)) : cats;

  let html = `<div class="team-board-toolbar">
    <span style="font-size:14px;font-weight:600;color:#374151">${cats.length} kategorier · ${events.length} händelser</span>
    <span style="flex:1"></span>
    <input type="search" placeholder="Sök kategori…" value="${escAttr(catSearchQuery)}" oninput="catSearchQuery=this.value;renderCategories()" style="border:1px solid #d1d5db;border-radius:6px;padding:5px 10px;font-size:13px;width:180px;outline:none">
    <button class="btn-ghost" onclick="addCategory()" style="font-size:12px;display:inline-flex;align-items:center;gap:4px"><i data-lucide="plus" style="width:12px;height:12px"></i> Ny kategori</button>
  </div>
  <div style="padding:16px;overflow-y:auto;flex:1">`;

  if (uncategorized.length > 0 && !q) {
    html += `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;margin-bottom:16px">
      <div style="font-size:13px;font-weight:600;color:#991b1b;margin-bottom:6px">Okategoriserade (${uncategorized.length})</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">${uncategorized.slice(0,20).map(e =>
        `<span style="font-size:11px;background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:4px;cursor:pointer" onclick="switchTab('events',true);selectRow(${e.id})">${e.title}</span>`
      ).join('')}${uncategorized.length>20?`<span style="font-size:11px;color:#991b1b">+${uncategorized.length-20} till</span>`:''}</div>
    </div>`;
  }

  html += `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">`;

  filteredCats.forEach(cat => {
    const linked = events.filter(e => e.category === cat.name);
    const colorSwatches = BADGE_COLORS.map(c =>
      `<button onclick="event.stopPropagation();setCatColor(${cat.id},'${c.id}')" style="width:20px;height:20px;border-radius:50%;border:2px solid ${cat.color===c.id?ac():'transparent'};background:${c.bg};cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0" data-tip="${c.id}">${cat.color===c.id?'<span style="color:'+c.fg+';font-size:10px;font-weight:700">✓</span>':''}</button>`
    ).join('');
    const hiddenIcon = cat.hidden ? '<span style="font-size:10px;color:#9ca3af;margin-left:4px" data-tip="Dold i utdata">🔒</span>' : '';
    html += `<div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;display:flex;flex-direction:column${cat.hidden?';opacity:0.7':''}">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span class="badge" style="${catBadgeStyle(cat.name)};font-size:12px">${esc(cat.name)}</span>${hiddenIcon}
        <span style="font-size:11px;color:#9ca3af">${linked.length}</span>
        <span style="flex:1"></span>
        <button onclick="toggleCatEdit(${cat.id})" style="background:none;border:none;color:#9ca3af;cursor:pointer;padding:2px;border-radius:4px;display:inline-flex;align-items:center" data-tip="Redigera"><i data-lucide="pencil" style="width:12px;height:12px"></i></button>
      </div>
      <div id="cat-edit-${cat.id}" style="display:none;margin-bottom:8px;padding:8px;background:#f9fafb;border-radius:6px">
        <div style="display:flex;gap:4px;align-items:center;margin-bottom:8px">
          <span style="font-size:11px;color:#9ca3af;margin-right:2px">Färg:</span>${colorSwatches}
        </div>
        <div class="checkbox-row" style="margin-bottom:8px">
          <input type="checkbox" id="cat-hidden-${cat.id}" ${cat.hidden?'checked':''} onchange="toggleCatHidden(${cat.id},this.checked)">
          <label for="cat-hidden-${cat.id}" style="text-transform:none;font-size:12px;color:#374151">Dölj i utdata (slides, månadsblad, söndag)</label>
        </div>
        <div style="display:flex;gap:6px">
          <button onclick="renameCategory(${cat.id})" class="btn-ghost" style="font-size:11px;padding:3px 8px">Byt namn</button>
          ${linked.length===0?`<button onclick="deleteCategory(${cat.id})" class="btn-danger" style="font-size:11px;padding:3px 8px">Ta bort</button>`:''}
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:3px;flex:1;overflow:hidden">${linked.slice(0,12).map(e =>
        `<span style="font-size:10px;background:#f3f4f6;color:#374151;padding:1px 6px;border-radius:3px;cursor:pointer;white-space:nowrap" onclick="switchTab('events',true);selectRow(${e.id})">${e.date.slice(5)} ${esc(e.title)}</span>`
      ).join('')}${linked.length>12?`<span style="font-size:10px;color:#9ca3af">+${linked.length-12}</span>`:''}</div>
    </div>`;
  });

  html += '</div></div>';
  area.innerHTML = html;
  lucide.createIcons({nameAttr:'data-lucide', attrs:{class:'lucide-icon'}});
}

function toggleCatEdit(id) {
  const el = document.getElementById('cat-edit-' + id);
  if (!el) return;
  el.style.display = el.style.display === 'none' ? '' : 'none';
}

function toggleCatHidden(id, hidden) {
  const cat = db.categories.find(c=>c.id===id);
  if (!cat) return;
  cat.hidden = hidden;
  persist('categories');
  renderCategories();
}

function addCategory() {
  const name = prompt('Namn på ny kategori:');
  if (!name) return;
  ensureCategories();
  const maxId = db.categories.reduce((m,c) => Math.max(m,c.id), 0) + 1;
  db.categories.push({id:maxId, name});
  persist('categories');
  renderCategories();
}

function renameCategory(id) {
  const cat = db.categories.find(c=>c.id===id);
  if (!cat) return;
  const name = prompt('Nytt namn:', cat.name);
  if (!name || name === cat.name) return;
  const oldName = cat.name;
  cat.name = name;
  (db.events||[]).forEach(e => { if (e.category === oldName) e.category = name; });
  persist('categories');
  persist('events');
  renderCategories();
}

function deleteCategory(id) {
  db.categories = db.categories.filter(c=>c.id!==id);
  persist('categories');
  renderCategories();
}

function setCatColor(id, colorId) {
  const cat = db.categories.find(c=>c.id===id);
  if (!cat) return;
  cat.color = colorId;
  persist('categories');
  renderCategories();
}
