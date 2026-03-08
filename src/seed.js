'use strict';
require('dotenv').config();
const db = require('./db');

function minutesToTimeString(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h < 12 ? 'AM' : 'PM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
}

function seed() {
  const days = ['2026-06-16', '2026-06-17'];
  const slotMinutes = [];

  // Morning: 8:00 AM (480) to 11:40 AM (700), step 20
  for (let m = 480; m <= 700; m += 20) slotMinutes.push(m);
  // Afternoon: 12:40 PM (760) to 4:20 PM (980), step 20
  for (let m = 760; m <= 980; m += 20) slotMinutes.push(m);

  const insert = db.prepare(`
    INSERT OR IGNORE INTO slots (id, day, start_time, end_time, start_minutes)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertAll = db.transaction(() => {
    for (const day of days) {
      for (const startMin of slotMinutes) {
        const startTime = minutesToTimeString(startMin);
        const endTime = minutesToTimeString(startMin + 20);
        const id = `${day}::${startTime}`;
        insert.run(id, day, startTime, endTime, startMin);
      }
    }
  });

  insertAll();
}

module.exports = { seed };

// Run directly: node src/seed.js
if (require.main === module) {
  seed();
  console.log('Slots seeded successfully');
}
