# PRD: Appointment Booking System

## Overview

Build a full-stack appointment booking application that allows users to reserve 20-minute appointment slots across two days (June 16–17, 2026). The system supports 2 attendees per slot, a waitlist with automatic promotion on cancellation, and automated reminder emails sent 2 days before each appointment.

A working React frontend prototype already exists (see `appointment-booker.jsx`). This PRD defines the backend, database, email system, and deployment needed to make it production-ready.

---

## Functional Requirements

### Schedule Configuration

- **Dates:** June 16, 2026 (Tuesday) and June 17, 2026 (Wednesday)
- **Slot duration:** 20 minutes
- **Operating hours:** 8:00 AM – 4:40 PM (last slot starts at 4:20 PM)
- **Lunch break:** 12:00 PM – 12:40 PM (no slots during this window)
- **Slots per day:** 24 (12 morning + 12 afternoon)
- **Max attendees per slot:** 2
- **Waitlist:** Unlimited per slot, ordered by sign-up time (FIFO)

### Booking Flow

1. User selects a day and time slot from the calendar view.
2. User enters their full name and email address.
3. If the slot has fewer than 2 confirmed attendees, the user is **booked** immediately.
4. If the slot already has 2 confirmed attendees, the user is added to the **waitlist** with a position number.
5. A user cannot book the same slot twice (deduplicate by email per slot).
6. On successful booking or waitlist join, show a confirmation message and send a confirmation email.

### Cancellation & Waitlist Promotion

1. Users cancel exclusively via the **one-click cancel link** included in every email (confirmation, waitlist, and reminder emails). There is no self-service lookup on the frontend.
2. When a confirmed attendee cancels:
   - The first person on the waitlist (by sign-up timestamp) is automatically **promoted** to confirmed.
   - The promoted attendee receives a notification email informing them they've been moved off the waitlist.
   - All remaining waitlist members have their position numbers decremented.
3. When a waitlisted attendee cancels, they are simply removed from the waitlist.
4. Admins can also cancel any booking from the admin dashboard (see Admin View below).

### Email Notifications

All emails are sent via **Resend** (`resend` npm package). Use a single verified sender address (e.g., `noreply@<yourdomain>`).

#### Email Types

| Trigger | Recipient | Subject Line | Content |
|---|---|---|---|
| Booking confirmed | Attendee | Your appointment is confirmed | Date, time, instructions, cancel link |
| Added to waitlist | Attendee | You're on the waitlist | Position number, date/time, cancel link |
| Promoted from waitlist | Attendee | A spot opened up — you're confirmed! | Date, time, instructions, cancel link |
| Cancellation confirmed | Attendee | Your appointment has been cancelled | Confirmation of cancellation |
| Reminder (2 days before) | All confirmed attendees | Reminder: Your appointment on [date] | Date, time, any prep instructions |

#### Reminder Scheduling

- Reminder emails are sent **2 days (48 hours) before** each appointment's start time.
- For June 16 appointments: reminders go out on June 14 at the corresponding time.
- For June 17 appointments: reminders go out on June 15 at the corresponding time.
- Use a cron job or scheduled task that runs every hour, queries for appointments starting in 47–48 hours, and sends reminders for any that haven't already been sent (track `reminder_sent` flag per booking).

### Admin View

A password-protected admin dashboard at `/admin` for organizers to manage the event.

**Authentication:** Simple shared password stored in the `ADMIN_PASSWORD` environment variable. On visiting `/admin`, the user is prompted for the password. On success, set an `admin_session` cookie (signed, HTTP-only, expires in 24 hours). All `/api/admin/*` routes check this cookie via middleware.

**Admin Dashboard Features:**

1. **Overview grid:** Both days shown side-by-side. Each slot displays confirmed attendees (name + email) and waitlist entries with position numbers. Color-coded by availability (same green/amber/red scheme as the public view).
2. **Slot detail:** Click a slot to see the full list of confirmed and waitlisted attendees with timestamps.
3. **Cancel any booking:** Admin can cancel any confirmed or waitlisted attendee. Triggers the same cancellation + waitlist promotion logic and emails as a self-service cancel.
4. **Manually add a booking:** Admin can add someone to a slot by entering their name and email, bypassing the public form. Sends the same confirmation/waitlist email.
5. **Export to CSV:** A "Download CSV" button that exports all bookings across both days as a CSV file (columns: day, time, name, email, status, waitlist_position, booked_at).
6. **At-a-glance stats:** Total confirmed, total waitlisted, slots with availability, fully booked slots.

**Admin frontend:** A separate React route (`/admin`) or a standalone page. Keep it simple and functional — no need for the same polish as the public booking view. A table-based layout is fine.

---

## Technical Architecture

### Stack

