// ── MAILBOT (uses EmailBuilder + Shared from lib/) ────────────────────────────
function renderMailbot() {
  const area = document.getElementById('mailbot-area');
  const now = getToday();
  const todayStr = localDate(now);
  const in30 = new Date(now); in30.setDate(now.getDate() + 30);
  const in30Str = localDate(in30);

  const upcoming = (db.events || [])
    .filter(e => e.date >= todayStr && e.date <= in30Str)
    .sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time));

  const allPeopleIds = new Set();
  const noEmailIds = new Set();
  let totalAssignments = 0;
  let missingEmailCount = 0;

  const eventData = upcoming.map(ev => {
    const people = Shared.resolveEventPeople(ev, db, assignments);
    const withEmail = [];
    const withoutEmail = [];
    people.forEach(p => {
      const c = db.contacts.find(x => x.id === p.cid);
      if (!c) return;
      allPeopleIds.add(c.id);
      totalAssignments++;
      if (c.email) {
        withEmail.push({...p, name: c.name, email: c.email});
      } else {
        withoutEmail.push({...p, name: c.name});
        noEmailIds.add(c.id);
        missingEmailCount++;
      }
    });
    return {ev, people, withEmail, withoutEmail};
  }).filter(d => d.people.length > 0);

  const reminders6d = upcoming.filter(ev => {
    const diff = Math.round((new Date(ev.date + 'T00:00:00') - now) / 86400000);
    return diff >= 5 && diff <= 7;
  });
  const reminders1d = upcoming.filter(ev => {
    const diff = Math.round((new Date(ev.date + 'T00:00:00') - now) / 86400000);
    return diff >= 0 && diff <= 2;
  });

  let html = `<div class="mb-summary">
    <div class="mb-card"><div class="mb-card-num">${upcoming.length}</div><div class="mb-card-label">Händelser närmaste 30 dagarna</div></div>
    <div class="mb-card"><div class="mb-card-num">${allPeopleIds.size}</div><div class="mb-card-label">Unika personer tilldelade</div></div>
    <div class="mb-card ${noEmailIds.size > 0 ? 'danger' : 'ok'}"><div class="mb-card-num">${noEmailIds.size}</div><div class="mb-card-label">Saknar e-post</div></div>
    <div class="mb-card ${missingEmailCount > 0 ? 'warn' : 'ok'}"><div class="mb-card-num">${missingEmailCount}</div><div class="mb-card-label">Utskick som inte kan skickas</div></div>
    <div class="mb-card"><div class="mb-card-num">${reminders6d.length + reminders1d.length}</div><div class="mb-card-label">Påminnelser att skicka snart</div></div>
  </div>`;

  html += `<div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:14px 18px;margin-bottom:16px;font-size:13px;color:#374151">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px"><i data-lucide="clock" style="width:14px;height:14px;color:#6b7280"></i> Påminnelseschema (cron)</div>
    <div style="color:#6b7280;font-size:12px">• 6 dagar före kl 09:00 — första påminnelsen (personliga mail)</div>
    <div style="color:#6b7280;font-size:12px">• 6 dagar före kl 09:05 — mailchat (grupptråd)</div>
    <div style="color:#6b7280;font-size:12px">• 1 dag före kl 18:00 — sista påminnelsen (personliga mail)</div>
    <div style="margin-top:8px"><button class="btn-ghost" onclick="triggerCronNow()" style="font-size:12px">⚡ Kör cron manuellt nu</button></div>
  </div>`;

  html += `<h3 style="font-size:14px;font-weight:600;color:#374151;margin-bottom:10px">Kommande händelser med tilldelningar</h3>`;

  if (eventData.length === 0) {
    html += `<div style="color:#9ca3af;font-size:13px;padding:20px;text-align:center">Inga händelser med tilldelningar de närmaste 30 dagarna</div>`;
  }

  eventData.forEach(({ev, withEmail, withoutEmail}) => {
    const total = withEmail.length + withoutEmail.length;
    const statusCls = withoutEmail.length === 0 ? 'mb-status-ok' : withoutEmail.length === total ? 'mb-status-danger' : 'mb-status-warn';
    const statusText = withoutEmail.length === 0 ? 'Alla nåbara' : `${withoutEmail.length} saknar e-post`;

    html += `<div class="mb-event">
      <div class="mb-event-header">
        <span class="mb-event-date">${ev.date} ${ev.time || ''}</span>
        <span class="mb-event-title">${ev.title}</span>
        <span class="mb-event-status ${statusCls}">${statusText}</span>
        <button onclick="event.stopPropagation();sendMailchat(${ev.id})" style="background:none;border:1px solid #d1d5db;border-radius:4px;padding:2px 8px;font-size:11px;cursor:pointer;color:#6b7280;display:inline-flex;align-items:center;gap:3px"><i data-lucide="send" style="width:10px;height:10px"></i> Skicka mailchat</button>
        <button onclick="event.stopPropagation();previewMailchat(${ev.id})" style="background:none;border:1px solid #d1d5db;border-radius:4px;padding:2px 8px;font-size:11px;cursor:pointer;color:#6b7280;display:inline-flex;align-items:center;gap:3px"><i data-lucide="eye" style="width:10px;height:10px"></i> Förhandsgranska</button>
      </div>
      <div class="mb-people">`;

    withEmail.forEach(p => {
      html += `<span class="mb-person has-email" title="${p.email} — ${p.taskName}" onclick="previewEmail(${ev.id},${p.cid})" style="cursor:pointer"><i data-lucide="mail" style="width:10px;height:10px"></i> ${p.name}</span>`;
    });
    withoutEmail.forEach(p => {
      html += `<span class="mb-person no-email" title="Saknar e-post — ${p.taskName}" onclick="openContactModal(${p.cid})"><i data-lucide="mail-x" style="width:10px;height:10px"></i> ${p.name}</span>`;
    });

    html += `</div></div>`;
  });

  area.innerHTML = html;
  lucide.createIcons({nameAttr:'data-lucide', attrs:{class:'lucide-icon'}});
}

