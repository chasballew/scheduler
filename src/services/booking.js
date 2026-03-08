'use strict';
const db = require('../db');
const { generateToken } = require('../utils/tokens');

function getSlot(slotId) {
  return db.prepare('SELECT * FROM slots WHERE id = ?').get(slotId);
}

function bookSlot({ slotId, name, email }) {
  const slot = getSlot(slotId);
  if (!slot) throw Object.assign(new Error('Slot not found'), { code: 'NOT_FOUND' });

  const token = generateToken();

  const result = db.transaction(() => {
    const existing = db.prepare(
      "SELECT id FROM bookings WHERE slot_id = ? AND email = ? AND status != 'cancelled'"
    ).get(slotId, email);
    if (existing) throw Object.assign(new Error('Already booked for this slot'), { code: 'DUPLICATE' });

    const { count } = db.prepare(
      "SELECT COUNT(*) as count FROM bookings WHERE slot_id = ? AND status = 'confirmed'"
    ).get(slotId);

    if (count < 2) {
      const row = db.prepare(
        `INSERT INTO bookings (slot_id, name, email, status, cancel_token)
         VALUES (?, ?, ?, 'confirmed', ?)
         RETURNING id`
      ).get(slotId, name, email, token);
      return { status: 'booked', bookingId: row.id, token };
    } else {
      const { maxPos } = db.prepare(
        "SELECT COALESCE(MAX(waitlist_position), 0) as maxPos FROM bookings WHERE slot_id = ? AND status = 'waitlisted'"
      ).get(slotId);
      const position = maxPos + 1;
      const row = db.prepare(
        `INSERT INTO bookings (slot_id, name, email, status, waitlist_position, cancel_token)
         VALUES (?, ?, ?, 'waitlisted', ?, ?)
         RETURNING id`
      ).get(slotId, name, email, position, token);
      return { status: 'waitlisted', position, bookingId: row.id, token };
    }
  })();

  return { result, slot };
}

function cancelBooking(bookingId) {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
  if (!booking) throw Object.assign(new Error('Booking not found'), { code: 'NOT_FOUND' });
  if (booking.status === 'cancelled') throw new Error('Already cancelled');

  const slot = getSlot(booking.slot_id);
  const wasConfirmed = booking.status === 'confirmed';

  const promoted = db.transaction(() => {
    db.prepare(
      "UPDATE bookings SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?"
    ).run(bookingId);

    if (!wasConfirmed) {
      // Renumber remaining waitlist after removed position
      db.prepare(
        `UPDATE bookings SET waitlist_position = waitlist_position - 1, updated_at = datetime('now')
         WHERE slot_id = ? AND status = 'waitlisted' AND waitlist_position > ?`
      ).run(booking.slot_id, booking.waitlist_position);
      return null;
    }

    // Promote first waitlisted entry
    const next = db.prepare(
      "SELECT * FROM bookings WHERE slot_id = ? AND status = 'waitlisted' ORDER BY created_at ASC LIMIT 1"
    ).get(booking.slot_id);

    if (!next) return null;

    db.prepare(
      `UPDATE bookings SET status = 'confirmed', waitlist_position = NULL, updated_at = datetime('now')
       WHERE id = ?`
    ).run(next.id);

    // Renumber remaining waitlist
    db.prepare(
      `UPDATE bookings SET waitlist_position = waitlist_position - 1, updated_at = datetime('now')
       WHERE slot_id = ? AND status = 'waitlisted'`
    ).run(booking.slot_id);

    return next;
  })();

  return { booking, slot, promoted };
}

function cancelByToken(token) {
  const booking = db.prepare('SELECT * FROM bookings WHERE cancel_token = ?').get(token);
  if (!booking) throw Object.assign(new Error('Invalid cancel token'), { code: 'INVALID_TOKEN' });
  return cancelBooking(booking.id);
}

module.exports = { bookSlot, cancelBooking, cancelByToken };