- **Backend:** Node.js with Express
- **Database:** SQLite via `better-sqlite3` (persisted on a Railway volume)
- **Email:** Resend (`resend` npm package)
- **Scheduler:** `node-cron` for reminder job
- **Frontend:** React (existing prototype) built with Vite, served as static files by Express
- **Hosting:** Railway (single service, volume-mounted SQLite)

### API Endpoints

#### Public

```
GET    /api/slots
       → Returns all slots with booking counts and waitlist counts.
       → Response: { "2026-06-16": [ { start, end, bookedCount, waitlistCount } ], ... }

POST   /api/book
       → Body: { day, start, name, email }
       → Books the user or adds to waitlist.
       → Returns: { status: "booked" | "waitlisted", position?: number }
       → Sends confirmation or waitlist email via Resend.

GET    /api/cancel?token=<token>
       → One-click cancel link for use in emails.
       → Token is a signed JWT or HMAC containing booking ID.
       → Performs cancellation + waitlist promotion.
       → Renders a simple "Cancelled successfully" confirmation page.
```

#### Admin (all require `admin_session` cookie)

```
POST   /admin/login
       → Body: { password }
       → Validates against ADMIN_PASSWORD env var.
       → Sets signed admin_session cookie. Returns 200 or 401.

GET    /api/admin/bookings
       → Returns all bookings grouped by day and slot.
       → Includes attendee names, emails, statuses, waitlist positions, timestamps.

DELETE /api/admin/bookings/:id
       → Cancels any booking by ID.
       → Triggers waitlist promotion + sends cancellation/promotion emails.

POST   /api/admin/book
       → Body: { day, start, name, email }
       → Manually add someone to a slot. Same logic as public /api/book.

GET    /api/admin/export
       → Returns all bookings as a downloadable CSV file.
```

### Database Schema

```sql
CREATE TABLE slots (
  id TEXT PRIMARY KEY,          -- e.g., "2026-06-16::8:00 AM"
  day TEXT NOT NULL,             -- "2026-06-16"
  start_time TEXT NOT NULL,      -- "8:00 AM"
  end_time TEXT NOT NULL,        -- "8:20 AM"
  start_minutes INTEGER NOT NULL -- minutes since midnight, for sorting
);

CREATE TABLE bookings (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  slot_id TEXT NOT NULL REFERENCES slots(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('confirmed', 'waitlisted', 'cancelled')),
  waitlist_position INTEGER,     -- NULL if confirmed, 1-based if waitlisted
  cancel_token TEXT UNIQUE,      -- signed token for one-click cancel links
  reminder_sent INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(slot_id, email)         -- prevent duplicate bookings per slot
);

CREATE INDEX idx_bookings_slot ON bookings(slot_id, status);
CREATE INDEX idx_bookings_email ON bookings(email);
CREATE INDEX idx_bookings_reminder ON bookings(status, reminder_sent);
```

### Seed Script

Write a seed script that pre-populates the `slots` table with all 48 slots (24 per day) based on the schedule configuration. This runs once at setup.

---

## Email Templates

Use simple, clean HTML email templates. Each email should include:

- A clear subject line (see table above)
- The appointment date and time in a prominent heading
- A one-click cancel link using the `cancel_token`
- A footer with contact info or support email

Keep templates inline in the codebase (no external template engine needed). Use a helper function like `renderEmail(templateName, variables)` that returns HTML.

---

## Concurrency & Edge Cases

- **Race conditions on booking:** Use a database transaction when booking. Within the transaction: count confirmed bookings for the slot, and either insert as confirmed or waitlisted. SQLite's write lock makes this straightforward.
- **Race conditions on cancellation:** Wrap cancel + promote in a single transaction.
- **Duplicate submissions:** The `UNIQUE(slot_id, email)` constraint prevents double-booking. Return a friendly error if violated.
- **Waitlist promotion ordering:** Always promote the waitlisted entry with the earliest `created_at` timestamp.
- **Stale frontend data:** The frontend polls `/api/slots` every 8 seconds. Acceptable for this scale.

---

## Project Structure

```
appointment-booker/
├── package.json
├── .env.example              # RESEND_API_KEY, BASE_URL, PORT, ADMIN_PASSWORD
├── Dockerfile
├── railway.toml              # Railway config (start command, volume mount)
├── src/
│   ├── index.js              # Express app entry point
│   ├── db.js                 # Database connection and helpers
│   ├── seed.js               # Slot generation seed script
│   ├── routes/
│   │   ├── slots.js          # GET /api/slots
│   │   ├── bookings.js       # POST /api/book
│   │   ├── cancel.js         # GET /api/cancel?token=
│   │   └── admin.js          # POST /admin/login, GET/DELETE /api/admin/*
│   ├── middleware/
│   │   └── adminAuth.js      # Cookie-based admin session check
│   ├── services/
│   │   ├── booking.js        # Core booking/cancel/promote logic
│   │   └── email.js          # Email sending via Resend
│   ├── jobs/
│   │   └── reminders.js      # Cron job for 48-hour reminders
│   ├── templates/
│   │   ├── confirmed.html
│   │   ├── waitlisted.html
│   │   ├── promoted.html
│   │   ├── cancelled.html
│   │   └── reminder.html
│   └── utils/
│       └── tokens.js         # Cancel token generation/verification
├── public/                   # Built React frontend (static files)
│   └── index.html
├── frontend/                 # React source (Vite)
│   ├── src/
│   │   ├── App.jsx           # Public booking view (adapted from prototype)
│   │   └── Admin.jsx         # Admin dashboard
│   ├── package.json
│   └── vite.config.js
└── README.md
```

