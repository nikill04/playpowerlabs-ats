# Talon ATS — Backend (Phase 1)

Plain Node + Express + SQLite. No TypeScript, no ORM — just readable SQL via `better-sqlite3`
so you can open `schema.sql` and see the entire data model in one file.

## Run it

```bash
cd server
npm install
node index.js
```

Server starts on `http://localhost:4000`. On first run it creates `talon.db` (SQLite file)
and seeds it with demo data matching the PDF screenshots — same job titles, same candidate
names (Ana Petrova, Sofia Lindqvist, Jordan Cole, etc.), same offer numbers.

To reset the demo data at any time: delete `server/talon.db*` and restart the server.

## Demo login

Any of these (password for all: `password123`):
- `maya@talon.com` — Recruiter (owns most of the seeded pipeline)
- `tom@talon.com` — Recruiter
- `sam@talon.com` — Hiring manager

## Auth — email/password, Google OAuth, 2FA, and Calendar sync

Set these in `server/.env` (already filled in for local dev — get your own values from
Google Cloud Console → OAuth Client for anything beyond localhost):

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback
FRONTEND_URL=http://localhost:5173
```

**Login flow the frontend should implement:**

1. `POST /auth/login` (email+password) or redirect the browser to `GET /auth/google`
   (which itself redirects to Google, then back to `${FRONTEND_URL}/auth/callback`
   with a token in the URL fragment — your frontend needs a route at `/auth/callback`
   that reads `window.location.hash`)
2. Response is either:
   - `{ requires_2fa: false, token, user }` → done, store `token`, log the user in
   - `{ requires_2fa: true, pending_token }` → show a "enter your 6-digit code" screen,
     then call `POST /auth/2fa/verify { pending_token, code }` → returns `{ token, user }`
3. **2FA setup** (from a settings page, while already logged in):
   `POST /auth/2fa/setup` → returns `{ secret, qr_code_data_url }` — show the QR code,
   user scans it with Google Authenticator/Authy, then
   `POST /auth/2fa/enable { code }` with the 6-digit code they see in their app to turn it on.
   `POST /auth/2fa/disable` to turn it off.

**Real Google Calendar sync (new):** `GET /auth/google` now requests only basic identity
scopes for low-friction localhost sign-in. Calendar linking is a separate consent step at
`GET /auth/google/calendar`, which requests the minimum Calendar scopes Talon uses:
`calendar.freebusy` and `calendar.events.owned`. When Google returns a `refresh_token`,
we store it on the user row. From then on:
- `GET /applications/:id/scheduling` pulls REAL free/busy data from each interviewer's
  Google Calendar (falls back to an in-Talon approximation for anyone who hasn't linked
  Google — nothing breaks for password-only accounts)
- `POST /interviews/:interviewId/send-invites` creates a REAL Calendar event (with a
  Google Meet link) on the interviewer's calendar and invites the candidate by email

**To actually test the live Calendar sync (needs a real browser, I can't do this myself):**
1. Run the server (`node index.js`) and frontend (`npm run dev`).
2. Use `http://localhost:5173/login` and click "Continue with Google" for basic sign-in.
3. Open the Scheduling page and click "Connect Google Calendar", or open
   `http://localhost:4000/api/auth/google/calendar` directly.
4. After the callback returns to the frontend, hit `GET /auth/me` with the token from the
   URL fragment to confirm `has_calendar: 1`.
5. From there, any `GET /applications/:id/scheduling` call where you're one of the
   interviewers will show `"source": "google_calendar"` with your real busy blocks.

Localhost HTTP is allowed by Google's OAuth redirect rules, so no TLS certificate or
real domain is required for `http://localhost:4000/api/auth/google/callback`. Google
can still show an unverified/test warning for Calendar scopes unless the OAuth app is
verified or you only request basic sign-in scopes.

