-- Talon ATS schema (SQLite)
-- Every screen in the app is a view over these tables.

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,                        -- nullable: Google-only accounts have no password
  role TEXT NOT NULL DEFAULT 'recruiter',   -- recruiter | hiring_manager | interviewer | admin | finance
  avatar_color TEXT DEFAULT '#6366f1',
  google_id TEXT UNIQUE,                     -- set when the user signed up/in via Google
  google_refresh_token TEXT,                 -- lets us call Calendar API on the user's behalf later
  totp_secret TEXT,                          -- base32 secret for authenticator apps, set during 2FA setup
  totp_enabled INTEGER NOT NULL DEFAULT 0,   -- 0/1 — whether 2FA is required at login
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE,                 -- e.g. ENG-204
  title TEXT NOT NULL,
  department TEXT NOT NULL,         -- Engineering | Design | People | Sales
  location TEXT NOT NULL,
  band_min INTEGER,
  band_max INTEGER,
  status TEXT NOT NULL DEFAULT 'Active',  -- Active | On hold | Closing | Closed
  hiring_manager_id INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  location TEXT,
  current_title TEXT,
  current_company TEXT,
  source TEXT,                      -- Referral | Outbound | Careers page | Agency
  resume_url TEXT,
  linkedin_url TEXT,
  github_url TEXT,
  comp_expectation TEXT,
  notice_period TEXT,
  cover_note TEXT,
  years_experience INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

-- The core pivot table. One row = one candidate in one job's pipeline.
CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_id INTEGER NOT NULL REFERENCES candidates(id),
  job_id INTEGER NOT NULL REFERENCES jobs(id),
  stage TEXT NOT NULL DEFAULT 'Applied', -- Applied | Screen | Onsite | Offer | Hired | Rejected
  stage_entered_at TEXT DEFAULT (datetime('now')),
  recruiter_id INTEGER REFERENCES users(id),
  rating REAL,                       -- rollup score shown on pipeline cards (e.g. 4.2)
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL REFERENCES applications(id),
  type TEXT NOT NULL,      -- stage_change | note | email | scorecard | schedule
  title TEXT NOT NULL,
  message TEXT,
  actor_id INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS interviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL REFERENCES applications(id),
  interviewer_id INTEGER REFERENCES users(id),
  round_name TEXT NOT NULL,     -- Coding | System design | Values | Hiring manager
  duration_minutes INTEGER DEFAULT 45,
  scheduled_at TEXT,
  status TEXT DEFAULT 'Pending',  -- Pending | Confirmed | Completed | Cancelled
  calendar_event_id TEXT,       -- Google Calendar event id, set once a real invite is created
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scorecards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  interview_id INTEGER NOT NULL REFERENCES interviews(id),
  interviewer_id INTEGER REFERENCES users(id),
  rating INTEGER,              -- e.g. 3 out of 4
  max_rating INTEGER DEFAULT 4,
  notes TEXT,
  recommendation TEXT,          -- Strong hire | Hire | No hire | Strong no hire
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL REFERENCES applications(id),
  level TEXT,
  base_salary INTEGER,
  band_min INTEGER,
  band_max INTEGER,
  equity_options INTEGER,
  equity_vest_years INTEGER DEFAULT 4,
  signon_bonus INTEGER,
  start_date TEXT,
  expires_at TEXT,
  status TEXT DEFAULT 'Draft',  -- Draft | Pending approval | Approved | Sent | Accepted | Declined
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS offer_approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  offer_id INTEGER NOT NULL REFERENCES offers(id),
  approver_id INTEGER REFERENCES users(id),
  approver_role TEXT NOT NULL,   -- Hiring manager | VP Engineering | Finance
  status TEXT DEFAULT 'Pending', -- Pending | Approved | Rejected
  sequence INTEGER NOT NULL,
  decided_at TEXT
);
