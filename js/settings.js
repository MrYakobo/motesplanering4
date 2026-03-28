// ── SETTINGS UI ───────────────────────────────────────────────────────────────
function openSettings() {
  const s = db.settings || {};
  const smtp = s.smtp || {};
  const sftp = s.sftp || {};
  const body = document.getElementById('settings-body');
  body.innerHTML = `
    <h4 style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;margin-bottom:12px">Organisation</h4>
    <div class="field-group"><label>Namn</label><input id="set-org-name" value="${escAttr(s.orgName||'')}" placeholder="T.ex. Exempelkyrkan"></div>
    <div class="field-group"><label>Logotyp-URL</label><input id="set-org-logo" value="${escAttr(s.orgLogo||'')}" placeholder="https://..."></div>

    <h4 style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;margin-bottom:12px;margin-top:20px;padding-top:16px;border-top:1px solid #e5e7eb">SMTP (e-post)</h4>
    <div class="field-group"><label>Host</label><input id="set-smtp-host" value="${escAttr(smtp.host||'')}"></div>
    <div class="field-group"><label>Port</label><input id="set-smtp-port" type="number" value="${smtp.port||587}"></div>
    <div class="field-group"><label>Användare</label><input id="set-smtp-user" value="${escAttr(smtp.user||'')}"></div>
    <div class="field-group"><label>Lösenord</label><input id="set-smtp-pass" type="password" value="${escAttr(smtp.pass||'')}"></div>
    <div class="field-group"><label>Från-adress</label><input id="set-smtp-from" value="${escAttr(smtp.from||'')}"></div>
    <div class="checkbox-row" style="margin-bottom:16px"><input type="checkbox" id="set-smtp-secure" ${smtp.secure?'checked':''}><label for="set-smtp-secure" style="text-transform:none;font-size:13px;color:#374151">Secure (TLS)</label></div>

    <h4 style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;margin-bottom:12px;margin-top:20px;padding-top:16px;border-top:1px solid #e5e7eb">SFTP (publicering)</h4>
    <div class="field-group"><label>Host</label><input id="set-sftp-host" value="${escAttr(sftp.host||'')}"></div>
    <div class="field-group"><label>Port</label><input id="set-sftp-port" type="number" value="${sftp.port||22}"></div>
    <div class="field-group"><label>Användare</label><input id="set-sftp-user" value="${escAttr(sftp.username||'')}"></div>
    <div class="field-group"><label>Privat nyckel</label>
      <div style="display:flex;gap:6px;align-items:center">
        <span id="sftp-key-status" style="font-size:12px;color:${sftp.privateKey?'#065f46':'#9ca3af'}">${sftp.privateKey ? '✓ Nyckel laddad (' + sftp.privateKey.length + ' tecken)' : 'Ingen nyckel'}</span>
        <label class="btn-ghost" style="font-size:11px;padding:3px 8px;cursor:pointer;display:inline-flex;align-items:center;gap:4px">
          <i data-lucide="upload" style="width:11px;height:11px"></i> ${sftp.privateKey ? 'Byt' : 'Ladda upp'}
          <input type="file" id="set-sftp-key-file" onchange="readSftpKeyFile(this)" style="display:none">
        </label>
        ${sftp.privateKey ? '<button class="btn-ghost" onclick="clearSftpKey()" style="font-size:11px;padding:3px 8px">Ta bort</button>' : ''}
      </div>
      <textarea id="set-sftp-key" style="display:none">${escAttr(sftp.privateKey||'')}</textarea>
    </div>
    <div class="field-group"><label>Fjärrsökväg</label><input id="set-sftp-path" value="${escAttr(sftp.remotePath||'/var/www/html/calendar.html')}"></div>

    <h4 style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;margin-bottom:12px;margin-top:20px;padding-top:16px;border-top:1px solid #e5e7eb">Schemalagda jobb (cron)</h4>
    <div id="cron-jobs-list"></div>
  `;
  document.getElementById('settings-modal').classList.add('open');
  lucide.createIcons({nameAttr:'data-lucide', attrs:{class:'lucide-icon'}});
  loadCronJobsUI();
}

function closeSettings() {
  document.getElementById('settings-modal').classList.remove('open');
}

