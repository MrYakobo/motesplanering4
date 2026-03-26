// ── CATEGORIES TAB ────────────────────────────────────────────────────────────
function ensureCategories() {
  if (!db.categories) {
    const used = [...new Set((db.events||[]).map(e=>e.category).filter(Boolean))];
    db.categories = used.map((name,i) => ({id:i+1, name}));
    persist('categories');
  }
}

function renderCategories() {
  ensureCategories();
  const area = document.getElementById('categories-area');
  const cats = db.categories || [];
  const events = db.events || [];

  // Find uncategorized
  const catNames = new Set(cats.map(c=>c.name));
  const uncategorized = events.filter(e => !e.category || !catNames.has(e.category));

  let html = `<div class="team-board-toolbar">
    <span style="font-size:14px;font-weight:600;color:#374151">${cats.length} kategorier · ${events.length} händelser</span>
    <span style="flex:1"></span>
    <button class="btn-ghost" onclick="addCategory()" style="font-size:12px;display:inline-flex;align-items:center;gap:4px"><i data-lucide="plus" style="width:12px;height:12px"></i> Ny kategori</button>
  </div>
  <div style="padding:16px;overflow-y:auto;flex:1">`;

  if (uncategorized.length > 0) {
    html += `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;margin-bottom:16px">
      <div style="font-size:13px;font-weight:600;color:#991b1b;margin-bottom:6px">Okategoriserade (${uncategorized.length})</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">${uncategorized.slice(0,20).map(e =>
        `<span style="font-size:11px;background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:4px;cursor:pointer" onclick="switchTab('events',true);selectRow(${e.id})">${e.title}</span>`
      ).join('')}${uncategorized.length>20?`<span style="font-size:11px;color:#991b1b">+${uncategorized.length-20} till</span>`:''}</div>
    </div>`;
  }

  cats.forEach(cat => {
    const linked = events.filter(e => e.category === cat.name);
    const cls = cat.name.toLowerCase();
    html += `<div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:14px 18px;margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span class="badge badge-${cls}" style="font-size:12px">${cat.name}</span>
        <span style="font-size:12px;color:#9ca3af">${linked.length} händelser</span>
        <span style="flex:1"></span>
        <button onclick="renameCategory(${cat.id})" style="background:none;border:none;color:#6b7280;cursor:pointer;font-size:12px;display:inline-flex;align-items:center;gap:3px"><i data-lucide="pencil" style="width:12px;height:12px"></i> Byt namn</button>
        ${linked.length===0?`<button onclick="deleteCategory(${cat.id})" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:12px;display:inline-flex;align-items:center;gap:3px"><i data-lucide="trash-2" style="width:12px;height:12px"></i></button>`:''}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">${linked.slice(0,30).map(e =>
        `<span style="font-size:11px;background:#f3f4f6;color:#374151;padding:2px 8px;border-radius:4px;cursor:pointer" onclick="switchTab('events',true);selectRow(${e.id})">${e.date} ${e.title}</span>`
      ).join('')}${linked.length>30?`<span style="font-size:11px;color:#9ca3af">+${linked.length-30} till</span>`:''}</div>
    </div>`;
  });

  html += '</div>';
  area.innerHTML = html;
  lucide.createIcons({nameAttr:'data-lucide', attrs:{class:'lucide-icon'}});
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
  // Update all events with old category name
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
