const fs = require('fs');

const CSV_FILE = 'contact.csv';
const DB_FILE = 'data_prod.json';

const csv = fs.readFileSync(CSV_FILE, 'utf8').trim().split('\n');
const header = csv[0].split(',').map(h => h.trim().toLowerCase());
const rows = csv.slice(1).map(line => {
  const parts = line.split(',').map(s => s.trim());
  return { name: parts[header.indexOf('name')] || '', phone: parts[header.indexOf('phone')] || '', email: parts[header.indexOf('email')] || '' };
}).filter(r => r.name);

const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));

let updated = 0, skipped = 0;

rows.forEach(row => {
  const match = db.contacts.find(c => c.name.toLowerCase() === row.name.toLowerCase());
  if (match) {
    if (row.email && !match.email) { match.email = row.email; updated++; }
    else if (row.email && match.email !== row.email) { match.email = row.email; updated++; }
    if (row.phone && !match.phone) { match.phone = row.phone; updated++; }
    else if (row.phone && match.phone !== row.phone) { match.phone = row.phone; updated++; }
  } else {
    const maxId = db.contacts.reduce((m, c) => Math.max(m, c.id), 0) + 1;
    db.contacts.push({ id: maxId, name: row.name, email: row.email, phone: row.phone });
    updated++;
    console.log(`  + NEW: ${row.name}`);
  }
});

// Show unmatched names from CSV
const csvNames = new Set(rows.map(r => r.name.toLowerCase()));
const dbOnly = db.contacts.filter(c => !csvNames.has(c.name.toLowerCase()) && !c.email);
if (dbOnly.length > 0) {
  console.log(`\n${dbOnly.length} contacts in DB without CSV match or email:`);
  dbOnly.slice(0, 20).forEach(c => console.log(`  - ${c.name}`));
  if (dbOnly.length > 20) console.log(`  ... and ${dbOnly.length - 20} more`);
}

fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
console.log(`\nDone. ${updated} updates, ${db.contacts.length} total contacts.`);
