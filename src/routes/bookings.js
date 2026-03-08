'use strict';
const express = require('express');
const router = express.Router();
const { bookSlot } = require('../services/booking');
const emailService = require('../services/email');

router.post('/', async (req, res) => {
  const { day, start, name, email } = req.body;

  if (!day || !start || !name || !email) {
    return res.status(400).json({ error: 'Missing required fields: day, start, name, email' });
  }

  const slotId = `${day}::${start}`;

  try {
    const { result, slot } = bookSlot({ slotId, name, email });

    const emailData = {
      to: email,
      name,
      day: slot.day,
      startTime: slot.start_time,
      endTime: slot.end_time,
      cancelToken: result.token,
    };

    if (result.status === 'booked') {
      emailService.sendConfirmed(emailData).catch(console.error);
      return res.json({ status: 'booked' });
    } else {
      emailService.sendWaitlisted({ ...emailData, position: result.position }).catch(console.error);
      return res.json({ status: 'waitlisted', position: result.position });
    }
  } catch (err) {
    if (err.code === 'DUPLICATE') return res.status(409).json({ error: err.message });
    if (err.code === 'NOT_FOUND') return res.status(404).json({ error: 'Slot not found' });
    console.error(err);
    res.status(500).json({ error: 'Booking failed' });
  }
});

module.exports = router;
