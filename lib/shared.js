// ── Shared pure utilities (no DOM, works in Node and browser) ──────────────────

(function (exports) {
  'use strict';

  function localDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  function getWeekNumber(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  }

  function getMondayOfWeek(refDate, offset) {
    const d = new Date(refDate);
    const day = d.getDay() || 7;
    d.setDate(d.getDate() - day + 1 + (offset || 0) * 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function getCurrentWeekRange(today) {
    const mon = getMondayOfWeek(today, 0);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return { from: localDate(mon), to: localDate(sun) };
  }

  /**
   * Resolve assignments for an event into a list of people with their tasks.
   * Returns [{cid, taskName, taskPhrase}]
   */
  function resolveEventPeople(ev, db, schedules) {
    const asgn = schedules[ev.id] || {};
    const people = [];
    Object.entries(asgn).forEach(function (entry) {
      const tid = parseInt(entry[0]);
      const val = entry[1];
      const task = (db.tasks || []).find(function (t) { return t.id === tid; });
      if (!task || !task.mailbot) return;
      if (val.type === 'contact') {
        (val.ids || []).forEach(function (cid) {
          people.push({ cid: cid, taskName: task.name, taskPhrase: task.phrase });
        });
      } else if (val.type === 'team') {
        var team = (db.teams || []).find(function (t) { return t.id === val.id; });
        if (team) team.members.forEach(function (cid) {
          people.push({ cid: cid, taskName: task.name, taskPhrase: task.phrase });
        });
      }
    });
    return people;
  }

  /**
   * Build the volunteer roster HTML table rows for an event.
   */
  function buildRosterRows(eventId, db, schedules) {
    const asgn = schedules[eventId] || {};
    let rows = '';
    Object.entries(asgn).forEach(function (entry) {
      const tid = parseInt(entry[0]);
      const val = entry[1];
      const task = (db.tasks || []).find(function (t) { return t.id === tid; });
      if (!task) return;
      if (val.type === 'contact') {
        (val.ids || []).forEach(function (cid) {
          const c = (db.contacts || []).find(function (x) { return x.id === cid; });
          if (!c) return;
          rows += '<tr><td>' + task.name + '</td><td>' + c.name + '</td></tr>';
        });
      } else if (val.type === 'team') {
        var team = (db.teams || []).find(function (t) { return t.id === val.id; });
        if (!team) return;
        rows += '<tr><td colspan="2" style="padding-top:12px"><strong>' + task.name + ' — Team ' + team.number + '</strong></td></tr>';
        team.members.forEach(function (cid) {
          const c = (db.contacts || []).find(function (x) { return x.id === cid; });
          if (!c) return;
          rows += '<tr><td></td><td>' + c.name + '</td></tr>';
        });
      }
    });
    return rows;
  }

  /**
   * Find which task a specific contact is assigned to for an event.
   */
  function findPersonTask(eventId, contactId, db, schedules) {
    const asgn = schedules[eventId] || {};
    for (const [tid, val] of Object.entries(asgn)) {
      const task = (db.tasks || []).find(function (t) { return t.id === parseInt(tid); });
      if (!task) continue;
      if (val.type === 'contact' && (val.ids || []).includes(contactId)) return task;
      if (val.type === 'team') {
        var team = (db.teams || []).find(function (t) { return t.id === val.id; });
        if (team && team.members.includes(contactId)) return task;
      }
    }
    return null;
  }

  exports.localDate = localDate;
  exports.getWeekNumber = getWeekNumber;
  exports.getMondayOfWeek = getMondayOfWeek;
  exports.getCurrentWeekRange = getCurrentWeekRange;
  exports.resolveEventPeople = resolveEventPeople;
  exports.buildRosterRows = buildRosterRows;
  exports.findPersonTask = findPersonTask;

})(typeof module !== 'undefined' && module.exports ? module.exports : (window.Shared = {}));