function saveSettings() {
  if (!db.settings) db.settings = {};
  db.settings.orgName = document.getElementById('set-org-name').value;
  db.settings.orgLogo = document.getElementById('set-org-logo').value;
  db.settings.smtp = {
    host: document.getElementById('set-smtp-host').value,
    port: parseInt(document.getElementById('set-smtp-port').value) || 587,
    user: document.getElementById('set-smtp-user').value,
    pass: document.getElementById('set-smtp-pass').value,
    from: document.getElementById('set-smtp-from').value,
    secure: document.getElementById('set-smtp-secure').checked,
  };
  db.settings.sftp = {
    host: document.getElementById('set-sftp-host').value,
    port: parseInt(document.getElementById('set-sftp-port').value) || 22,
    username: document.getElementById('set-sftp-user').value,
    privateKey: document.getElementById('set-sftp-key').value,
    remotePath: document.getElementById('set-sftp-path').value,
  };
  // Save cron jobs from UI
  const cronEls = document.querySelectorAll('[data-cron-job]');
  if (cronEls.length > 0) {
    db.settings.cronJobs = Array.from(cronEls).map(el => {
      return JSON.parse(el.dataset.cronJob);
    });
  }
  persist('settings');
  // Reload cron schedules on server
  fetch('/api/cron/reload', { method: 'POST', headers: getAuthHeaders() }).catch(() => {});
  closeSettings();
  showToast('Inställningar sparade', 'ok');
}

function readSftpKeyFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById('set-sftp-key').value = e.target.result;
    document.getElementById('sftp-key-status').textContent = '✓ ' + file.name + ' (' + e.target.result.length + ' tecken)';
    document.getElementById('sftp-key-status').style.color = '#065f46';
  };
  reader.readAsText(file);
}

function clearSftpKey() {
  document.getElementById('set-sftp-key').value = '';
  document.getElementById('sftp-key-status').textContent = 'Ingen nyckel';
  document.getElementById('sftp-key-status').style.color = '#9ca3af';
}

// ── CRON ADMIN ────────────────────────────────────────────────────────────────
const DEFAULT_CRON_JOBS = [
  { id: 'reminders_6d', name: 'Påminnelser (6 dagar)', schedule: '0 9 * * *', action: 'reminders', daysAhead: 6, enabled: true },
  { id: 'mailchats_6d', name: 'Mailchats (6 dagar)', schedule: '5 9 * * *', action: 'mailchats', daysAhead: 6, enabled: true },
  { id: 'reminders_1d', name: 'Påminnelser (1 dag)', schedule: '0 18 * * *', action: 'reminders', daysAhead: 1, enabled: true },
  { id: 'backup', name: 'Daglig backup', schedule: '0 2 * * *', action: 'backup', enabled: true },
  { id: 'publish', name: 'Publicera månadsblad', schedule: '0 * * * *', action: 'publish', enabled: false },
];

function loadCronJobsUI() {
  const container = document.getElementById('cron-jobs-list');
  if (!container) return;
  const jobs = (db.settings && db.settings.cronJobs) || DEFAULT_CRON_JOBS;
  container.innerHTML = jobs.map((job, i) => {
    const actionLabel = job.action === 'reminders' ? 'Påminnelser' : job.action === 'mailchats' ? 'Mailchats' : job.action === 'backup' ? 'Backup' : job.action === 'publish' ? 'Publicera' : job.action;
    return `<div data-cron-job='${JSON.stringify(job).replace(/'/g,"&#39;")}' data-cron-idx="${i}" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:10px 12px;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <input type="checkbox" ${job.enabled?'checked':''} onchange="toggleCronJob(${i},this.checked)" style="accent-color:'+ac()+'">
        <span style="font-size:13px;font-weight:600;color:#374151;flex:1">${esc(job.name)}</span>
        <span style="font-size:11px;color:#9ca3af;background:#fff;border:1px solid #e5e7eb;border-radius:4px;padding:1px 6px;font-family:ui-monospace,monospace">${esc(actionLabel)}</span>
        <button onclick="runSingleCronJob('${job.id}')" class="btn-ghost" style="font-size:11px;padding:3px 8px;display:inline-flex;align-items:center;gap:3px"><i data-lucide="play" style="width:10px;height:10px"></i> Kör nu</button>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <label style="font-size:11px;color:#6b7280">Cron-uttryck:</label>
        <input type="text" value="${escAttr(job.schedule)}" onchange="updateCronSchedule(${i},this.value)" style="border:1px solid #d1d5db;border-radius:4px;padding:3px 6px;font-size:12px;font-family:ui-monospace,monospace;width:120px">
        <span style="font-size:10px;color:#9ca3af">${describeCron(job.schedule)}</span>
      </div>
    </div>`;
  }).join('');
  lucide.createIcons({nameAttr:'data-lucide', attrs:{class:'lucide-icon'}});
}

