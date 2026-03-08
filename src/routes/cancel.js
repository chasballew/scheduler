'use strict';
const express = require('express');
const router = express.Router();
const { cancelByToken } = require('../services/booking');
const emailService = require('../services/email');

function page(title, message, isError = false) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
body{font-family:Arial,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f3f4f6}
.card{background:white;padding:40px;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.1);text-align:center;max-width:420px}
h1{color:${isError ? '#dc2626' : '#111'};margin-top:0}
p{color:#555}a{color:#4F46E5}
</style></head>
<body><div class="card">
<h1>${title}</h1>
<p>${message}</p>
<p><a href="/">Book a new appointment</a></p>
</div></body></html>`;
}

router.get('/', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send(page('Invalid Link', 'The cancel link is missing.', true));

  try {
    const { booking, slot, promoted } = cancelByToken(token);

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

    res.send(page('Appointment Cancelled', 'Your appointment has been successfully cancelled.'));
  } catch (err) {
    if (err.code === 'INVALID_TOKEN') {
      return res.status(404).send(page('Invalid Link', 'This cancel link is invalid or has already been used.', true));
    }
    if (err.message === 'Already cancelled') {
      return res.send(page('Already Cancelled', 'This appointment was already cancelled.'));
    }
    console.error(err);
    res.status(500).send(page('Error', 'Something went wrong. Please try again.', true));
  }
});

module.exports = router;
