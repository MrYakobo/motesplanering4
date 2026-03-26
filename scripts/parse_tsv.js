const fs = require('fs');

// ── Parse Teams TSV ──
const teamTsv = fs.readFileSync('Mötesplanering - Team.tsv', 'utf8');
const teamLines = teamTsv.split('\n').map(l => l.split('\t'));

// Team columns layout (from row 0-1):
// 5: Söndagsskoleteam Team#, 6: Söndagsskoleteam Namn
// 7: Caféteam Team#, 8: Caféteam Namn
// 9: Värdteam Team#, 10: Värdteam Namn
// 11: Städteam Team#, 12: Städteam Namn

const teamColDefs = [
  { taskName: 'Söndagsskoleteam', colTeam: 5, colName: 6 },
  { taskName: 'Caféteam', colTeam: 7, colName: 8 },
  { taskName: 'Värdteam', colTeam: 9, colName: 10 },
];

const allNames = new Set();
const teamData = {}; // taskName -> teamNum -> [names]

for (const def of teamColDefs) {
  teamData[def.taskName] = {};
  let lastNum = null;
  for (let i = 2; i < teamLines.length; i++) {
    const row = teamLines[i];
    const tNum = (row[def.colTeam] || '').trim();
    const name = (row[def.colName] || '').trim();
    if (tNum && parseInt(tNum)) lastNum = parseInt(tNum);
    if (!name || !lastNum) continue;
    if (!teamData[def.taskName][lastNum]) teamData[def.taskName][lastNum] = [];
    teamData[def.taskName][lastNum].push(name);
    allNames.add(name);
  }
}

// Collect individual names from team TSV columns 13-18
for (let i = 2; i < teamLines.length; i++) {
  const row = teamLines[i];
  for (const col of [13, 14, 15, 16, 17, 18]) {
    const name = (row[col] || '').trim();
    if (name) allNames.add(name);
  }
}

// ── Task definitions (updated: merged Bildtekniker/Bildproducent, added Städteam) ──
const taskDefs = [
  { id: 1, name: 'Predikant / Medverk', teamTask: false, mailbot: true, phrase: '' },
  { id: 2, name: 'Ledare', teamTask: false, mailbot: true, phrase: '' },
  { id: 3, name: 'Lovsång', teamTask: false, mailbot: true, phrase: '' },
  { id: 4, name: 'Ljudtekniker', teamTask: false, mailbot: true, phrase: '' },
  { id: 5, name: 'Bildtekniker/Bildproducent', teamTask: false, mailbot: true, phrase: '' },
  { id: 6, name: 'Kamera', teamTask: false, mailbot: true, phrase: '' },
  { id: 7, name: 'Värdteam', teamTask: true, mailbot: true, phrase: '' },
  { id: 8, name: 'Caféteam', teamTask: true, mailbot: true, phrase: '' },
  { id: 9, name: 'Söndagsskoleteam', teamTask: true, mailbot: true, phrase: '' },
  { id: 10, name: 'Mini', teamTask: false, mailbot: true, phrase: '' },
  { id: 11, name: 'Förebedjare', teamTask: false, mailbot: true, phrase: '' },
];
const taskByName = {};
taskDefs.forEach(t => { taskByName[t.name] = t; });

// Map TSV column index -> task name
const tsvColToTask = {
  6: 'Predikant / Medverk',
  7: 'Ledare',
  8: 'Lovsång',
  9: 'Ljudtekniker',
  10: 'Bildtekniker/Bildproducent',
  11: 'Kamera',
  12: 'Värdteam',
  13: 'Caféteam',
  14: 'Söndagsskoleteam',
  15: 'Mini',
  16: 'Förebedjare',
};

// ── Parse Events TSV ──
const evFile = fs.readdirSync('.').find(f => f.match(/^Mötesplanering - \d{4}\.tsv$/));
if (!evFile) { console.error('No "Mötesplanering - YYYY.tsv" file found'); process.exit(1); }
const evYear = evFile.match(/(\d{4})/)[1];
const evTsv = fs.readFileSync(evFile, 'utf8');
const evLines = evTsv.split('\n').map(l => l.split('\t'));

