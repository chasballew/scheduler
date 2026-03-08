# Appointment Booker

A full-stack appointment booking app for reserving 20-minute slots across two days (June 16–17, 2026). Supports 2 attendees per slot, a waitlist with automatic promotion, and reminder emails sent 48 hours before each appointment.

## Stack

- **Backend:** Node.js + Express
- **Database:** SQLite via `better-sqlite3`
- **Email:** Resend
- **Frontend:** React + Vite
- **Hosting:** Railway (SQLite persisted on a volume)

## Local Development

### 1. Install dependencies

```bash
npm install
npm --prefix frontend install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:

| Variable | Description |
|---|---|
| `RESEND_API_KEY` | From [resend.com](https://resend.com) |
| `SENDER_EMAIL` | Verified sender address in Resend |
| `ADMIN_PASSWORD` | Password for the `/admin` dashboard |
| `COOKIE_SECRET` | Random 32+ character string |
| `BASE_URL` | `http://localhost:3000` for local dev |
| `DB_PATH` | Defaults to `./bookings.db` |

### 3. Run

**Option A — backend only** (frontend must be built first):

```bash
npm --prefix frontend run build
npm start
```

**Option B — backend + frontend dev server** (recommended for development):

```bash
# Terminal 1
npm run dev

# Terminal 2
npm --prefix frontend run dev
```

The backend runs on `http://localhost:3000`. The Vite dev server runs on `http://localhost:5173` and proxies `/api` and `/admin/login` to Express.

The database is created and seeded automatically on startup.

## Deployment (Railway)

1. Create a new Railway project and connect this repo.
2. Add a **Volume** mounted at `/data`.
3. Set environment variables in the Railway dashboard (same as above, plus `DB_PATH=/data/bookings.db` and `BASE_URL=https://your-app.railway.app`).
4. Railway will build using the `Dockerfile` and start with `node src/index.js`.

## Routes

### Public

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Booking UI |
| `GET` | `/api/slots` | All slots with availability counts |
| `POST` | `/api/book` | Book a slot or join the waitlist |
| `GET` | `/api/cancel?token=` | One-click cancel from email link |

### Admin

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin` | Admin dashboard (password protected) |
| `POST` | `/admin/login` | Authenticate |
| `GET` | `/api/admin/bookings` | All bookings grouped by day and slot |
| `DELETE` | `/api/admin/bookings/:id` | Cancel any booking |
| `POST` | `/api/admin/book` | Manually add a booking |
| `GET` | `/api/admin/export` | Download all bookings as CSV |

## Schedule

- **Days:** June 16–17, 2026
- **Hours:** 8:00 AM – 4:40 PM
- **Lunch break:** 12:00 PM – 12:40 PM (no slots)
- **Slot duration:** 20 minutes
- **Slots per day:** 24 (48 total)
- **Max attendees per slot:** 2 (overflow goes to waitlist)

## Email Notifications

Emails are sent via Resend for the following events:

- Booking confirmed
- Added to waitlist (includes position number)
- Promoted from waitlist
- Booking cancelled
- Reminder 48 hours before the appointment

If `RESEND_API_KEY` is not set, emails are logged to the console instead of sent.
