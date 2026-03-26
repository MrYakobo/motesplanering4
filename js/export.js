// ── EXPORT TAB (uses ExportBuilder from lib/export-builder.js) ─────────────────
function renderExport() {
  const area = document.getElementById('export-area');
  const numMonths = exportMonths || 2;
  const startStr = exportStartDate;
  const start = new Date(startStr + 'T00:00:00');
  const endMonth = new Date(start.getFullYear(), start.getMonth() + numMonths, 0);
  const endStr = localDate(endMonth);
  const eventCount = (db.events || []).filter(e => e.date >= startStr && e.date <= endStr).length;

  const wrappedHtml = ExportBuilder.buildExportHtml({
    events: db.events || [],
    startDate: startStr,
    months: numMonths,
    today: getToday()
  });

  area.innerHTML = `
    <div class="export-toolbar">
      <label style="font-size:13px;color:#6b7280">Från:</label>
      <input type="date" value="${startStr}" onchange="exportStartDate=this.value;renderExport()" style="border:1px solid #d1d5db;border-radius:6px;padding:5px 8px;font-size:13px">
      <label style="font-size:13px;color:#6b7280">Månader:</label>
      <select onchange="exportMonths=parseInt(this.value);renderExport()" style="border:1px solid #d1d5db;border-radius:6px;padding:5px 8px;font-size:13px">
        ${[1,2,3,4,6,9,12].map(n => `<option value="${n}" ${n===numMonths?'selected':''}>${n}</option>`).join('')}
      </select>
      <button class="btn" onclick="copyExport()">Kopiera HTML</button>
      <button class="btn" onclick="publishExport()" id="btn-publish">Publicera</button>
      <span style="font-size:13px;color:#6b7280">${eventCount} händelser · → ${endStr}</span>
    </div>
    <div class="export-preview" id="export-preview">${wrappedHtml}</div>
    <div class="export-code" id="export-code"></div>`;

  document.getElementById('export-code').textContent = wrappedHtml;
}

function copyExport() {
  const code = document.getElementById('export-code');
  if (!code) return;
  navigator.clipboard.writeText(code.textContent).then(() => {
    const btn = document.querySelector('.export-toolbar .btn');
    if (btn) { const orig = btn.textContent; btn.textContent = 'Kopierad!'; setTimeout(() => btn.textContent = orig, 1500); }
  });
}

function publishExport() {
  const btn = document.getElementById('btn-publish');
  if (!btn) return;
  const html = document.getElementById('export-code')?.textContent;
  if (!html) return;
  btn.textContent = 'Publicerar…';
  btn.disabled = true;
  fetch('/api/publish', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ html })
  })
  .then(r => r.json())
  .then(data => {
    btn.textContent = data.ok ? '✓ Publicerad!' : 'Fel: ' + (data.error || 'okänt');
    setTimeout(() => { btn.textContent = 'Publicera'; btn.disabled = false; }, 2500);
  })
  .catch(err => {
    btn.textContent = 'Fel!';
    setTimeout(() => { btn.textContent = 'Publicera'; btn.disabled = false; }, 2500);
  });
}