const monthMap = {
  'Januari': '01', 'Februari': '02', 'Mars': '03', 'April': '04',
  'Maj': '05', 'Juni': '06', 'Juli': '07', 'Augusti': '08',
  'September': '09', 'Oktober': '10', 'November': '11', 'December': '12'
};
const dayPattern = /^(Mån|Tis|Ons|Tor|Tors|Fre|Lör|Sön)\s+(\d+)$/;

let currentMonth = null;
let lastDayNum = null;
let events = [];
let appointments = [];
let eventId = 0;
let appointmentId = 0;

for (let i = 1; i < evLines.length; i++) {
  const row = evLines[i];
  const monthCell = (row[0] || '').trim();
  const dayCell = (row[2] || '').trim();
  const timeCell = (row[3] || '').trim();
  const typeCell = (row[4] || '').trim();
  const skipCell = (row[19] || '').trim();

  if (monthMap[monthCell]) currentMonth = monthMap[monthCell];
  if (!currentMonth) continue;

  // Parse day
  const dayMatch = dayCell.match(dayPattern);
  if (dayMatch) lastDayNum = parseInt(dayMatch[2]);
  if (!lastDayNum) continue;
  if (!typeCell) continue;

  // Parse time
  let time = timeCell.replace('.', ':').replace(/^(\d):/, '0$1:');
  if (time.match(/^\d{2}:\d{2}$/)) {
    // good
  } else if (time.match(/^\d{1,2}:\d{2}$/)) {
    time = time.padStart(5, '0');
  } else {
    // weird time like "12-17", "9-12", "-" — use as-is for appointments, skip for events
    if (skipCell === 'x') {
      appointmentId++;
      appointments.push({
        id: appointmentId,
        date: `${evYear}-${currentMonth}-${String(lastDayNum).padStart(2, '0')}`,
        time: timeCell || '',
        bookedBy: typeCell,
      });
    }
    continue;
  }

  const dateStr = `${evYear}-${currentMonth}-${String(lastDayNum).padStart(2, '0')}`;

  // Private bookings → appointments
  if (skipCell === 'x') {
    appointmentId++;
    appointments.push({
      id: appointmentId,
      date: dateStr,
      time: time,
      bookedBy: typeCell,
    });
    continue;
  }

  // Determine category
  let category = 'Weekday';
  if (typeCell.match(/[Gg]udstjänst|[Ss]ommarfest|[Kk]ick-off/i)) category = 'Sunday';
  if (typeCell.match(/[Ll]ångfredag|[Pp]åsk|[Mm]idnatt|[Aa]dvent|[Jj]ul|[Gg]etsemanestund/i)) category = 'Special';

  eventId++;
  const ev = {
    id: eventId,
    title: typeCell,
    category: category,
    date: dateStr,
    time: time,
    description: '',
    volunteers: 0,
    promoSlides: [],
    infoLink: '',
    expectedTasks: [],
    _assignments: {},
  };

  // Collect assignments from TSV columns
  for (const [colStr, taskName] of Object.entries(tsvColToTask)) {
    const col = parseInt(colStr);
    const val = (row[col] || '').trim();
    if (!val) continue;

    const task = taskByName[taskName];
    if (!task) continue;

    if (task.teamTask) {
      const teamNum = parseInt(val);
      if (teamNum) {
        ev._assignments[taskName] = { type: 'team', number: teamNum };
        if (!ev.expectedTasks.includes(task.id)) ev.expectedTasks.push(task.id);
      }
    } else {
      const names = val.split(/,\s*/).map(n => n.trim()).filter(Boolean);
      names.forEach(n => allNames.add(n));
      ev._assignments[taskName] = { type: 'contact', names: names };
      if (!ev.expectedTasks.includes(task.id)) ev.expectedTasks.push(task.id);
    }
  }

  events.push(ev);
}

// ── Build contacts ──
// First, build a dedup map: abbreviated name -> full name
const rawNames = [...allNames]
  .filter(n => n && n.length > 1 && !n.match(/^\d+$/) && !n.match(/^RE$/))
  .sort((a, b) => a.localeCompare(b, 'sv'));

// Merge abbreviated names (e.g. "Adam E" -> "Adam Emanuelsson")
const nameMap = {}; // raw name -> canonical name
const canonicals = new Set();

// First pass: collect full names (2+ char last name)
rawNames.forEach(n => {
  const parts = n.split(/\s+/);
  if (parts.length >= 2 && parts[parts.length - 1].length > 2) {
    canonicals.add(n);
  }
});

