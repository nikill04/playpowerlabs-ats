const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

router.get('/overview', (req, res) => {
  const days = Number(req.query.days) || 30;
  const since = new Date(Date.now() - days * 86400000).toISOString();

  // Time to hire: avg days between application creation and reaching Hired,
  // approximated here as (now - created_at) for currently-Hired applications.
  const hired = db
    .prepare("SELECT created_at FROM applications WHERE stage = 'Hired' AND created_at >= ?")
    .all(since);
  const ttHireDays = hired.length
    ? Math.round(
        hired.reduce((sum, a) => sum + (Date.now() - new Date(a.created_at).getTime()) / 86400000, 0) / hired.length
      )
    : 0;

  // Offer accept rate: of offers that were actually SENT to a candidate,
  // what fraction were Accepted (vs Declined)? Offers still in Draft/Pending
  // approval/Approved-but-not-sent don't count yet — there's no candidate
  // decision to measure.
  const respondedOffers = db
    .prepare("SELECT status FROM offers WHERE status IN ('Accepted','Declined')")
    .all();
  const offerAcceptRate = respondedOffers.length
    ? Math.round((respondedOffers.filter((o) => o.status === 'Accepted').length / respondedOffers.length) * 100)
    : 0;

  const activeCandidates = db
    .prepare("SELECT COUNT(*) as c FROM applications WHERE stage NOT IN ('Hired','Rejected')")
    .get().c;

  const interviewsThisWeek = db
    .prepare("SELECT COUNT(*) as c FROM interviews WHERE scheduled_at >= datetime('now','-7 days')")
    .get().c;

  const STAGES = ['Applied', 'Screen', 'Onsite', 'Offer', 'Hired'];
  const pipelineConversion = STAGES.map((stage) => ({
    stage,
    count: db.prepare('SELECT COUNT(*) as c FROM applications WHERE stage = ?').get(stage).c,
  }));

  const hiresBySource = db
    .prepare(
      `SELECT c.source as source, COUNT(*) as count FROM applications a
       JOIN candidates c ON c.id = a.candidate_id
       WHERE a.stage = 'Hired' GROUP BY c.source ORDER BY count DESC`
    )
    .all();

  // Interviews per week for the last 8 weeks.
  const interviewsPerWeek = [];
  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date(Date.now() - i * 7 * 86400000);
    const weekEnd = new Date(Date.now() - (i - 1) * 7 * 86400000);
    const count = db
      .prepare('SELECT COUNT(*) as c FROM interviews WHERE scheduled_at >= ? AND scheduled_at < ?')
      .get(weekStart.toISOString(), weekEnd.toISOString()).c;
    interviewsPerWeek.push({ week_label: `W${8 - i}`, count });
  }

  res.json({
    time_to_hire_days: ttHireDays,
    offer_accept_rate: offerAcceptRate,
    active_candidates: activeCandidates,
    interviews_this_week: interviewsThisWeek,
    pipeline_conversion: pipelineConversion,
    hires_by_source: hiresBySource,
    interviews_per_week: interviewsPerWeek,
  });
});

module.exports = router;
