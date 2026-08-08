const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const { nextActionFor } = require('../helpers');

const router = express.Router();
router.use(requireAuth);

// GET /applications/:id — full candidate profile screen
router.get('/:id', (req, res) => {
  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });

  const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(app.candidate_id);
  const job = db.prepare('SELECT id, title, code FROM jobs WHERE id = ?').get(app.job_id);
  const recruiter = db.prepare('SELECT id, name FROM users WHERE id = ?').get(app.recruiter_id);

  const activity = db
    .prepare('SELECT * FROM activity_log WHERE application_id = ? ORDER BY created_at DESC')
    .all(app.id);

  const interviews = db
    .prepare(
      `SELECT i.*, u.name as interviewer_name FROM interviews i
       LEFT JOIN users u ON u.id = i.interviewer_id WHERE i.application_id = ?`
    )
    .all(app.id);

  const scorecards = db
    .prepare(
      `SELECT s.*, u.name as interviewer_name, iv.round_name FROM scorecards s
       JOIN interviews iv ON iv.id = s.interview_id
       LEFT JOIN users u ON u.id = s.interviewer_id
       WHERE iv.application_id = ?`
    )
    .all(app.id);

  res.json({
    id: app.id,
    stage: app.stage,
    stage_entered_at: app.stage_entered_at,
    rating: app.rating,
    next_action: nextActionFor(app.id),
    candidate,
    job,
    recruiter,
    activity,
    interviews,
    scorecards,
    files: [
      { name: 'Resume.pdf', url: candidate.resume_url },
      { name: 'Cover note.txt', url: '#' },
      { name: 'Portfolio link', url: candidate.github_url },
    ].filter((f) => f.url && f.url !== '#'),
  });
});

router.patch('/:id', (req, res) => {
  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });

  const { stage } = req.body;
  if (stage) {
    db.prepare('UPDATE applications SET stage = ?, stage_entered_at = datetime(?) WHERE id = ?').run(
      stage,
      'now',
      req.params.id
    );
    db.prepare(
      `INSERT INTO activity_log (application_id, type, title, message, actor_id)
       VALUES (?, 'stage_change', 'Stage updated', ?, ?)`
    ).run(req.params.id, `Moved to ${stage}.`, req.user.id);
  }

  const updated = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.post('/', (req, res) => {
  const { candidate_id, job_id, recruiter_id } = req.body;
  if (!candidate_id || !job_id) {
    return res.status(400).json({ error: 'candidate_id and job_id are required' });
  }
  const result = db
    .prepare(`INSERT INTO applications (candidate_id, job_id, stage, recruiter_id) VALUES (?,?,'Applied',?)`)
    .run(candidate_id, job_id, recruiter_id || req.user.id);

  db.prepare(
    `INSERT INTO activity_log (application_id, type, title, message, actor_id)
     VALUES (?, 'stage_change', 'Application received', 'Candidate added to pipeline.', ?)`
  ).run(result.lastInsertRowid, req.user.id);

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(app);
});

router.post('/:id/notes', (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required' });

  const result = db
    .prepare(
      `INSERT INTO activity_log (application_id, type, title, message, actor_id)
       VALUES (?, 'note', 'Note added', ?, ?)`
    )
    .run(req.params.id, message, req.user.id);

  const row = db.prepare('SELECT * FROM activity_log WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(row);
});

// POST /applications/:id/advance — moves Applied -> Screen (used by the Review inbox screen)
router.post('/:id/advance', (req, res) => {
  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });

  moveStage(req.params.id, 'Screen', req.user.id, 'Advanced from Review inbox to Screen.');
  res.json({ ok: true });
});

// POST /applications/:id/reject
router.post('/:id/reject', (req, res) => {
  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });

  moveStage(req.params.id, 'Rejected', req.user.id, 'Rejected from Review inbox.');
  res.json({ ok: true });
});

function moveStage(applicationId, stage, actorId, message) {
  db.prepare("UPDATE applications SET stage = ?, stage_entered_at = datetime('now') WHERE id = ?").run(
    stage,
    applicationId
  );
  db.prepare(
    `INSERT INTO activity_log (application_id, type, title, message, actor_id)
     VALUES (?, 'stage_change', 'Stage updated', ?, ?)`
  ).run(applicationId, message, actorId);
}

module.exports = router;