// Second pass: map abbreviations to full names
rawNames.forEach(n => {
  if (canonicals.has(n)) { nameMap[n] = n; return; }
  const parts = n.split(/\s+/);
  // Skip compound names like "Robin Eklind m. fl" or "Dan Ådahl och Sarah Lindberg"
  if (n.includes(' och ') || n.includes(' m. ')) { nameMap[n] = n; canonicals.add(n); return; }
  // "Svante & Johannes" — skip
  if (n.includes('&')) { nameMap[n] = n; canonicals.add(n); return; }

  if (parts.length === 1) {
    // Single first name — find unique full name match
    const matches = [...canonicals].filter(c => c.split(/\s+/)[0] === parts[0]);
    if (matches.length === 1) { nameMap[n] = matches[0]; return; }
  } else if (parts.length === 2 && parts[1].length <= 2) {
    // "Adam E" style — match first name + last initial
    const fn = parts[0], li = parts[1].toLowerCase();
    const matches = [...canonicals].filter(c => {
      const cp = c.split(/\s+/);
      return cp[0] === fn && cp.length >= 2 && cp[cp.length - 1].toLowerCase().startsWith(li);
    });
    if (matches.length === 1) { nameMap[n] = matches[0]; return; }
  }
  // No match found — keep as-is
  nameMap[n] = n;
  canonicals.add(n);
});

const uniqueNames = [...new Set(Object.values(nameMap))].sort((a, b) => a.localeCompare(b, 'sv'));
const contacts = uniqueNames.map((name, i) => ({
  id: i + 1, name, email: '', phone: '',
}));

const contactByCanonical = {};
contacts.forEach(c => { contactByCanonical[c.name] = c.id; });

function findContactId(name) {
  name = name.trim();
  if (!name || name === 'RE') return null;
  const canonical = nameMap[name];
  if (canonical && contactByCanonical[canonical]) return contactByCanonical[canonical];
  // fallback: try lowercase exact
  const lc = name.toLowerCase();
  const c = contacts.find(c => c.name.toLowerCase() === lc);
  if (c) return c.id;
  return null;
}

// ── Build teams ──
const teams = [];
let teamId = 0;
const teamTaskIds = { 'Värdteam': 7, 'Caféteam': 8, 'Söndagsskoleteam': 9 };

for (const [taskName, nums] of Object.entries(teamData)) {
  const taskId = teamTaskIds[taskName];
  if (!taskId) continue;
  for (const [numStr, names] of Object.entries(nums).sort((a,b) => a[0]-b[0])) {
    teamId++;
    teams.push({
      id: teamId,
      taskId,
      number: parseInt(numStr),
      members: names.map(n => findContactId(n)).filter(Boolean),
    });
  }
}

// ── Build schedules from event assignments ──
const schedules = {};
const unmatchedNames = new Set();

events.forEach(ev => {
  const evSched = {};
  for (const [taskName, asgn] of Object.entries(ev._assignments)) {
    const task = taskByName[taskName];
    if (!task) continue;
    if (asgn.type === 'team') {
      const team = teams.find(t => t.taskId === task.id && t.number === asgn.number);
      if (team) evSched[task.id] = { type: 'team', id: team.id };
    } else {
      const ids = asgn.names.map(n => {
        const id = findContactId(n);
        if (!id) unmatchedNames.add(n);
        return id;
      }).filter(Boolean);
      if (ids.length > 0) evSched[task.id] = { type: 'contact', ids };
    }
  }
  if (Object.keys(evSched).length > 0) schedules[ev.id] = evSched;
  delete ev._assignments;
});

// ── Merge with existing DB ──
let existingDb = {};
try { existingDb = JSON.parse(fs.readFileSync('data_prod.json', 'utf8')); } catch {}

// Merge contacts: keep existing, add new by name
const mergedContacts = [...(existingDb.contacts || [])];
const existingContactNames = new Set(mergedContacts.map(c => c.name.toLowerCase()));
let nextContactId = mergedContacts.reduce((m, c) => Math.max(m, c.id), 0) + 1;
const contactIdRemap = {}; // new id -> merged id