---

## Frontend Adaptation

### Public Booking View (`App.jsx`)

The existing `appointment-booker.jsx` prototype needs these changes to work with the backend:

1. **Replace `window.storage` calls** with `fetch()` calls to the API endpoints.
2. **`loadBookings()`** → `GET /api/slots` and transform the response into the same shape the UI expects.
3. **`confirmBook()`** → `POST /api/book` with `{ day, start, name, email }`.
4. **Remove the "My Bookings" button and modal entirely.** Cancellation is handled via email links only.
5. **Remove polling interval** or keep it hitting `/api/slots` every 8–10 seconds.
6. **Add a Vite config** that proxies `/api` to the Express server in development.

### Admin View (`Admin.jsx`)

A separate route at `/admin` with:

1. **Login screen:** Single password field. On submit, `POST /admin/login`. On success, redirects to the dashboard.
2. **Dashboard:** Two-column layout (one per day). Each slot is a row showing time, confirmed attendees, waitlist. Clicking expands the full detail.
3. **Actions:** Cancel buttons per attendee, "Add booking" form per slot, "Export CSV" button in the header.
4. **Stats bar:** Total confirmed, total waitlisted, open slots count.

---

## Environment Variables

```
PORT=3000
BASE_URL=http://localhost:3000         # Used in email cancel links; set to Railway URL in prod
RESEND_API_KEY=re_xxxxxxxxxxxxx        # From resend.com
SENDER_EMAIL=noreply@yourdomain.com
ADMIN_PASSWORD=change-me-to-something-strong
COOKIE_SECRET=random-32-char-string    # For signing the admin session cookie
DB_PATH=./bookings.db                  # Set to /data/bookings.db on Railway
```

---

## Deployment (Railway)

The app deploys to **Railway** as a single service. Express serves both the API and the built React static files.

### Railway Setup

1. Create a new project on Railway and connect the GitHub repo.
2. Add a **Volume** mounted at `/data` for persistent SQLite storage. The app should store `bookings.db` at `/data/bookings.db` (use `DB_PATH` env var with default `./bookings.db` for local dev).
3. Set all environment variables in the Railway dashboard (see Environment Variables above). Set `BASE_URL` to the Railway-provided public URL.
4. Railway auto-detects Node.js. The build command and start command can be configured in `railway.toml`.

### `railway.toml`

```toml
[build]
builder = "dockerfile"

[deploy]
startCommand = "node src/index.js"
healthcheckPath = "/api/slots"
restartPolicyType = "ON_FAILURE"
```

### Dockerfile

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
WORKDIR /app/frontend
RUN npm ci && npm run build
RUN cp -r dist/* ../public/
WORKDIR /app
EXPOSE 3000
CMD ["node", "src/index.js"]
```

### Volume Configuration

In `db.js`, resolve the database path like this:

```javascript
const dbPath = process.env.DB_PATH || './bookings.db';
const db = new Database(dbPath);
```

Set `DB_PATH=/data/bookings.db` in Railway's environment variables so the database persists across deploys.

---

## Acceptance Criteria

1. A user can view available slots for both days with real-time availability.
2. A user can book an open slot by providing name and email → receives confirmation email via Resend.
3. A user who books a full slot is added to the waitlist → receives waitlist email with position number.
4. A user can cancel via the one-click cancel link in their email.
5. When a confirmed attendee cancels, the top waitlisted person is promoted → receives promotion email.
6. Reminder emails are sent 48 hours before each appointment to all confirmed attendees.
7. Duplicate bookings (same email + same slot) are rejected with a clear message.
8. The system handles concurrent requests safely (no overbooking beyond 2 per slot).
9. An admin can log in at `/admin` with a shared password.
10. The admin dashboard shows all bookings across both days with names, emails, and statuses.
11. An admin can cancel any booking, manually add attendees, and export all bookings to CSV.
12. The app deploys to Railway as a single service with persistent SQLite via a volume mount.

---

## Out of Scope (for now)

- User accounts / OAuth login (admin uses a shared password, attendees use email links)
- Self-service "My Bookings" lookup on the frontend (users manage via email cancel links)
- Calendar integration (`.ics` file attachments could be a nice follow-up)
- SMS notifications
- Recurring or multi-week scheduling
- Timezone handling (all times are assumed to be in a single local timezone)