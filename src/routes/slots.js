'use strict';
const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
  const slots = db.prepare('SELECT * FROM slots ORDER BY day, start_minutes').all();
  const counts = db.prepare(
    `SELECT slot_id, status, COUNT(*) as count
     FROM bookings WHERE status != 'cancelled'
     GROUP BY slot_id, status`
  ).all();

  const lookup = {};
  for (const c of counts) {
    if (!lookup[c.slot_id]) lookup[c.slot_id] = { bookedCount: 0, waitlistCount: 0 };
    if (c.status === 'confirmed') lookup[c.slot_id].bookedCount = c.count;
    if (c.status === 'waitlisted') lookup[c.slot_id].waitlistCount = c.count;
  }

  const result = {};
  for (const slot of slots) {
    if (!result[slot.day]) result[slot.day] = [];
    result[slot.day].push({
      id: slot.id,
      start: slot.start_time,
      end: slot.end_time,
      bookedCount: lookup[slot.id]?.bookedCount || 0,
      waitlistCount: lookup[slot.id]?.waitlistCount || 0,
    });
  }

  res.json(result);
});

module.exports = router;
