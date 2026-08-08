// helpers.js — small pieces of logic shared across route files.
const db = require('./db');

// Used by both the pipeline kanban cards (routes/jobs.js) and the candidate
// profile "next action" banner (routes/applications.js) so the two screens
// never disagree about what's blocking a candidate.
function nextActionFor(applicationId) {
  const pendingOffer = db
    .prepare(
      `SELECT oa.approver_role FROM offer_approvals oa
       JOIN offers o ON o.id = oa.offer_id
       WHERE o.application_id = ? AND oa.status = 'Pending'
       ORDER BY oa.sequence ASC LIMIT 1`
    )
    .get(applicationId);
  if (pendingOffer) return `Offer pending ${pendingOffer.approver_role} approval`;

  const pendingInterview = db
    .prepare(
      `SELECT round_name, interviewer_id, scheduled_at FROM interviews
       WHERE application_id = ? AND status = 'Pending'
       ORDER BY id ASC LIMIT 1`
    )
    .get(applicationId);
  if (pendingInterview) {
    const interviewer = pendingInterview.interviewer_id
      ? db.prepare('SELECT name FROM users WHERE id = ?').get(pendingInterview.interviewer_id)
      : null;
    const who = interviewer ? ` with ${interviewer.name}` : '';
    return pendingInterview.scheduled_at
      ? `${pendingInterview.round_name} round${who} is still unconfirmed`
      : `${pendingInterview.round_name} round${who} needs scheduling`;
  }

  return null;
}

module.exports = { nextActionFor };