// ── NAMNSKYLTAR ───────────────────────────────────────────────────────────────
function renderNamnskyltar() {
  const area = document.getElementById('namnskyltar-area');
  const personTasks = db.tasks.filter(t => !t.teamTask);

  let html = `<div style="max-width:800px;margin:0 auto">
    <div style="margin-bottom:16px">
      <p style="font-size:13px;color:#6b7280;margin-bottom:10px">Fullskärmslänkar per uppgift (öppnas i ny flik):</p>
      <div style="display:flex;flex-wrap:wrap;gap:6px">${personTasks.map(t =>
        `<a href="#namnskyltar/fullscreen/${t.id}" target="_blank" class="btn-ghost" style="font-size:12px;text-decoration:none;display:inline-flex;align-items:center;gap:4px"><i data-lucide="maximize" style="width:12px;height:12px"></i> ${t.name}</a>`
      ).join('')}</div>
    </div>
  </div>`;
  area.innerHTML = html;
  lucide.createIcons({nameAttr:'data-lucide', attrs:{class:'lucide-icon'}});
}

function openNameplate(name, role) {
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Namnskylt — ${name}</title>
<style>
  * { margin:0; padding:0; }
  body { display:flex; align-items:flex-end; height:100vh; background:#111; }
  .np { padding:4vw 5vw; color:#fff; }
  .np-name { font-family:system-ui,sans-serif; font-size:min(8vw,96px); font-weight:800; text-transform:uppercase; letter-spacing:.05em; line-height:1.1; white-space:nowrap; }
  .np-line { border:2px solid #fff; border-radius:99px; width:102%; margin:.8vh 0; }
  .np-role { font-family:system-ui,sans-serif; font-size:min(3.5vw,42px); font-weight:300; margin-left:.2em; opacity:.85; }
</style></head><body><div class="np"><div class="np-name">${name}</div><div class="np-line"></div><div class="np-role">${role||''}</div></div></body></html>`);
  w.document.close();
}

function getTodayNameForTask(taskId) {
  const todayStr = getTodayStr();
  const todayEvents = (db.events||[]).filter(e => e.date === todayStr);
  for (const ev of todayEvents) {
    const asgn = assignments[ev.id]?.[taskId];
    if (asgn?.type === 'contact' && asgn.ids.length > 0) {
      return asgn.ids.map(cid => db.contacts.find(x=>x.id===cid)?.name).filter(Boolean).join(', ');
    }
  }
  return null;
}

function enterNameplateFullscreen(taskId) {
  if (currentTab !== 'namnskyltar') switchTab('namnskyltar', true);
  if (!taskId) {
    const t = db.tasks.find(t => t.name.toLowerCase().includes('predikant'));
    if (t) taskId = t.id;
  }
  const task = db.tasks.find(t => t.id === taskId);
  const name = taskId ? getTodayNameForTask(taskId) : null;
  const area = document.getElementById('namnskyltar-area');
  area.innerHTML = name
    ? `<div class="nameplate-full"><div class="np-name">${name}</div><div class="np-line"></div><div class="np-role">${task?.name||''}</div></div>`
    : `<div style="color:#666;font-size:18px;width:100%;height:100%;display:flex;align-items:center;justify-content:center">Ingen tilldelad idag</div>`;
  area.style.display = '';
  document.body.classList.add('nameplate-fullscreen');
}

function exitNameplateFullscreen() {
  document.body.classList.remove('nameplate-fullscreen');
  history.replaceState(null, '', '#namnskyltar');
  renderNamnskyltar();
}

// ── EMAIL PREVIEW (uses shared EmailBuilder) ──────────────────────────────────
function previewEmail(eventId, contactId) {
  const ev = db.events.find(e=>e.id===eventId);
  const contact = db.contacts.find(c=>c.id===contactId);
  if (!ev || !contact) return;

  const email = EmailBuilder.buildPersonalEmail(ev, contact, db, assignments);

  const modal = document.getElementById('detail-modal');
  document.getElementById('detail-modal-content').innerHTML = `
    <div class="sidebar-header"><h3>Personligt mail → ${contact.name}</h3><button class="sidebar-close" onclick="closeDetailModal()">×</button></div>
    <div class="sidebar-body" style="background:#f6f6f6;padding:16px">
      <div style="margin-bottom:8px;font-size:12px;color:#6b7280"><strong>Till:</strong> ${contact.email}<br><strong>Ämne:</strong> ${email.subject}</div>
      ${email.html}
      <div style="margin-top:12px;text-align:right">
        <button class="btn" onclick="sendSingleEmail(${eventId},${contactId})" style="font-size:12px">Skicka detta mail</button>
      </div>
    </div>`;
  modal.classList.add('open');
}

function previewMailchat(eventId) {
  const ev = db.events.find(e=>e.id===eventId);
  if (!ev) return;

  const email = EmailBuilder.buildMailchatEmail(ev, db, assignments);

  const modal = document.getElementById('detail-modal');
  document.getElementById('detail-modal-content').innerHTML = `
    <div class="sidebar-header"><h3>Mailchat → ${ev.title}</h3><button class="sidebar-close" onclick="closeDetailModal()">×</button></div>
    <div class="sidebar-body" style="background:#f6f6f6;padding:16px">
      <div style="margin-bottom:8px;font-size:12px;color:#6b7280"><strong>Till:</strong> ${email.to.join(', ')}<br><strong>Ämne:</strong> ${email.subject}</div>
      ${email.html}
      <div style="margin-top:12px;text-align:right">
        <button class="btn" onclick="sendMailchat(${eventId})" style="font-size:12px">Skicka mailchat</button>
      </div>
    </div>`;
  modal.classList.add('open');
}

// ── SEND ACTIONS ──────────────────────────────────────────────────────────────
function sendSingleEmail(eventId, contactId) {
  const ev = db.events.find(e=>e.id===eventId);
  const contact = db.contacts.find(c=>c.id===contactId);
  if (!ev || !contact) return;
  const email = EmailBuilder.buildPersonalEmail(ev, contact, db, assignments);
  _sendEmail(email, event.target);
}

function sendMailchat(eventId) {
  const ev = db.events.find(e=>e.id===eventId);
  if (!ev) return;
  const email = EmailBuilder.buildMailchatEmail(ev, db, assignments);
  // send to each recipient individually (server handles single to)
  const toList = Array.isArray(email.to) ? email.to : [email.to];
  _sendEmail({to: toList.join(', '), subject: email.subject, html: email.html}, event.target);
}

function _sendEmail(email, btnEl) {
  if (btnEl) { btnEl.textContent = 'Skickar…'; btnEl.disabled = true; }
  fetch('/api/send-email', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(email)
  })
  .then(r => r.json())
  .then(data => {
    if (btnEl) {
      btnEl.textContent = data.ok ? '✓ Skickat!' : 'Fel: ' + (data.error || 'okänt');
      setTimeout(() => { btnEl.textContent = 'Skicka'; btnEl.disabled = false; }, 2500);
    }
  })
  .catch(() => {
    if (btnEl) { btnEl.textContent = 'Fel!'; setTimeout(() => { btnEl.textContent = 'Skicka'; btnEl.disabled = false; }, 2500); }
  });
}

function triggerCronNow() {
  fetch('/api/cron/run', { method: 'POST' })
    .then(r => r.json())
    .then(data => {
      alert(data.ok ? `Cron kördes: ${data.sent || 0} mail skickade` : 'Fel: ' + (data.error || 'okänt'));
    })
    .catch(() => alert('Kunde inte nå servern'));
}
