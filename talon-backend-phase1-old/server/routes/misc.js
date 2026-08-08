const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();
// NOTE: deliberately not using router.use(requireAuth) — see routes/offers.js
// for why a blanket rule on a bare-/api-mounted router is unsafe.

// GET /search?q=term — powers the Cmd+K global search
router.get('/search', requireAuth, (req, res) => {
  const q = `%${req.query.q || ''}%`;
  const jobs = db.prepare('SELECT id, title, code FROM jobs WHERE title LIKE ? LIMIT 5').all(q);
  const candidates = db
    .prepare(
      `SELECT c.id, c.name, c.current_title, c.current_company,
              a.id as application_id, j.title as job_title
       FROM candidates c
       LEFT JOIN applications a ON a.candidate_id = c.id
       LEFT JOIN jobs j ON j.id = a.job_id
       WHERE c.name LIKE ?
       ORDER BY c.name, a.id
       LIMIT 5`
    )
    .all(q);
  res.json({ jobs, candidates });
});

// POST /candidates/bulk-import — CSV text pasted/uploaded from the frontend.
// Expected header row: name,email,phone,location,current_title,current_company,source,job_id
// Body: { csv: "name,email,...\nJane Doe,jane@x.com,..." }
router.post('/candidates/bulk-import', requireAuth, (req, res) => {
  const { csv } = req.body;
  if (!csv) return res.status(400).json({ error: 'csv text is required' });

  const lines = csv.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return res.status(400).json({ error: 'CSV needs a header row plus at least one data row' });

  const headers = lines[0].split(',').map((h) => h.trim());
  const insertCandidate = db.prepare(
    `INSERT INTO candidates (name,email,phone,location,current_title,current_company,source) VALUES (?,?,?,?,?,?,?)`
  );
  const insertApp = db.prepare(`INSERT INTO applications (candidate_id, job_id, stage, recruiter_id) VALUES (?,?,'Applied',?)`);

  let imported = 0;
  const errors = [];

  const runImport = db.transaction(() => {
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim());
      const row = Object.fromEntries(headers.map((h, idx) => [h, cols[idx]]));
      if (!row.name) {
        errors.push(`Row ${i + 1}: missing name`);
        continue;
      }
      const candidateId = insertCandidate.run(
        row.name, row.email || null, row.phone || null, row.location || null,
        row.current_title || null, row.current_company || null, row.source || 'CSV import'
      ).lastInsertRowid;

      if (row.job_id) {
        insertApp.run(candidateId, row.job_id, req.user.id);
      }
      imported++;
    }
  });
  runImport();

  res.status(201).json({ imported, errors });
});

module.exports = router;
