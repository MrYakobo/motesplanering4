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
      html += `<span class="mb-person has-email" data-tip="${p.email} — ${p.taskName}" onclick="previewEmail(${ev.id},${p.cid})" style="cursor:pointer"><i data-lucide="mail" style="width:10px;height:10px"></i> ${p.name}</span>`;
    });
    withoutEmail.forEach(p => {
      html += `<span class="mb-person no-email" data-tip="Saknar e-post — ${p.taskName}" onclick="openContactModal(${p.cid})"><i data-lucide="mail-x" style="width:10px;height:10px"></i> ${p.name}</span>`;
    });

    html += `</div></div>`;
  });

  area.innerHTML = html;
  lucide.createIcons({nameAttr:'data-lucide', attrs:{class:'lucide-icon'}});
}

// ── NAMNSKYLTAR ───────────────────────────────────────────────────────────────
function slugifyTask(name) {
  return (name || '').toLowerCase().replace(/[^a-zåäö0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function renderNamnskyltar() {
  const area = document.getElementById('namnskyltar-area');
  const personTasks = db.tasks.filter(t => !t.teamTask);
  const todayStr = getTodayStr();
  const todayEvents = (db.events||[]).filter(e => e.date === todayStr);

  let html = `<div style="padding:24px;overflow-y:auto;flex:1">
    <p style="font-size:13px;color:#6b7280;margin-bottom:16px">Namnskyltar för idag (${todayStr}). Klicka för fullskärm.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px">`;

  personTasks.forEach(t => {
    const name = getTodayNameForTask(t.id);
    const slug = slugifyTask(t.name);
    const preview = name
      ? `<div style="margin-top:12px;background:#111;border-radius:6px;padding:16px 20px;color:#fff">
          <div style="font-size:20px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;line-height:1.1">${esc(name)}</div>
          <div style="border:1.5px solid #fff;border-radius:99px;margin:6px 0;width:100%"></div>
          <div style="font-size:13px;font-weight:300;opacity:.85">${esc(t.name)}</div>
        </div>`
      : `<div style="margin-top:12px;background:#f9fafb;border-radius:6px;padding:16px 20px;color:#9ca3af;font-size:12px;text-align:center">Ingen tilldelad idag</div>`;

    html += `<a href="#namnskyltar/fullscreen/${slug}" target="_blank" style="text-decoration:none;color:inherit;display:block;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;transition:border-color .15s;cursor:pointer" onmouseover="this.style.borderColor=ac()" onmouseout="this.style.borderColor='#e5e7eb'">
      <div style="display:flex;align-items:center;gap:8px">
        <i data-lucide="maximize" style="width:14px;height:14px;color:#9ca3af;flex-shrink:0"></i>
        <span style="font-size:14px;font-weight:600;color:#374151">${esc(t.name)}</span>
      </div>
      ${preview}
    </a>`;
  });

  html += `</div></div>`;
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
  const todayEvents = getPublicEvents().filter(e => e.date === todayStr);
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
    : `<div style="color:#666;font-size:18px;width:100%;height:100%;display:flex;align-items:center;justify-content:center">Ingen ${task?.name||''} idag (${getTodayStr()})</div>`;
  area.style.display = '';
  document.body.classList.add('nameplate-fullscreen');
}

function exitNameplateFullscreen() {
  document.body.classList.remove('nameplate-fullscreen');
  history.replaceState(null, '', '#namnskyltar');
  renderNamnskyltar();
}

// ── SUNDAY ROSTER ─────────────────────────────────────────────────────────────
function renderSunday() {
  const area = document.getElementById('sunday-area');
  const todayStr = getTodayStr();
  const dayNames = ['söndag','måndag','tisdag','onsdag','torsdag','fredag','lördag'];
  const monthNames = ['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec'];
  const todayDate = getToday();
  const dayName = dayNames[todayDate.getDay()];
  const dateStr = todayDate.getDate() + ' ' + monthNames[todayDate.getMonth()];
  const todayEvents = getPublicEvents().filter(e => e.date === todayStr).sort((a,b) => (a.time||'').localeCompare(b.time||''));
  if (todayEvents.length === 0) {
    area.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#111;color:#555;font-size:16px;font-family:system-ui,sans-serif">' +
      '<div style="text-align:center"><div style="font-size:48px;margin-bottom:12px;opacity:.3">\u{1F4CB}</div>Inga h\u00e4ndelser<br><span style="font-size:13px;opacity:.6">' + dayName + ' ' + dateStr + '</span></div></div>';
    return;
  }
  let html = '<div style="min-height:100%;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);display:flex;flex-direction:column;align-items:center;padding:20px 16px;overflow-y:auto;font-family:system-ui,sans-serif;position:relative">';
  html += '<button onclick="toggleSundayFullscreen()" style="position:absolute;top:12px;right:12px;background:rgba(255,255,255,.1);border:none;color:rgba(255,255,255,.5);cursor:pointer;padding:6px;border-radius:6px;display:flex;align-items:center" data-tip="Fullskärm"><i data-lucide="maximize" style="width:16px;height:16px"></i></button>';
  todayEvents.forEach(function(ev) {
    const asgn = assignments[ev.id] || {};
    const rows = [];
    const taskOrder = (db.tasks || []).map(t => t.id);
    Object.entries(asgn).sort((a,b) => taskOrder.indexOf(parseInt(a[0])) - taskOrder.indexOf(parseInt(b[0]))).forEach(function([tid, val]) {
      const task = (db.tasks || []).find(t => t.id === parseInt(tid));
      if (!task) return;
      if (val.type === 'contact') {
        (val.ids || []).forEach(cid => {
          const c = (db.contacts || []).find(x => x.id === cid);
          if (c) rows.push({ task: task.name, name: c.name });
        });
      } else if (val.type === 'team') {
        const team = (db.teams || []).find(t => t.id === val.id);
        if (team) {
          const tl = task.name + '\u00a0' + team.number;
          team.members.forEach(mid => {
            const c = (db.contacts || []).find(x => x.id === mid);
            if (c) rows.push({ task: tl, name: c.name });
          });
        }
      }
    });
    html += '<div style="width:100%;max-width:400px;margin-bottom:24px">';
    html += '<div style="text-align:center;margin-bottom:12px">';
    html += '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:'+acMid()+';font-weight:600;margin-bottom:4px">' + dayName + ' ' + dateStr + ' \u00b7 ' + (ev.time || '') + '</div>';
    html += '<div style="font-size:20px;font-weight:700;color:#fff;line-height:1.2">' + esc(ev.title) + '</div>';
    html += '</div>';
    if (rows.length > 0) {
      html += '<div style="background:rgba(255,255,255,.07);border-radius:12px;overflow:hidden;backdrop-filter:blur(8px)">';
      rows.forEach(function(r, i) {
        const border = i < rows.length - 1 ? 'border-bottom:1px solid rgba(255,255,255,.06);' : '';
        html += '<div style="display:flex;padding:10px 16px;' + border + '">' +
          '<span style="flex:1;font-size:13px;color:rgba(255,255,255,.5)">' + esc(r.task) + '</span>' +
          '<span style="font-size:13px;color:#fff;font-weight:500;white-space:nowrap">' + esc(r.name).replace(/ /g,'\u00a0') + '</span>' +
          '</div>';
      });
      html += '</div>';
    } else {
      html += '<div style="text-align:center;color:rgba(255,255,255,.3);font-size:13px;padding:16px">Inga tilldelade</div>';
    }
    html += '</div>';
  });
  html += '</div>';
  area.innerHTML = html;
  lucide.createIcons({nameAttr:'data-lucide', attrs:{class:'lucide-icon'}});
}

function toggleSundayFullscreen() {
  if (document.body.classList.contains('sunday-fullscreen')) {
    exitSundayFullscreen();
  } else {
    enterSundayFullscreen();
  }
}

function enterSundayFullscreen() {
  if (currentTab !== 'sunday') switchTab('sunday', true);
  document.body.classList.add('sunday-fullscreen');
  history.replaceState(null, '', '#sunday/fullscreen');
}

function exitSundayFullscreen() {
  document.body.classList.remove('sunday-fullscreen');
  history.replaceState(null, '', '#sunday');
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
    headers: getAuthHeaders(),
    body: JSON.stringify(email)
  })
  .then(r => {
    if (r.status === 401) { showLogin(); return null; }
    if (!r.ok) throw new Error('Serverfel (' + r.status + ')');
    return r.json();
  })
  .then(data => {
    if (!data) return;
    if (btnEl) {
      btnEl.textContent = data.ok ? '✓ Skickat!' : 'Fel: ' + (data.error || 'okänt');
      setTimeout(() => { btnEl.textContent = 'Skicka'; btnEl.disabled = false; }, 2500);
    }
  })
  .catch((err) => {
    showToast('Kunde inte skicka mail: ' + err.message, 'error');
    if (btnEl) { btnEl.textContent = 'Fel!'; setTimeout(() => { btnEl.textContent = 'Skicka'; btnEl.disabled = false; }, 2500); }
  });
}

function triggerCronNow() {
  fetch('/api/cron/run', { method: 'POST', headers: getAuthHeaders() })
    .then(r => {
      if (r.status === 401) { showLogin(); return null; }
      if (!r.ok) throw new Error('Serverfel (' + r.status + ')');
      return r.json();
    })
    .then(data => {
      if (!data) return;
      showToast(data.ok ? `Cron kördes: ${data.sent || 0} mail skickade` : 'Fel: ' + (data.error || 'okänt'), data.ok ? 'ok' : 'error');
    })
    .catch((err) => showToast('Kunde inte nå servern: ' + err.message, 'error'));
}
