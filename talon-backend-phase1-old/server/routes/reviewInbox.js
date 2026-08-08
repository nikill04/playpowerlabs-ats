const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

// GET /review-inbox — candidates newly Applied, awaiting a triage decision
router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT a.id as application_id, a.stage_entered_at, c.*
       FROM applications a JOIN candidates c ON c.id = a.candidate_id
       WHERE a.stage = 'Applied'
       ORDER BY a.stage_entered_at ASC`
    )
    .all();

  const result = rows.map((r) => ({
    application_id: r.application_id,
    candidate: {
      id: r.id,
      name: r.name,
      current_title: r.current_title,
      current_company: r.current_company,
      location: r.location,
    },
    cover_note: r.cover_note,
    resume_highlights: buildHighlights(r),
    signal: {
      years_experience: r.years_experience,
      stack_match: r.years_experience >= 5 ? 'Strong' : 'Moderate',
      location: r.location ? 'Remote OK' : 'Unknown',
    },
    days_waiting: daysSince(r.stage_entered_at),
  }));

  res.json(result);
});

function buildHighlights(candidate) {
  const highlights = [];
  if (candidate.years_experience) highlights.push(`${candidate.years_experience} yrs experience`);
  if (candidate.current_title && candidate.current_company) {
    highlights.push(`Currently ${candidate.current_title} at ${candidate.current_company}`);
  }
  if (candidate.source) highlights.push(`Sourced via ${candidate.source}`);
  return highlights;
}

function daysSince(dateStr) {
  if (!dateStr) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000));
}

module.exports = router;
