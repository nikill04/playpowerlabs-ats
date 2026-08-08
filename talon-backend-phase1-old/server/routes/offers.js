const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();
// NOTE: deliberately NOT using router.use(requireAuth) here — this router is
// mounted at the bare /api prefix (see index.js), so a blanket "use" would
// intercept every /api/* request, including ones meant for other routers
// registered later (this caused a real bug: /api/health returned 401).
// Each route below takes requireAuth individually instead.

// Standard approval chain for every offer, in order.
const APPROVAL_CHAIN = [
  { role: 'Hiring manager', sequence: 1 },
  { role: 'VP Engineering', sequence: 2 },
  { role: 'Finance', sequence: 3 },
];

function offerDetail(offerId) {
  const offer = db.prepare('SELECT * FROM offers WHERE id = ?').get(offerId);
  if (!offer) return null;

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(offer.application_id);
  const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(app.candidate_id);
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(app.job_id);
  const manager = db.prepare('SELECT name FROM users WHERE id = ?').get(job.hiring_manager_id);

  const approvals = db
    .prepare(
      `SELECT oa.*, u.name as approver_name FROM offer_approvals oa
       LEFT JOIN users u ON u.id = oa.approver_id
       WHERE oa.offer_id = ? ORDER BY oa.sequence ASC`
    )
    .all(offerId);

  const letter = renderLetter({ offer, candidate, job, managerName: manager ? manager.name : 'the hiring manager' });

  return { ...offer, candidate, job, approvals, letter };
}

function renderLetter({ offer, candidate, job, managerName }) {
  const firstName = candidate.name.split(' ')[0];
  return [
    'Talon Inc. Offer of Employment',
    '',
    `Dear ${firstName},`,
    '',
    `We are delighted to offer you the position of ${job.title} (${offer.level}) at Talon, reporting to ${managerName}. ` +
      `Your annualized base salary will be $${Number(offer.base_salary).toLocaleString()}, with an equity grant of ` +
      `${Number(offer.equity_options).toLocaleString()} options vesting over ${offer.equity_vest_years} years` +
      (offer.signon_bonus ? ` and a $${Number(offer.signon_bonus).toLocaleString()} sign-on bonus.` : '.'),
    '',
    `Your anticipated start date is ${offer.start_date}. This offer expires on ${offer.expires_at}.`,
    '',
    'Warmly,',
    'Maya Reyes · Recruiting, Talon',
  ].join('\n');
}

// NOTE: this router is mounted at /api (not /api/offers) because it needs
// to own three different path prefixes: /offers/:id, /applications/:id/offers,
// and /offer-approvals/:id/decide — matching API_CONTRACT.md exactly.

router.get('/offers/:id', requireAuth, (req, res) => {
  const detail = offerDetail(req.params.id);
  if (!detail) return res.status(404).json({ error: 'Offer not found' });
  res.json(detail);
});

router.post('/applications/:applicationId/offers', requireAuth, (req, res) => {
  const { level, base_salary, band_min, band_max, equity_options, signon_bonus, start_date, expires_at } = req.body;
  if (!level || !base_salary) return res.status(400).json({ error: 'level and base_salary are required' });

  const result = db
    .prepare(
      `INSERT INTO offers (application_id, level, base_salary, band_min, band_max, equity_options, signon_bonus, start_date, expires_at, status, version)
       VALUES (?,?,?,?,?,?,?,?,?, 'Draft', 1)`
    )
    .run(
      req.params.applicationId,
      level,
      base_salary,
      band_min || null,
      band_max || null,
      equity_options || 0,
      signon_bonus || 0,
      start_date || null,
      expires_at || null
    );

  db.prepare('UPDATE applications SET stage = ? WHERE id = ?').run('Offer', req.params.applicationId);
  db.prepare(
    `INSERT INTO activity_log (application_id, type, title, message, actor_id)
     VALUES (?, 'stage_change', 'Offer created', ?, ?)`
  ).run(req.params.applicationId, `Draft offer created (${level}).`, req.user.id);

  res.status(201).json(offerDetail(result.lastInsertRowid));
});