contacts.forEach(c => {
  const existing = mergedContacts.find(x => x.name.toLowerCase() === c.name.toLowerCase());
  if (existing) {
    contactIdRemap[c.id] = existing.id;
  } else {
    const newId = nextContactId++;
    contactIdRemap[c.id] = newId;
    mergedContacts.push({ ...c, id: newId });
  }
});

// Helper to remap contact IDs
const remapCid = id => contactIdRemap[id] || id;

// Keep existing tasks (don't overwrite)
const mergedTasks = existingDb.tasks || taskDefs;

// Merge teams: remap member IDs, keep existing teams for other years
const existingTeams = existingDb.teams || [];
const mergedTeams = [...existingTeams];
let nextTeamId = mergedTeams.reduce((m, t) => Math.max(m, t.id), 0) + 1;
const teamIdRemap = {};

teams.forEach(t => {
  // Check if same task+number already exists
  const existing = mergedTeams.find(x => x.taskId === t.taskId && x.number === t.number);
  const remappedMembers = t.members.map(remapCid);
  if (existing) {
    // Merge members
    remappedMembers.forEach(mid => { if (!existing.members.includes(mid)) existing.members.push(mid); });
    teamIdRemap[t.id] = existing.id;
  } else {
    const newId = nextTeamId++;
    teamIdRemap[t.id] = newId;
    mergedTeams.push({ ...t, id: newId, members: remappedMembers });
  }
});

// Merge events: remove existing events for this year, add new ones
const existingEvents = (existingDb.events || []).filter(e => !e.date.startsWith(evYear));
let nextEventId = Math.max(
  existingEvents.reduce((m, e) => Math.max(m, e.id), 0),
  events.reduce((m, e) => Math.max(m, e.id), 0)
) + 1;
const eventIdRemap = {};

events.forEach(e => {
  const newId = nextEventId++;
  eventIdRemap[e.id] = newId;
  existingEvents.push({ ...e, id: newId });
});

// Merge appointments: remove existing for this year, add new
const existingAppts = (existingDb.appointments || []).filter(a => !a.date.startsWith(evYear));
let nextApptId = existingAppts.reduce((m, a) => Math.max(m, a.id), 0) + 1;
appointments.forEach(a => { existingAppts.push({ ...a, id: nextApptId++ }); });

// Merge schedules: remap event IDs, contact IDs, team IDs
const mergedSchedules = {};
// Keep existing schedules for other years' events
Object.entries(existingDb.schedules || {}).forEach(([eid, sched]) => {
  const numEid = parseInt(eid);
  // Keep if event still exists
  if (existingEvents.find(e => e.id === numEid)) mergedSchedules[numEid] = sched;
});
// Add new schedules with remapped IDs
Object.entries(schedules).forEach(([eid, sched]) => {
  const newEid = eventIdRemap[parseInt(eid)];
  if (!newEid) return;
  const remapped = {};
  Object.entries(sched).forEach(([tid, val]) => {
    if (val.type === 'contact') {
      remapped[tid] = { type: 'contact', ids: val.ids.map(remapCid) };
    } else if (val.type === 'team') {
      remapped[tid] = { type: 'team', id: teamIdRemap[val.id] || val.id };
    }
  });
  mergedSchedules[newEid] = remapped;
});

const db = {
  contacts: mergedContacts,
  tasks: mergedTasks,
  teams: mergedTeams,
  events: existingEvents.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
  appointments: existingAppts,
  schedules: mergedSchedules,
  recurring_events: existingDb.recurring_events || {},
  globalSlides: existingDb.globalSlides || [],
  slideLogo: existingDb.slideLogo || '',
  categories: existingDb.categories || [],
};

fs.writeFileSync('data_prod.json', JSON.stringify(db, null, 2));

console.log(`\n── Merged with existing DB (${evYear}) ──`);
console.log(`✓ ${mergedContacts.length} contacts (${mergedContacts.length - (existingDb.contacts||[]).length} new)`);
console.log(`✓ ${existingEvents.length} events`);
console.log(`✓ ${existingAppts.length} appointments`);
console.log(`✓ ${mergedTeams.length} teams`);
console.log(`✓ Schedules for ${Object.keys(mergedSchedules).length} events`);
if (unmatchedNames.size > 0) {
  console.log(`\n⚠ ${unmatchedNames.size} unmatched names:`);
  [...unmatchedNames].sort().forEach(n => console.log(`  - "${n}"`));
}
