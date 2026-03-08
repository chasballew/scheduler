'use strict';
const cron = require('node-cron');
const db = require('../db');
const emailService = require('../services/email');

function parseSlotDatetime(day, timeStr) {
  // timeStr like "8:00 AM" or "1:20 PM"
  const [time, period] = timeStr.split(' ');
  let [h, m] = time.split(':').map(Number);
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  const [year, month, dayNum] = day.split('-').map(Number);
  return new Date(year, month - 1, dayNum, h, m, 0);
}

function sendReminders() {
  const now = new Date();
  const bookings = db.prepare(`
    SELECT b.*, s.day, s.start_time, s.end_time
    FROM bookings b
    JOIN slots s ON s.id = b.slot_id
    WHERE b.status = 'confirmed' AND b.reminder_sent = 0
  `).all();

  for (const booking of bookings) {
    const slotTime = parseSlotDatetime(booking.day, booking.start_time);
    const diffHours = (slotTime - now) / (1000 * 60 * 60);

    if (diffHours >= 47 && diffHours <= 48) {
      emailService.sendReminder({
        to: booking.email,
        name: booking.name,
        day: booking.day,
        startTime: booking.start_time,
        endTime: booking.end_time,
        cancelToken: booking.cancel_token,
      }).then(() => {
        db.prepare('UPDATE bookings SET reminder_sent = 1, updated_at = datetime(\'now\') WHERE id = ?').run(booking.id);
        console.log(`Reminder sent to ${booking.email} for ${booking.day} ${booking.start_time}`);
      }).catch(err => {
        console.error(`Failed to send reminder to ${booking.email}:`, err);
      });
    }
  }
}

function start() {
  // Run at the top of every hour
  cron.schedule('0 * * * *', () => {
    console.log('[reminders] Running reminder job...');
    sendReminders();
  });
  console.log('[reminders] Scheduled (hourly)');
}

module.exports = { start, sendReminders };