router.patch('/offers/:id', requireAuth, (req, res) => {
  const offer = db.prepare('SELECT * FROM offers WHERE id = ?').get(req.params.id);
  if (!offer) return res.status(404).json({ error: 'Offer not found' });

  const fields = ['level', 'base_salary', 'band_min', 'band_max', 'equity_options', 'signon_bonus', 'start_date', 'expires_at'];
  const updates = [];
  const values = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(req.body[f]);
    }
  }
  if (updates.length) {
    updates.push('version = version + 1');
    values.push(req.params.id);
    db.prepare(`UPDATE offers SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }
  res.json(offerDetail(req.params.id));
});

router.post('/offers/:id/send-for-approval', requireAuth, (req, res) => {
  const offer = db.prepare('SELECT * FROM offers WHERE id = ?').get(req.params.id);
  if (!offer) return res.status(404).json({ error: 'Offer not found' });

  // Reset any prior approval chain, then create a fresh one.
  db.prepare('DELETE FROM offer_approvals WHERE offer_id = ?').run(req.params.id);
  const insert = db.prepare(
    `INSERT INTO offer_approvals (offer_id, approver_role, status, sequence) VALUES (?,?, 'Pending', ?)`
  );
  APPROVAL_CHAIN.forEach((step) => insert.run(req.params.id, step.role, step.sequence));

  db.prepare("UPDATE offers SET status = 'Pending approval' WHERE id = ?").run(req.params.id);

  res.json(offerDetail(req.params.id));
});

router.post('/offer-approvals/:approvalId/decide', requireAuth, (req, res) => {
  const { status } = req.body;
  if (!['Approved', 'Rejected'].includes(status)) {
    return res.status(400).json({ error: 'status must be Approved or Rejected' });
  }

  const approval = db.prepare('SELECT * FROM offer_approvals WHERE id = ?').get(req.params.approvalId);
  if (!approval) return res.status(404).json({ error: 'Approval step not found' });

  db.prepare("UPDATE offer_approvals SET status = ?, approver_id = ?, decided_at = datetime('now') WHERE id = ?").run(
    status,
    req.user.id,
    req.params.approvalId
  );

  const allApprovals = db.prepare('SELECT * FROM offer_approvals WHERE offer_id = ?').all(approval.offer_id);
  if (status === 'Rejected') {
    db.prepare("UPDATE offers SET status = 'Draft' WHERE id = ?").run(approval.offer_id);
  } else if (allApprovals.every((a) => a.status === 'Approved')) {
    db.prepare("UPDATE offers SET status = 'Approved' WHERE id = ?").run(approval.offer_id);
  }

  res.json(offerDetail(approval.offer_id));
});

// POST /offers/:id/send — recruiter marks the (internally Approved) offer as
// sent to the candidate. This is the step that makes it eligible to count
// toward the offer-accept-rate KPI once the candidate responds.
router.post('/offers/:id/send', requireAuth, (req, res) => {
  const offer = db.prepare('SELECT * FROM offers WHERE id = ?').get(req.params.id);
  if (!offer) return res.status(404).json({ error: 'Offer not found' });
  if (offer.status !== 'Approved') {
    return res.status(400).json({ error: `Offer must be Approved before sending (currently ${offer.status})` });
  }

  db.prepare("UPDATE offers SET status = 'Sent' WHERE id = ?").run(req.params.id);
  db.prepare(
    `INSERT INTO activity_log (application_id, type, title, message, actor_id)
     VALUES (?, 'stage_change', 'Offer sent', 'Offer letter sent to candidate.', ?)`
  ).run(offer.application_id, req.user.id);

  res.json(offerDetail(req.params.id));
});

// POST /offers/:id/respond — records the candidate's actual decision.
// { status: "Accepted" | "Declined" }. This is what offer_accept_rate in
// /reports/overview is really measuring (see routes/reports.js).
router.post('/offers/:id/respond', requireAuth, (req, res) => {
  const { status } = req.body;
  if (!['Accepted', 'Declined'].includes(status)) {
    return res.status(400).json({ error: 'status must be Accepted or Declined' });
  }

  const offer = db.prepare('SELECT * FROM offers WHERE id = ?').get(req.params.id);
  if (!offer) return res.status(404).json({ error: 'Offer not found' });
  if (offer.status !== 'Sent') {
    return res.status(400).json({ error: `Offer must be Sent before recording a response (currently ${offer.status})` });
  }

  db.prepare('UPDATE offers SET status = ? WHERE id = ?').run(status, req.params.id);

  if (status === 'Accepted') {
    db.prepare("UPDATE applications SET stage = 'Hired' WHERE id = ?").run(offer.application_id);
  } else {
    db.prepare("UPDATE applications SET stage = 'Rejected' WHERE id = ?").run(offer.application_id);
  }

  db.prepare(
    `INSERT INTO activity_log (application_id, type, title, message, actor_id)
     VALUES (?, 'stage_change', 'Offer response recorded', ?, ?)`
  ).run(offer.application_id, `Candidate ${status.toLowerCase()} the offer.`, req.user.id);

  res.json(offerDetail(req.params.id));
});

module.exports = router;
