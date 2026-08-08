const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const { nextActionFor } = require('../helpers');

const router = express.Router();
router.use(requireAuth);

const STAGES = ['Applied', 'Screen', 'Onsite', 'Offer', 'Hired'];

function jobSummary(job) {
  const manager = db.prepare('SELECT id, name FROM users WHERE id = ?').get(job.hiring_manager_id);
  const apps = db.prepare('SELECT stage FROM applications WHERE job_id = ?').all(job.id);

  const activeCount = apps.filter((a) => a.stage !== 'Rejected').length;
  const inProcessCount = apps.filter((a) => a.stage !== 'Hired' && a.stage !== 'Rejected').length;

  const pipeline = STAGES.map((stage) => ({
    stage,
    count: apps.filter((a) => a.stage === stage).length,
  }));

  return {
    id: job.id,
    code: job.code,
    title: job.title,
    department: job.department,
    location: job.location,
    status: job.status,
    band_min: job.band_min,
    band_max: job.band_max,
    hiring_manager: manager || null,
    counts: { active: activeCount, in_process: inProcessCount },
    pipeline,
  };
}

router.get('/', (req, res) => {
  const { status } = req.query;
  let jobs;
  if (status && status !== 'All') {
    jobs = db.prepare('SELECT * FROM jobs WHERE status = ? ORDER BY department, title').all(status);
  } else {
    jobs = db.prepare('SELECT * FROM jobs ORDER BY department, title').all();
  }
  res.json(jobs.map(jobSummary));
});

router.get('/:id', (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(jobSummary(job));
});

router.post('/', (req, res) => {
  const { title, department, location, band_min, band_max, hiring_manager_id } = req.body;
  if (!title || !department || !location) {
    return res.status(400).json({ error: 'title, department, and location are required' });
  }
  const prefix = department.slice(0, 3).toUpperCase();
  const count = db.prepare('SELECT COUNT(*) as c FROM jobs').get().c;
  const code = `${prefix}-${100 + count}`;

  const result = db
    .prepare(
      `INSERT INTO jobs (code, title, department, location, band_min, band_max, status, hiring_manager_id)
       VALUES (?,?,?,?,?,?,'Active',?)`
    )
    .run(code, title, department, location, band_min || null, band_max || null, hiring_manager_id || null);

  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(jobSummary(job));
});

router.patch('/:id', (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const fields = ['title', 'department', 'location', 'band_min', 'band_max', 'status', 'hiring_manager_id'];
  const updates = [];
  const values = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(req.body[f]);
    }
  }
  if (updates.length === 0) return res.json(jobSummary(job));

  values.push(req.params.id);
  db.prepare(`UPDATE jobs SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const updated = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  res.json(jobSummary(updated));
});

// GET /jobs/:jobId/pipeline — kanban board data for one job
router.get('/:jobId/pipeline', (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const apps = db
    .prepare(
      `SELECT a.*, c.name as candidate_name, c.current_title, c.current_company, c.source
       FROM applications a JOIN candidates c ON c.id = a.candidate_id
       WHERE a.job_id = ? AND a.stage != 'Rejected'
       ORDER BY a.stage_entered_at ASC`
    )
    .all(req.params.jobId);

  const STAGE_ORDER = STAGES; // Applied < Screen < Onsite < Offer < Hired
  const totalNonRejected = apps.length;

  const stages = STAGES.map((stage) => {
    const inStage = apps.filter((a) => a.stage === stage);
    const daysList = inStage.map((a) => daysSince(a.stage_entered_at));
    const median = daysList.length ? median_(daysList) : 0;

    // pass_rate: % of all applications currently active in this job's
    // pipeline that have reached this stage or further along. Excludes
    // Rejected applications from the denominator (we don't track how far a
    // rejected candidate got before rejection, so a rejection-inclusive rate
    // would be misleading). Hired has no further stage to "pass" into, so we
    // mark it closed instead of giving it a rate.
    const stageIdx = STAGE_ORDER.indexOf(stage);
    const reachedOrBeyond = apps.filter((a) => STAGE_ORDER.indexOf(a.stage) >= stageIdx).length;
    const pass_rate = totalNonRejected ? reachedOrBeyond / totalNonRejected : 0;

    return {
      stage,
      median_days: median,
      pass_rate: stage === 'Hired' ? null : Math.round(pass_rate * 100) / 100,
      closed: stage === 'Hired',
      applications: inStage.map((a) => ({
        id: a.id,
        candidate: { id: a.candidate_id, name: a.candidate_name, current_title: a.current_title, current_company: a.current_company },
        tags: [a.source].filter(Boolean),
        days_in_stage: daysSince(a.stage_entered_at),
        rating: a.rating,
        next_action: nextActionFor(a.id),
      })),
    };
  });

  res.json({ job: jobSummary(job), stages });
});

function daysSince(dateStr) {
  if (!dateStr) return 0;
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}
function median_(nums) {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

module.exports = router;