function toggleCronJob(idx, enabled) {
  const els = document.querySelectorAll('[data-cron-job]');
  const el = els[idx];
  if (!el) return;
  const job = JSON.parse(el.dataset.cronJob);
  job.enabled = enabled;
  el.dataset.cronJob = JSON.stringify(job);
}

function updateCronSchedule(idx, schedule) {
  const els = document.querySelectorAll('[data-cron-job]');
  const el = els[idx];
  if (!el) return;
  const job = JSON.parse(el.dataset.cronJob);
  job.schedule = schedule;
  el.dataset.cronJob = JSON.stringify(job);
  // Update description
  const descEl = el.querySelector('span:last-child');
  if (descEl) descEl.textContent = describeCron(schedule);
}

function runSingleCronJob(jobId) {
  fetch('/api/cron/run', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ jobId })
  })
  .then(r => r.json())
  .then(data => {
    if (data.ok) showToast(`${data.job}: ${data.sent || 0} skickade`, 'ok');
    else showToast('Fel: ' + (data.error || 'okänt'), 'error');
  })
  .catch(err => showToast('Kunde inte köra jobb: ' + err.message, 'error'));
}

function describeCron(expr) {
  const parts = (expr || '').split(' ');
  if (parts.length < 5) return '';
  const min = parts[0], hour = parts[1];
  if (hour === '*' && min !== '*') return `varje timme vid :${min.padStart(2,'0')}`;
  if (min === '*' || hour === '*') return 'varje minut/timme';
  return `kl ${hour.padStart(2,'0')}:${min.padStart(2,'0')} dagligen`;
}

// ── THEMING ───────────────────────────────────────────────────────────────────
const ACCENT_COLORS = [
  { id:'indigo',  color:'#4f46e5', hover:'#4338ca', light:'#ede9fe', mid:'#a78bfa', label:'Indigo' },
  { id:'purple',  color:'#7c3aed', hover:'#6d28d9', light:'#f5f3ff', mid:'#c4b5fd', label:'Lila' },
  { id:'blue',    color:'#2563eb', hover:'#1d4ed8', light:'#dbeafe', mid:'#93c5fd', label:'Blå' },
  { id:'teal',    color:'#0d9488', hover:'#0f766e', light:'#ccfbf1', mid:'#5eead4', label:'Teal' },
  { id:'green',   color:'#16a34a', hover:'#15803d', light:'#dcfce7', mid:'#86efac', label:'Grön' },
  { id:'amber',   color:'#d97706', hover:'#b45309', light:'#fef3c7', mid:'#fcd34d', label:'Amber' },
  { id:'red',     color:'#dc2626', hover:'#b91c1c', light:'#fee2e2', mid:'#fca5a5', label:'Röd' },
  { id:'pink',    color:'#db2777', hover:'#be185d', light:'#fce7f3', mid:'#f9a8d4', label:'Rosa' },
  { id:'slate',   color:'#475569', hover:'#334155', light:'#f1f5f9', mid:'#94a3b8', label:'Grå' },
];

function applyTheme(accentId) {
  const t = ACCENT_COLORS.find(c => c.id === accentId) || ACCENT_COLORS[0];
  document.documentElement.style.setProperty('--accent', t.color);
  document.documentElement.style.setProperty('--accent-hover', t.hover);
  document.documentElement.style.setProperty('--accent-light', t.light);
  document.documentElement.style.setProperty('--accent-mid', t.mid);
  document.documentElement.style.setProperty('--accent-text', t.color);
}

function setAccentColor(id) {
  if (!db.settings) db.settings = {};
  db.settings.accentColor = id;
  persist('settings');
  applyTheme(id);
  renderThemeSwatches();
}

function renderThemeSwatches() {
  const el = document.getElementById('theme-swatches');
  if (!el) return;
  const current = (db.settings && db.settings.accentColor) || 'indigo';
  el.innerHTML = ACCENT_COLORS.map(c =>
    '<button onclick="setAccentColor(\'' + c.id + '\')" style="width:28px;height:28px;border-radius:50%;border:2px solid ' + (current === c.id ? '#fff' : 'transparent') + ';background:' + c.color + ';cursor:pointer;padding:0" data-tip="' + c.label + '"></button>'
  ).join('');
}

function initTheme() {
  const id = (db.settings && db.settings.accentColor) || 'indigo';
  applyTheme(id);
  renderThemeSwatches();
}
