# Talon API Contract (v1)

Base URL: `http://localhost:4000/api`
Auth: `Authorization: Bearer <jwt>` header on all routes except `/auth/*`.
All responses are JSON. Errors: `{ "error": "message" }` with appropriate status code.

---

## Auth

### POST /auth/register
Body: `{ name, email, password }`
Returns: `{ requires_2fa: false, token, user: { id, name, email, role } }`

### POST /auth/login
Body: `{ email, password }`
Returns EITHER:
- `{ requires_2fa: false, token, user }` — done, log the user in
- `{ requires_2fa: true, pending_token }` — show a 6-digit code screen, then call `/auth/2fa/verify`

### GET /auth/google
No body. Frontend does `window.location = "http://localhost:4000/api/auth/google"`.
Requests only basic Google identity scopes for sign-in.
Redirects through Google, then back to `${FRONTEND_URL}/auth/callback#token=...`
(or `#pending_token=...&requires_2fa=true`, or `#error=...`).
Frontend needs a route at `/auth/callback` that reads `window.location.hash`.

### GET /auth/google/calendar
No body. Frontend redirects to this when the user chooses to link Google Calendar.
Requests Calendar free/busy and owned-event scopes with offline access, then redirects
back to `${FRONTEND_URL}/auth/callback#token=...` after storing the refresh token.

### POST /auth/2fa/verify
Body: `{ pending_token, code }`
Returns: `{ token, user }`

### POST /auth/2fa/setup  (requires auth)
Returns: `{ secret, qr_code_data_url }` — render the QR code for the user to scan

### POST /auth/2fa/enable  (requires auth)
Body: `{ code }` — the 6-digit code from their authenticator app
Returns: `{ ok: true }`

### POST /auth/2fa/disable  (requires auth)
Returns: `{ ok: true }`

### POST /auth/google/disconnect  (requires auth)
Unlinks Calendar access (deletes the stored refresh token). Returns: `{ ok: true }`

### GET /auth/me
Returns: `{ id, name, email, role, avatar_color, totp_enabled, has_google, has_calendar }`

---

## Jobs

### GET /jobs
Query: `?status=Active`
Returns: `[{ id, code, title, department, location, status, band_min, band_max,
  hiring_manager: {id,name}, counts: { in_process, active }, pipeline: [{stage, count}] }]`

### GET /jobs/:id
Returns full job detail incl. pipeline stage summary.

### POST /jobs
Body: `{ title, department, location, band_min, band_max, hiring_manager_id }`
Returns created job. (Wizard steps are FE-only; this is the final submit.)

### PATCH /jobs/:id
Body: any subset of job fields (e.g. `{ status: "On hold" }`)

---

## Pipeline / Applications

### GET /jobs/:jobId/pipeline
Returns: `{ stages: [ { stage: "Applied", median_days: 2, pass_rate: 1.0, closed: false,
  applications: [ { id, candidate: {id,name,current_title,current_company},
  tags: [...], days_in_stage, rating, next_action } ] } ] }`
`pass_rate` is the fraction (0–1) of this job's active (non-rejected) applications that have
reached this stage or further. `closed: true` on the Hired stage means "no further pass rate" —
show it as closed/terminal in the UI rather than a percentage. `next_action` is a short string
like `"Values round with Maya Reyes is still unconfirmed"` or `null` if nothing's blocking.

### GET /applications/:id
Returns full application incl. candidate, job, activity, interviews, scorecards, files, and
`next_action` (same string shown on the pipeline card — see GET /jobs/:jobId/pipeline).

### PATCH /applications/:id
Body: `{ stage }` — moves card between kanban columns (also writes activity_log row server-side)

### POST /applications
Body: `{ candidate_id, job_id }` — add existing/new candidate to a job pipeline

### POST /applications/:id/notes
Body: `{ message }` — adds a note to activity feed

---

## Review Inbox

### GET /review-inbox
Returns: `[ { application_id, candidate: {...}, cover_note, resume_highlights: [...],
  signal: { years_experience, stack_match, location } } ]`
(Applications in stage = 'Applied' and not yet reviewed)

### POST /applications/:id/advance   → moves stage Applied -> Screen
### POST /applications/:id/reject    → sets stage = Rejected

---

## Scheduling

### GET /applications/:id/scheduling
Returns: `{ rounds: [ { id, round_name, interviewer: {...}, duration_minutes, status } ],
  availability: [ { interviewer_id, source: "google_calendar" | "talon", busy_blocks: [{start,end}] } ] }`
`source` tells you whether this is real Google Calendar data or a Talon-only approximation
(for interviewers who haven't linked Google) — you may want a small badge/tooltip for this.

### POST /applications/:id/interviews
Body: `{ round_name, interviewer_id, duration_minutes, scheduled_at }`

### POST /interviews/:id/send-invites
Marks the round Confirmed. If the interviewer has Google Calendar linked, also creates a
real Calendar event with a Meet link. Returns: `{ ok: true, calendar_event: {id, htmlLink, hangoutLink} | null }`
(`null` when the interviewer hasn't linked Google — nothing failed, just no real invite created)

---

## Offers

### GET /offers/:id
Returns offer + approval chain + rendered letter text.

### POST /applications/:id/offers
Body: `{ level, base_salary, band_min, band_max, equity_options, signon_bonus, start_date, expires_at }`

### PATCH /offers/:id
Body: any subset of offer fields (creates new version)

### POST /offers/:id/send-for-approval
Creates offer_approvals rows per approval chain, sets status = 'Pending approval'

### POST /offer-approvals/:id/decide
Body: `{ status: "Approved" | "Rejected" }`

### POST /offers/:id/send
Marks an Approved offer as sent to the candidate (status -> 'Sent'). Required before `/respond`.

### POST /offers/:id/respond
Body: `{ status: "Accepted" | "Declined" }` — records the candidate's actual decision on a
Sent offer. Accepted moves the application to Hired; Declined moves it to Rejected. This is
what `offer_accept_rate` in `/reports/overview` measures — offers that were never sent, or
sent but not yet responded to, aren't counted either way.

---

## Reports

### GET /reports/overview
Query: `?days=30`
Returns: `{ time_to_hire_days, offer_accept_rate, active_candidates, interviews_this_week,
  pipeline_conversion: [{stage, count}], hires_by_source: [{source, count}],
  interviews_per_week: [{week_label, count}] }`

---

## Candidates

### GET /candidates?q=search
### GET /candidates/:id
### POST /candidates
Body: `{ name, email, phone, location, current_title, current_company, source, resume_url, ... }`

### POST /candidates/bulk-import
Body: `{ csv: "name,email,phone,location,current_title,current_company,source,job_id\n..." }`
Header row is required; `job_id` is optional per row (adds that candidate straight into a job's
Applied stage, otherwise just creates the candidate record with no application).
Returns: `{ imported: number, errors: string[] }` (errors are per-row, e.g. "Row 3: missing name" —
those rows are skipped, the rest still import)

---

## Search

### GET /search?q=term
Returns: `{ jobs: [...], candidates: [...] }` (for Cmd+K)
