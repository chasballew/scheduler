'use strict';
require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const { seed } = require('./seed');
const adminAuth = require('./middleware/adminAuth');
const { login: adminLogin, apiRouter: adminApiRouter } = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.COOKIE_SECRET || 'dev-secret-change-in-production'));

// Seed slots on startup (idempotent)
seed();

// Public API routes
app.use('/api/slots', require('./routes/slots'));
app.use('/api/book', require('./routes/bookings'));
app.use('/api/cancel', require('./routes/cancel'));

// Admin login (no auth)
app.post('/admin/login', adminLogin);

// Admin API routes (auth required)
app.use('/api/admin', adminAuth, adminApiRouter);

// Serve React frontend static files
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

// SPA fallback — let React Router handle all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Start reminder cron job
require('./jobs/reminders').start();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