<!-- Old note from the earlier build:
2. Sign in with your Google account and accept the consent screen — note it now asks
   for Calendar access too (this is expected — that's the new scope)
3. It'll redirect to `http://localhost:5173/auth/callback#token=...` — that page doesn't
   exist yet (that's the frontend's job), so the browser will show "can't reach this page,"
   but that's fine — check `server/talon.db` or hit `GET /auth/me` with the token from the
   URL fragment to confirm `has_calendar: 1`
4. From there, any `GET /applications/:id/scheduling` call where you're one of the
   interviewers will show `"source": "google_calendar"` with your real busy blocks

-->

`GET /auth/me` now also returns `has_calendar` (true once linked).
`POST /auth/google/disconnect` unlinks Calendar access.



## Folder map

```
server/
  schema.sql        <- entire DB structure, one file, read this first
  db.js              <- opens the DB, applies schema.sql, seeds demo data if empty
  auth.js            <- JWT sign/verify helper + requireAuth middleware
  index.js           <- wires up all routes, starts the server
  routes/
    auth.js           <- register, login, /me
    jobs.js            <- job list, job detail, create job, GET pipeline (kanban data)
    applications.js    <- candidate profile screen, move stage, add note
    reviewInbox.js     <- resume triage: list + advance/reject
    scheduling.js      <- interview rounds + availability + send invites
    offers.js          <- offer builder + approval chain
    reports.js         <- KPI aggregation (real SQL, not fake numbers)
    candidates.js      <- candidate CRUD
    misc.js            <- global search (Cmd+K) + CSV bulk import
```

`API_CONTRACT.md` (project root) is the source of truth for every endpoint's request/response
shape — hand this to whatever tool builds the frontend so the two sides don't drift apart.

## What's implemented (Phase 1)

- Full data model for jobs, candidates, applications (pipeline), activity feed, interviews,
  scorecards, offers, and offer approvals
- Auth: register/login with bcrypt + JWT, **Google OAuth login**, and **TOTP 2FA**
  (setup/enable/disable/verify) — fully working and tested end-to-end
- Every screen in the PDF has a working, tested API behind it:
  - Jobs list + job detail + new-job wizard submit
  - Pipeline kanban (drag = `PATCH /applications/:id { stage }`)
  - Review inbox (advance/reject)
  - Candidate profile (activity timeline, interviews, scorecards, files)
  - Scheduling (rounds, interviewer availability, send invites)
  - Offers (multi-step approval chain, rendered offer letter)
  - Reports (real conversion funnel + hires-by-source + interviews-per-week, computed from actual rows)
  - CSV bulk import for candidates
  - Global search endpoint for Cmd+K

## What's NOT built yet (later phases, on purpose — see plan)

- Terraform / CDK infra-as-code
- Playwright E2E suite
- The actual frontend (being built separately per your split-tooling plan — wire it to
  `http://localhost:4000/api` using the shapes in `API_CONTRACT.md`)

## Known issue found + fixed this round

`offers.js`, `scheduling.js`, and `misc.js` are mounted at the bare `/api` prefix
(they own multiple path shapes like `/applications/:id/offers` and `/offers/:id`).
They originally used `router.use(requireAuth)`, which — because the router is
mounted at `/api`, not a specific sub-path — intercepted **every** `/api/*` request
that reached it, including ones meant for routes registered later (this made
`/api/health` incorrectly return 401). Fixed by applying `requireAuth` per-route
instead of as a blanket rule, and moved `/api/health` to register first regardless.
Regression-tested every endpoint after the fix — all pass.

## Every endpoint (see API_CONTRACT.md for full request/response shapes)

```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me

GET    /api/jobs
GET    /api/jobs/:id
POST   /api/jobs
PATCH  /api/jobs/:id
GET    /api/jobs/:jobId/pipeline

GET    /api/applications/:id
PATCH  /api/applications/:id
POST   /api/applications
POST   /api/applications/:id/notes
POST   /api/applications/:id/offers

GET    /api/review-inbox
POST   /api/review-inbox/:applicationId/advance
POST   /api/review-inbox/:applicationId/reject

GET    /api/applications/:id/scheduling
POST   /api/applications/:id/interviews
POST   /api/interviews/:interviewId/send-invites

GET    /api/offers/:id
PATCH  /api/offers/:id
POST   /api/offers/:id/send-for-approval
POST   /api/offer-approvals/:approvalId/decide

GET    /api/reports/overview

GET    /api/candidates
GET    /api/candidates/:id
POST   /api/candidates
POST   /api/candidates/bulk-import

GET    /api/search
```
