'use strict';
const Database = require('better-sqlite3');

const dbPath = process.env.DB_PATH || './bookings.db';
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS slots (
    id TEXT PRIMARY KEY,
    day TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    start_minutes INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    slot_id TEXT NOT NULL REFERENCES slots(id),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('confirmed', 'waitlisted', 'cancelled')),
    waitlist_position INTEGER,
    cancel_token TEXT UNIQUE,
    reminder_sent INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(slot_id, email)
  );

  CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings(slot_id, status);
  CREATE INDEX IF NOT EXISTS idx_bookings_email ON bookings(email);
  CREATE INDEX IF NOT EXISTS idx_bookings_reminder ON bookings(status, reminder_sent);
`);

module.exports = db;
