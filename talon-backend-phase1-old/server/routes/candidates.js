const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const q = req.query.q;
  let rows;
  if (q) {
    rows = db.prepare('SELECT * FROM candidates WHERE name LIKE ? ORDER BY name').all(`%${q}%`);
  } else {
    rows = db.prepare('SELECT * FROM candidates ORDER BY name').all();
  }
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(req.params.id);
  if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

  const applications = db
    .prepare(
      `SELECT a.id, a.stage, j.title as job_title FROM applications a
       JOIN jobs j ON j.id = a.job_id WHERE a.candidate_id = ?`
    )
    .all(req.params.id);

  res.json({ ...candidate, applications });
});

router.post('/', (req, res) => {
  const c = req.body;
  if (!c.name) return res.status(400).json({ error: 'name is required' });

  const result = db
    .prepare(
      `INSERT INTO candidates (name,email,phone,location,current_title,current_company,source,resume_url,linkedin_url,github_url,comp_expectation,notice_period,cover_note,years_experience)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      c.name, c.email || null, c.phone || null, c.location || null, c.current_title || null,
      c.current_company || null, c.source || null, c.resume_url || null, c.linkedin_url || null,
      c.github_url || null, c.comp_expectation || null, c.notice_period || null, c.cover_note || null,
      c.years_experience || null
    );

  const created = db.prepare('SELECT * FROM candidates WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

module.exports = router;
