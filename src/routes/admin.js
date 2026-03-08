'use strict';
const express = require('express');
const db = require('../db');
const { cancelBooking, bookSlot } = require('../services/booking');
const emailService = require('../services/email');

const apiRouter = express.Router();

// GET /api/admin/bookings
apiRouter.get('/bookings', (req, res) => {
  const slots = db.prepare('SELECT * FROM slots ORDER BY day, start_minutes').all();
  const bookings = db.prepare(
    "SELECT * FROM bookings WHERE status != 'cancelled' ORDER BY created_at ASC"
  ).all();

  const bySlot = {};
  for (const b of bookings) {
    if (!bySlot[b.slot_id]) bySlot[b.slot_id] = { confirmed: [], waitlisted: [] };
    if (b.status === 'confirmed') bySlot[b.slot_id].confirmed.push(b);
    else bySlot[b.slot_id].waitlisted.push(b);
  }

  const result = {};
  for (const slot of slots) {
    if (!result[slot.day]) result[slot.day] = [];
    result[slot.day].push({
      ...slot,
      confirmed: bySlot[slot.id]?.confirmed || [],
      waitlisted: bySlot[slot.id]?.waitlisted || [],
    });
  }

  res.json(result);
});

// DELETE /api/admin/bookings/:id
apiRouter.delete('/bookings/:id', async (req, res) => {
  try {
    const { booking, slot, promoted } = cancelBooking(req.params.id);

    emailService.sendCancelled({
      to: booking.email,
      name: booking.name,
      day: slot.day,
      startTime: slot.start_time,
      endTime: slot.end_time,
    }).catch(console.error);

    if (promoted) {
      emailService.sendPromoted({
        to: promoted.email,
        name: promoted.name,
        day: slot.day,
        startTime: slot.start_time,
        endTime: slot.end_time,
        cancelToken: promoted.cancel_token,
      }).catch(console.error);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/admin/book
apiRouter.post('/book', async (req, res) => {
  const { day, start, name, email } = req.body;
  if (!day || !start || !name || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const slotId = `${day}::${start}`;
  try {
    const { result, slot } = bookSlot({ slotId, name, email });
    const emailData = {
      to: email, name,
      day: slot.day,
      startTime: slot.start_time,
      endTime: slot.end_time,
      cancelToken: result.token,
    };
    if (result.status === 'booked') {
      emailService.sendConfirmed(emailData).catch(console.error);
      res.json({ status: 'booked' });
    } else {
      emailService.sendWaitlisted({ ...emailData, position: result.position }).catch(console.error);
      res.json({ status: 'waitlisted', position: result.position });
    }
  } catch (err) {
    if (err.code === 'DUPLICATE') return res.status(409).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/export
apiRouter.get('/export', (req, res) => {
  const rows = db.prepare(`
    SELECT s.day, s.start_time, s.end_time, b.name, b.email, b.status, b.waitlist_position, b.created_at
    FROM bookings b
    JOIN slots s ON s.id = b.slot_id
    WHERE b.status != 'cancelled'
    ORDER BY s.day, s.start_minutes, b.created_at
  `).all();

  const header = 'day,time,name,email,status,waitlist_position,booked_at\n';
  const csv = rows.map(r =>
    [r.day, `${r.start_time} - ${r.end_time}`, `"${r.name.replace(/"/g, '""')}"`, r.email, r.status, r.waitlist_position || '', r.created_at].join(',')
  ).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="bookings.csv"');
  res.send(header + csv);
});

// POST /admin/login (no auth required)
function login(req, res) {
  const { password } = req.body;
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  res.cookie('admin_session', 'authenticated', {
    signed: true,
    httpOnly: true,
    maxAge: 86400000,
    sameSite: 'strict',
  });
  res.json({ success: true });
}

module.exports = { login, apiRouter };
