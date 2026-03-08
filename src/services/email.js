'use strict';
const { Resend } = require('resend');

let _resend = null;
function getResend() {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) {
      console.warn('[email] RESEND_API_KEY not set — emails will be logged only');
      return null;
    }
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const SENDER = process.env.SENDER_EMAIL || 'noreply@example.com';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

function cancelLink(token) {
  return `${BASE_URL}/api/cancel?token=${token}`;
}

async function send(payload) {
  const client = getResend();
  if (!client) {
    console.log('[email] Would send:', payload.to, payload.subject);
    return;
  }
  return client.emails.send(payload);
}

function baseTemplate(content) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333}
.header{background:#4F46E5;color:white;padding:20px;border-radius:8px 8px 0 0}
.body{background:#f9f9f9;padding:20px;border:1px solid #ddd;border-top:none}
.footer{text-align:center;padding:16px;color:#888;font-size:12px}
.appt{background:white;border-left:4px solid #4F46E5;padding:14px 18px;margin:16px 0;border-radius:0 8px 8px 0}
.btn{display:inline-block;padding:11px 22px;background:#dc2626;color:white;text-decoration:none;border-radius:6px;margin:12px 0}
</style></head><body>${content}</body></html>`;
}

async function sendConfirmed({ to, name, day, startTime, endTime, cancelToken }) {
  const html = baseTemplate(`
    <div class="header"><h2 style="margin:0">Your appointment is confirmed</h2></div>
    <div class="body">
      <p>Hi ${name},</p>
      <p>Your appointment has been confirmed!</p>
      <div class="appt"><strong>${day}</strong><br>${startTime} – ${endTime}</div>
      <p>Need to cancel?</p>
      <a class="btn" href="${cancelLink(cancelToken)}">Cancel Appointment</a>
    </div>
    <div class="footer">Questions? Reply to this email for support.</div>`);
  return send({ from: SENDER, to, subject: 'Your appointment is confirmed', html });
}

async function sendWaitlisted({ to, name, day, startTime, endTime, position, cancelToken }) {
  const html = baseTemplate(`
    <div class="header"><h2 style="margin:0">You're on the waitlist</h2></div>
    <div class="body">
      <p>Hi ${name},</p>
      <p>You've been added to the waitlist:</p>
      <div class="appt"><strong>${day}</strong><br>${startTime} – ${endTime}<br><em>Waitlist position: #${position}</em></div>
      <p>We'll notify you if a spot opens up. Want to leave the waitlist?</p>
      <a class="btn" href="${cancelLink(cancelToken)}">Leave Waitlist</a>
    </div>
    <div class="footer">Questions? Reply to this email for support.</div>`);
  return send({ from: SENDER, to, subject: "You're on the waitlist", html });
}

async function sendPromoted({ to, name, day, startTime, endTime, cancelToken }) {
  const html = baseTemplate(`
    <div class="header"><h2 style="margin:0">A spot opened up — you're confirmed!</h2></div>
    <div class="body">
      <p>Hi ${name},</p>
      <p>Great news — you've been moved off the waitlist and confirmed!</p>
      <div class="appt"><strong>${day}</strong><br>${startTime} – ${endTime}</div>
      <p>Need to cancel?</p>
      <a class="btn" href="${cancelLink(cancelToken)}">Cancel Appointment</a>
    </div>
    <div class="footer">Questions? Reply to this email for support.</div>`);
  return send({ from: SENDER, to, subject: "A spot opened up — you're confirmed!", html });
}

async function sendCancelled({ to, name, day, startTime, endTime }) {
  const html = baseTemplate(`
    <div class="header"><h2 style="margin:0">Your appointment has been cancelled</h2></div>
    <div class="body">
      <p>Hi ${name},</p>
      <p>Your appointment has been cancelled:</p>
      <div class="appt"><strong>${day}</strong><br>${startTime} – ${endTime}</div>
      <p>Feel free to book a new appointment if you'd like.</p>
    </div>
    <div class="footer">Questions? Reply to this email for support.</div>`);
  return send({ from: SENDER, to, subject: 'Your appointment has been cancelled', html });
}

async function sendReminder({ to, name, day, startTime, endTime, cancelToken }) {
  const html = baseTemplate(`
    <div class="header"><h2 style="margin:0">Reminder: Your appointment on ${day}</h2></div>
    <div class="body">
      <p>Hi ${name},</p>
      <p>Just a reminder about your upcoming appointment:</p>
      <div class="appt"><strong>${day}</strong><br>${startTime} – ${endTime}</div>
      <p>Need to cancel?</p>
      <a class="btn" href="${cancelLink(cancelToken)}">Cancel Appointment</a>
    </div>
    <div class="footer">Questions? Reply to this email for support.</div>`);
  return send({ from: SENDER, to, subject: `Reminder: Your appointment on ${day}`, html });
}

module.exports = { sendConfirmed, sendWaitlisted, sendPromoted, sendCancelled, sendReminder };
