# Project handoff: Talon ATS clone — continue from here

I'm building a full-stack clone of an ATS (applicant tracking system) called Talon,
based on a PDF of product screenshots. I've been working on this with another Claude
session that's about to hit its context limit, so I'm continuing here. I'm attaching:

1. The original PDF (`Talon_ATS.pdf`) — screenshots of every screen, plus a
   requirements block at the end listing every feature that must be implemented
2. A zip of the backend code already built (`talon-backend.zip`)

Read both fully before doing anything.

## My constraints (please follow exactly, don't deviate)

- I don't want anything extra beyond what's in the PDF's requirements list — no
  scope creep, but also nothing from that list skipped or simplified without telling me.
- I don't know many of the frameworks involved, so code must be **simple and readable**,
  not clever. Plain JS, not TypeScript, wherever that's a real option.
- Stack already committed to: **Node + Express + SQLite (better-sqlite3, plain SQL,
  no heavy ORM) on the backend**, **React (plain JS, Vite, plain CSS) on the frontend**.
- I'm working under real time pressure — be direct, don't over-explain, just build and
  verify things actually work (don't just say code "should work" — test it, e.g. with
  curl against the running server, and show me the output).

## Why there's a backend zip but no frontend code from you yet

I'm using a **split strategy**: a separate AI tool is building the frontend, page by
page, directly against the PDF screenshots, using a fixed prompt template (feeding it
one screenshot per page + always the same instructions) so it produces pixel-accurate,
consistent UI. That tool does NOT have context on the backend — it just builds React
components that call a REST API at `http://localhost:4000/api`.

Your job (Claude, continuing here) is **everything except that frontend visual build**:
backend, auth, infra, tests, and — once I bring back frontend code from the other
tool — wiring the two together and fixing any integration mismatches.

The file `API_CONTRACT.md` inside the zip is the single source of truth both sides are
building against. Don't let the two drift apart — if you change any endpoint shape,
tell me so I can pass the update to the frontend tool too.

## What's already done (in the zip, tested and working)

**Backend (Node/Express) + SQLite database**, fully modeled around six real screens:
Jobs list, Pipeline kanban, Review inbox, Candidate profile, Scheduling, Offers (with
multi-step approval chain), plus a Reports dashboard computed from real SQL aggregates
(not fake/hardcoded numbers).

Data model (see `server/schema.sql`): `users`, `jobs`, `candidates`, `applications`
(the kanban pivot table — one row per candidate-per-job), `activity_log`, `interviews`,
`scorecards`, `offers`, `offer_approvals`.

Seed data in `server/db.js` mirrors the PDF's exact sample names (Ana Petrova, Sofia
Lindqvist, Jordan Cole, etc.) and exact numbers (offer amounts, scorecard ratings,
scheduling states) so the demo looks identical to the screenshots.

**Auth is fully built and tested**: email/password with bcrypt+JWT, **Google OAuth**
(server-side redirect flow, real client ID/secret already wired into `.env` on my
machine — `.env.example` in the zip shows the shape, real secrets were shared earlier
in chat, not committed to the zip), and **TOTP 2FA** (setup returns a QR code, enable
requires a real 6-digit code, login returns a `pending_token` when 2FA is on, a second
`/auth/2fa/verify` call exchanges it for a full token). I verified all of this end to
end with curl, including confirming a pending (not-yet-2FA-verified) token is REJECTED
on protected routes.

Every endpoint is listed with exact request/response shapes in `API_CONTRACT.md`.

## What's NOT done yet — pick up here, in this order

1. **Real Google Calendar sync** for the Scheduling screen. Currently "busy" times on
   the scheduling grid are computed only from our own `interviews` table, not real
   Google Calendar. This needs the OAuth scope extended to
   `https://www.googleapis.com/auth/calendar.readonly`, and I still need to add that
   scope in Google Cloud Console's OAuth consent screen (and confirm my Google account
   is added as a test user, since the app is likely still in "Testing" publishing
   status). Ask me to confirm that's done before assuming the scope will actually work.

2. **Frontend integration** — once I bring back pages from the other AI tool, wire them
   to this API (base URL `http://localhost:4000/api`), and fix any contract mismatches.
   This can happen in parallel with everything else.

3. **Infra as code** — CDK (JS, not YAML/HCL, to stay consistent with "readable, not
   clever") unless I ask for Terraform specifically. Should define: the API server
   (container or basic compute), a managed Postgres (SQLite → Postgres swap for
   production, since we used plain SQL not an ORM, this should be a small diff), and
   secrets/env var handling — don't hardcode any credentials into the stack code.

4. **Playwright E2E suite** — do this LAST, since it needs a working frontend to click
   through. Cover the main flows: login (+2FA), move a candidate through the pipeline,
   review inbox advance/reject, schedule an interview, send an offer through approval,
   check the reports dashboard renders real numbers.

## How I want you to work

- Before writing code, tell me the plan for whatever phase we're starting, in plain
  language, like the "status table" style used earlier in this project (what's done,
  what's not, what's next) — I want to always know exactly where we stand against the
  full requirements list from the PDF.
- Actually run and test what you build (start the server, curl the endpoints, show me
  real output) before telling me it's done.
- When you finish a phase, repackage the whole backend as a fresh zip (excluding
  `node_modules`, `.env`, and `*.db` files) and give it to me via the file tools, plus
  a short summary of exactly what changed and what I need to do on my end (env vars,
  Google Cloud Console settings, etc.).
- If something needs a decision from me (credentials, scope choices, Terraform vs CDK,
  etc.), ask directly instead of guessing.
