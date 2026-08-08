// db.js — opens (or creates) the SQLite file, applies schema, seeds demo data
// if the DB is empty. Everything else in the app just imports `db` from here.

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'talon.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const isNew = !fs.existsSync(DB_PATH);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// Lightweight migration for DBs created before Google/2FA columns existed.
// SQLite has no "ADD COLUMN IF NOT EXISTS", so we just try each and ignore
// the "duplicate column" error if it's already there.
const migrations = [
  `ALTER TABLE users ADD COLUMN google_id TEXT`,
  `ALTER TABLE users ADD COLUMN google_refresh_token TEXT`,
  `ALTER TABLE users ADD COLUMN totp_secret TEXT`,
  `ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE interviews ADD COLUMN calendar_event_id TEXT`,
];
for (const sql of migrations) {
  try {
    db.exec(sql);
  } catch (err) {
    if (!/duplicate column/i.test(err.message)) throw err;
  }
}

if (isNew) {
  seed();
}

function seed() {
  const insertUser = db.prepare(
    `INSERT INTO users (name, email, password_hash, role, avatar_color) VALUES (?,?,?,?,?)`
  );
  const hash = bcrypt.hashSync('password123', 8);

  const maya = insertUser.run('Maya Reyes', 'maya@talon.com', hash, 'recruiter', '#22c55e').lastInsertRowid;
  const tom = insertUser.run('Tom Iwu', 'tom@talon.com', hash, 'recruiter', '#3b82f6').lastInsertRowid;
  const sam = insertUser.run('Sam Altmann', 'sam@talon.com', hash, 'hiring_manager', '#a855f7').lastInsertRowid;
  const lin = insertUser.run('Lin Chen', 'lin@talon.com', hash, 'interviewer', '#f97316').lastInsertRowid;
  const david = insertUser.run('David Osei', 'david@talon.com', hash, 'interviewer', '#14b8a6').lastInsertRowid;
  const rina = insertUser.run('Rina Patel', 'rina@talon.com', hash, 'admin', '#ef4444').lastInsertRowid;
  const finance = insertUser.run('Finance Team', 'finance@talon.com', hash, 'finance', '#6b7280').lastInsertRowid;

  const insertJob = db.prepare(
    `INSERT INTO jobs (code,title,department,location,band_min,band_max,status,hiring_manager_id) VALUES (?,?,?,?,?,?,?,?)`
  );
  const jobSPE = insertJob.run('ENG-204', 'Senior Product Engineer', 'Engineering', 'Remote (US)', 190, 225, 'Active', maya).lastInsertRowid;
  const jobStaffDesign = insertJob.run('ENG-209', 'Staff Design Engineer', 'Engineering', 'SF / Hybrid', 200, 240, 'Active', tom).lastInsertRowid;
  const jobEM = insertJob.run('ENG-198', 'Engineering Manager, Infra', 'Engineering', 'New York', 210, 250, 'On hold', maya).lastInsertRowid;
  const jobDesigner = insertJob.run('DES-114', 'Product Designer, Growth', 'Design', 'Remote (EU)', 120, 150, 'Active', tom).lastInsertRowid;
  const jobCoordinator = insertJob.run('PPL-031', 'Recruiting Coordinator', 'People', 'Remote (US)', 80, 100, 'Active', maya).lastInsertRowid;
  const jobSales = insertJob.run('SAL-076', 'Head of Sales, EMEA', 'Sales', 'London', 150, 190, 'Closing', sam).lastInsertRowid;

  const insertCandidate = db.prepare(
    `INSERT INTO candidates (name,email,phone,location,current_title,current_company,source,resume_url,linkedin_url,github_url,comp_expectation,notice_period,cover_note,years_experience)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  );
  const insertApp = db.prepare(
    `INSERT INTO applications (candidate_id, job_id, stage, recruiter_id, rating) VALUES (?,?,?,?,?)`
  );
  const insertActivity = db.prepare(
    `INSERT INTO activity_log (application_id, type, title, message, actor_id) VALUES (?,?,?,?,?)`
  );

  // NOTE on scale: the PDF mockup shows large aggregate counts (e.g. "67
  // active" on Recruiting Coordinator). Those are illustrative placeholder
  // numbers from a design mockup, not a real dataset — hand-seeding 60+ fake
  // candidate rows wouldn't make the app any more "correct," just bigger.
  // What actually matters (and what's fixed here) is that every job has a
  // real, non-zero, correctly-computed pipeline instead of five empty ones.
  function addCandidate(c, jobId, stage, rating) {
    const id = insertCandidate.run(
      c.name, c.email, c.phone, c.location, c.title, c.company, c.source,
      c.resume || '#', c.linkedin || '#', c.github || '#', c.comp, c.notice, c.cover, c.years
    ).lastInsertRowid;
    const appId = insertApp.run(id, jobId, stage, maya, rating || null).lastInsertRowid;
    insertActivity.run(appId, 'stage_change', 'Application reviewed', `Moved to ${stage}.`, maya);
    return appId;
  }

  addCandidate({ name: 'Tess Bianchi', email: 'tess@example.com', title: 'Frontend Engineer', company: 'Halo', source: 'Agency', years: 4, cover: 'Excited about the role.' }, jobSPE, 'Applied');
  addCandidate({ name: 'Omar Haddad', email: 'omar@example.com', title: 'Platform Engineer', company: 'Trellis', source: 'Careers page', years: 6, cover: 'Been following Talon for a while.' }, jobSPE, 'Applied');
  addCandidate({ name: 'Jordan Cole', email: 'jordan@example.com', title: 'Fullstack Engineer', company: 'Beacon', location: 'Chicago, IL', source: 'Careers page', years: 5, comp: '$190k-$210k', notice: '3 weeks',
    cover: 'I have spent the last three years turning a monolith into event driven services at Beacon, and the scale problems in your job post are exactly the ones I have been living in. I would love to bring that to a product team that ships weekly.' }, jobSPE, 'Applied');
  addCandidate({ name: 'Priya Nair', email: 'priya@example.com', title: 'SWE II', company: 'Loft', source: 'Referral', years: 4, cover: 'Referred by a former colleague.' }, jobSPE, 'Applied');

  addCandidate({ name: 'Elena Ruiz', email: 'elena@example.com', title: 'Backend Engineer', company: 'Cove', source: 'Outbound', years: 7 }, jobSPE, 'Screen');
  addCandidate({ name: 'Marcus Webb', email: 'marcus@example.com', title: 'SWE', company: 'Northwind', source: 'LinkedIn', years: 5 }, jobSPE, 'Screen');

  const anaId = addCandidate({
    name: 'Ana Petrova', email: 'ana.petrova@gmail.com', phone: '+1 415 555 0142', location: 'Austin, TX',
    title: 'Senior SWE', company: 'Meridian', source: 'Referral by J. Kim', years: 8,
    comp: '$205k to $220k', notice: '4 weeks'
  }, jobSPE, 'Onsite', 4.2);
  insertActivity.run(anaId, 'email', 'Email sent: screen confirmation', '"Technical screen at Talon" opened 3 times, replied in 12 min.', maya);
  insertActivity.run(anaId, 'stage_change', 'Technical screen passed', 'L. Chen rated 4/4 and advanced her to Onsite.', lin);
  insertActivity.run(anaId, 'scorecard', 'Scorecard submitted: System design', 'D. Osei rated 3/4. "Strong tradeoff reasoning under changing constraints. Hire."', david);
  insertActivity.run(anaId, 'schedule', 'Onsite loop scheduled', '4 interviews on Thu Aug 6, 10:00 to 14:30 CT. Invites pending panel confirmation.', maya);

  const insertInterview = db.prepare(
    `INSERT INTO interviews (application_id, interviewer_id, round_name, duration_minutes, scheduled_at, status) VALUES (?,?,?,?,?,?)`
  );
  insertInterview.run(anaId, lin, 'Coding', 60, '2026-08-06T10:00:00', 'Confirmed');
  insertInterview.run(anaId, david, 'System design', 60, '2026-08-06T10:00:00', 'Confirmed');
  insertInterview.run(anaId, maya, 'Values', 45, null, 'Pending');
  insertInterview.run(anaId, sam, 'Hiring manager', 45, null, 'Pending');

  const insertScorecard = db.prepare(
    `INSERT INTO scorecards (interview_id, interviewer_id, rating, max_rating, notes, recommendation) VALUES (?,?,?,?,?,?)`
  );
  insertScorecard.run(2, david, 3, 4, 'Strong tradeoff reasoning under changing constraints.', 'Hire');

  const sofiaId = addCandidate({
    name: 'Sofia Lindqvist', email: 'sofia@example.com', title: 'Staff Engineer', company: 'Polar',
    source: 'Outbound', years: 9, comp: '$210k', notice: '6 weeks'
  }, jobSPE, 'Offer', 4.6);
  insertActivity.run(sofiaId, 'stage_change', 'Offer extended', 'Offer sent for approval.', maya);

  const insertOffer = db.prepare(
    `INSERT INTO offers (application_id, level, base_salary, band_min, band_max, equity_options, equity_vest_years, signon_bonus, start_date, expires_at, status, version)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  );
  const offerId = insertOffer.run(sofiaId, 'L5 Senior', 210000, 190000, 225000, 22000, 4, 15000, '2026-09-15', '2026-08-14', 'Pending approval', 2).lastInsertRowid;

  const insertApproval = db.prepare(
    `INSERT INTO offer_approvals (offer_id, approver_id, approver_role, status, sequence, decided_at) VALUES (?,?,?,?,?,?)`
  );
  insertApproval.run(offerId, sam, 'Hiring manager', 'Approved', 1, '2026-08-04T10:00:00');
  insertApproval.run(offerId, rina, 'VP Engineering', 'Approved', 2, '2026-08-04T15:00:00');
  insertApproval.run(offerId, finance, 'Finance', 'Pending', 3, null);

  // David Kim: fully hired, offer already Sent + Accepted — this is what
  // makes offer_accept_rate in /reports/overview non-zero and meaningful.
  const davidKimId = addCandidate({ name: 'David Kim', email: 'davidkim@example.com', title: 'Sr SWE', company: 'Argo', source: 'Referral', years: 6 }, jobSPE, 'Hired');
  const davidKimOfferId = insertOffer.run(davidKimId, 'L5 Senior', 200000, 190000, 225000, 18000, 4, 10000, '2026-07-01', '2026-06-15', 'Accepted', 1).lastInsertRowid;
  insertActivity.run(davidKimId, 'stage_change', 'Offer accepted', 'Candidate accepted the offer. Starts July 1.', maya);

  // Grace Liu: a realistic Declined case, so the accept-rate KPI reflects an
  // actual mix of outcomes rather than a suspiciously perfect 100%.
  const graceLiuId = addCandidate({ name: 'Grace Liu', email: 'grace@example.com', title: 'SWE III', company: 'Fenwick', source: 'Outbound', years: 7 }, jobSPE, 'Rejected');
  insertOffer.run(graceLiuId, 'L4', 195000, 190000, 225000, 15000, 4, 5000, '2026-08-01', '2026-07-10', 'Declined', 1);
  insertActivity.run(graceLiuId, 'stage_change', 'Offer declined', 'Candidate accepted a competing offer.', maya);

  // --- Fill in the other 5 jobs so no pipeline is empty ---

  addCandidate({ name: 'Wei Chen', email: 'wei@example.com', title: 'Design Engineer', company: 'Vantage', source: 'Referral', years: 6 }, jobStaffDesign, 'Applied');
  addCandidate({ name: 'Noor Osman', email: 'noor@example.com', title: 'Frontend Architect', company: 'Handel', source: 'Careers page', years: 8 }, jobStaffDesign, 'Screen');
  addCandidate({ name: 'Ben Foster', email: 'ben@example.com', title: 'Staff Engineer', company: 'Circuit', source: 'Outbound', years: 9 }, jobStaffDesign, 'Onsite', 3.9);

  addCandidate({ name: 'Halima Yusuf', email: 'halima@example.com', title: 'Eng Manager', company: 'Ridge', source: 'Referral', years: 10 }, jobEM, 'Applied');
  addCandidate({ name: 'Peter Novak', email: 'peter@example.com', title: 'Staff SWE', company: 'Blockway', source: 'Outbound', years: 9 }, jobEM, 'Screen');

  addCandidate({ name: 'Ines Duarte', email: 'ines@example.com', title: 'Product Designer', company: 'Loom Studio', source: 'Careers page', years: 5 }, jobDesigner, 'Applied');
  addCandidate({ name: 'Sam Okafor', email: 'sam.o@example.com', title: 'Senior Designer', company: 'Basecamp', source: 'Referral', years: 6 }, jobDesigner, 'Applied');
  addCandidate({ name: 'Yuki Tanaka', email: 'yuki@example.com', title: 'Design Lead', company: 'Kanso', source: 'Outbound', years: 8 }, jobDesigner, 'Onsite', 4.4);

  addCandidate({ name: 'Carlos Mendez', email: 'carlos@example.com', title: 'Recruiting Coordinator', company: 'Handshake', source: 'Careers page', years: 2 }, jobCoordinator, 'Applied');
  addCandidate({ name: 'Aisha Bello', email: 'aisha@example.com', title: 'People Ops', company: 'Nomad HR', source: 'Referral', years: 3 }, jobCoordinator, 'Screen');

  addCandidate({ name: 'Fiona Clarke', email: 'fiona@example.com', title: 'Enterprise AE', company: 'Vector', source: 'Outbound', years: 8 }, jobSales, 'Screen');
  addCandidate({ name: 'James Whitfield', email: 'james@example.com', title: 'Sales Director', company: 'Northgate', source: 'Referral', years: 12 }, jobSales, 'Onsite', 4.1);

  console.log('Seeded Talon demo database.');
}

module.exports = db;
