// ── Email builder (no DOM, works in Node and browser) ──────────────────────────

(function (exports) {
  'use strict';

  var Shared = typeof require !== 'undefined'
    ? require('./shared')
    : window.Shared;

  var DAY_NAMES = ['söndag','måndag','tisdag','onsdag','torsdag','fredag','lördag'];
  var MONTH_NAMES = ['januari','februari','mars','april','maj','juni','juli','augusti','september','oktober','november','december'];

  /**
   * Build a personal reminder email for one contact assigned to one event.
   * Returns { to, subject, html }
   */
  function buildPersonalEmail(ev, contact, db, schedules) {
    var task = Shared.findPersonTask(ev.id, contact.id, db, schedules);
    var taskPhrase = (task && task.phrase) || ('är ' + ((task && task.name) || 'med'));
    var firstName = contact.name.split(' ')[0];
    var rosterHtml = Shared.buildRosterRows(ev.id, db, schedules);
    var d = new Date(ev.date + 'T00:00:00');
    var isLeader = task && task.name === 'Ledare';

    var html = '<div style="font-family:\'Be Vietnam\',sans-serif;background:#fff;padding:20px;border-radius:3px">'
      + '<h1 style="font-size:35px;font-weight:300;text-align:center;margin-bottom:30px">Hej ' + firstName + '!</h1>'
      + '<p>Du ' + taskPhrase + ' på "' + ev.title + '", ' + DAY_NAMES[d.getDay()] + ' kl ' + (ev.time || '') + '.</p>'
      + '<p>Alla som har ansvar då är:</p>'
      + '<table class="dudes" style="width:100%;border-top:1px solid #ccc;border-bottom:1px solid #ccc;padding:10px;margin-bottom:10px;border-collapse:collapse;font-size:13px"><tbody>' + rosterHtml + '</tbody></table>'
      + (isLeader ? '<hr style="border:0;border-bottom:1px solid #f6f6f6;margin:20px 0"><br><br><h2 style="font-weight:400">Info som finns i veckoschemat för nästa vecka:</h2><p style="color:#999;font-size:12px;font-style:italic">(veckoschema infogas här)</p>' : '')
      + '<h3 style="font-weight:400">Ha en fortsatt välsignad vecka!</h3>'
      + '<img style="width:150px" src="http://pingstkungsbacka.se/logo.png">'
      + '</div>'
      + '<div style="text-align:center;margin-top:10px;font-size:12px;color:#999">Pingstkyrkan Kungsbacka<br>Det här mailet avser ' + ev.date + ' ' + (ev.time || '') + '.<br>Ser något fel ut? Svara på det här mailet isåfall.</div>';

    var dayName = DAY_NAMES[d.getDay()];
    var subjectRole = (task && task.name) ? task.name.toLowerCase() : 'med';

    return {
      to: contact.email,
      subject: 'Du är ' + subjectRole + ' på ' + dayName,
      html: html
    };
  }

  /**
   * Build a group "mailchat" email for all assigned people on an event.
   * Returns { to: [emails], subject, html }
   */
  function buildMailchatEmail(ev, db, schedules) {
    var d = new Date(ev.date + 'T00:00:00');
    var dateStr = (d.getDate() + ' ' + MONTH_NAMES[d.getMonth()] + ' ' + (ev.time || '')).trim();
    var asgn = schedules[ev.id] || {};
    var zebraRows = '';
    var recipients = [];

    Object.entries(asgn).forEach(function (entry) {
      var tid = parseInt(entry[0]);
      var val = entry[1];
      var task = (db.tasks || []).find(function (t) { return t.id === tid; });
      if (!task) return;
      var names = [];
      if (val.type === 'contact') {
        (val.ids || []).forEach(function (cid) {
          var c = (db.contacts || []).find(function (x) { return x.id === cid; });
          if (c) { names.push(c.name); if (c.email) recipients.push(c.email); }
        });
      } else if (val.type === 'team') {
        var team = (db.teams || []).find(function (t) { return t.id === val.id; });
        if (team) team.members.forEach(function (cid) {
          var c = (db.contacts || []).find(function (x) { return x.id === cid; });
          if (c) { names.push(c.name); if (c.email) recipients.push(c.email); }
        });
      }
      zebraRows += '<tr><td style="padding:3px 8px">' + task.name + '</td><td style="padding:3px 8px">' + names.join(', ') + '</td></tr>';
    });

    var html = '<div style="font-family:\'Be Vietnam\',sans-serif;background:#fff;padding:20px;border-radius:3px">'
      + '<h1 style="font-size:35px;font-weight:300;text-align:center;margin-bottom:30px">Hej alla!</h1>'
      + '<p>Ni som är med i den här mailtråden gör "' + ev.title + '" <strong>' + dateStr + '</strong> tillsammans. Använd den här mailtråden för kommunikation kring sådant som behöver spikas inför ' + DAY_NAMES[d.getDay()] + '.</p>'
      + '<br>'
      + '<table style="display:table;width:28rem;border:1px solid #f0f0f0;border-radius:10px;margin:auto;border-collapse:collapse;text-align:left;font-size:13px">'
      + '<thead style="border-bottom:1px solid #e0e0e0;font-weight:900"><tr><th style="padding:3px 8px">Vad</th><th style="padding:3px 8px">Vem</th></tr></thead>'
      + '<tbody>' + zebraRows + '</tbody>'
      + '</table>'
      + '<br><br>'
      + '<p>Allt som skickas i den här mailtråden skickas också till bilddatorns mail.</p>'
      + '<hr style="border:0;border-bottom:1px solid #f6f6f6;margin:20px 0">'
      + '<h3 style="font-weight:400">Fortsatt välsignad vecka!</h3>'
      + '<img style="width:150px" src="http://pingstkungsbacka.se/logo.png">'
      + '</div>'
      + '<div style="text-align:center;margin-top:10px;font-size:12px;color:#999">Pingstkyrkan Kungsbacka<br>Det här mailet avser ' + ev.date + ' ' + (ev.time || '') + '.<br>Ser något fel ut? Svara på det här mailet isåfall.</div>';

    // dedupe recipients
    var unique = recipients.filter(function (v, i, a) { return a.indexOf(v) === i; });

    return {
      to: unique,
      subject: ev.title + ' ' + ev.date,
      html: html
    };
  }

  /**
   * Collect all reminder emails that should be sent for a given day offset.
   * daysAhead: e.g. 6 for "6 days before event", 1 for "1 day before"
   * today: Date object for "now"
   * Returns array of { to, subject, html } objects
   */
  function collectReminders(db, schedules, daysAhead, today) {
    var todayStr = Shared.localDate(today);
    var targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysAhead);
    var targetStr = Shared.localDate(targetDate);

    var events = (db.events || []).filter(function (e) { return e.date === targetStr; });
    var emails = [];

    events.forEach(function (ev) {
      var people = Shared.resolveEventPeople(ev, db, schedules);
      people.forEach(function (p) {
        var contact = (db.contacts || []).find(function (c) { return c.id === p.cid; });
        if (!contact || !contact.email) return;
        emails.push(buildPersonalEmail(ev, contact, db, schedules));
      });
    });

    return emails;
  }

  /**
   * Collect all mailchat (group) emails for events on a given day offset.
   */
  function collectMailchats(db, schedules, daysAhead, today) {
    var todayStr = Shared.localDate(today);
    var targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysAhead);
    var targetStr = Shared.localDate(targetDate);

    var events = (db.events || []).filter(function (e) { return e.date === targetStr; });
    var emails = [];

    events.forEach(function (ev) {
      var asgn = schedules[ev.id];
      if (!asgn || Object.keys(asgn).length === 0) return;
      emails.push(buildMailchatEmail(ev, db, schedules));
    });

    return emails;
  }

  exports.buildPersonalEmail = buildPersonalEmail;
  exports.buildMailchatEmail = buildMailchatEmail;
  exports.collectReminders = collectReminders;
  exports.collectMailchats = collectMailchats;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.EmailBuilder = {}));
