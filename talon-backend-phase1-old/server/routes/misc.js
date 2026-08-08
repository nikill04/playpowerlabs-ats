const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        value += '"';
        index++;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(value.trim());
      value = '';
    } else if (char === '\n') {
      row.push(value.trim());
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      value = '';
    } else if (char !== '\r') {
      value += char;
    }
  }

  row.push(value.trim());
  if (row.some((cell) => cell !== '')) rows.push(row);
  if (quoted) throw new Error('CSV contains an unclosed quoted value');
  return rows;
}
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
// Expected header row: name,email,phone,location,current_title,current_company,source,job_code
// Body: { csv: "name,email,...\nJane Doe,jane@x.com,..." }
router.post('/candidates/bulk-import', requireAuth, (req, res) => {
  const { csv } = req.body;
  if (!csv) return res.status(400).json({ error: 'csv text is required' });

  let rows;
  try {
    rows = parseCsv(String(csv).trim());
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  if (rows.length < 2) return res.status(400).json({ error: 'CSV needs a header row plus at least one data row' });

  const headers = rows[0].map((h) => h.trim());
  const missingHeaders = ['name'].filter((header) => !headers.includes(header));
  const hasJobReference = headers.includes('job_id') || headers.includes('job_code');
  if (missingHeaders.length || !hasJobReference) {
    if (!hasJobReference) missingHeaders.push('job_id or job_code');
    return res.status(400).json({
      error: `CSV is missing required header${missingHeaders.length === 1 ? '' : 's'}: ${missingHeaders.join(', ')}`,
    });
  }

  const insertCandidate = db.prepare(
    `INSERT INTO candidates (name,email,phone,location,current_title,current_company,source) VALUES (?,?,?,?,?,?,?)`
  );
  const insertApp = db.prepare(`INSERT INTO applications (candidate_id, job_id, stage, recruiter_id) VALUES (?,?,'Applied',?)`);
  const insertActivity = db.prepare(
    `INSERT INTO activity_log (application_id, type, title, message, actor_id)
     VALUES (?, 'stage_change', 'Candidate imported', 'Candidate added from CSV import.', ?)`
  );
  const getJobById = db.prepare('SELECT id FROM jobs WHERE id = ?');
  const getJobByCode = db.prepare('SELECT id FROM jobs WHERE code = ?');

  let imported = 0;
  const errors = [];
  const created = [];

  const runImport = db.transaction(() => {
    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i];
      const row = Object.fromEntries(headers.map((h, idx) => [h, cols[idx]]));
      if (!row.name) {
        errors.push(`Row ${i + 1}: missing name`);
        continue;
      }
      const job =
        row.job_id && Number.isInteger(Number(row.job_id))
          ? getJobById.get(Number(row.job_id))
          : row.job_code
            ? getJobByCode.get(row.job_code)
            : null;
      if (!job) {
        errors.push(`Row ${i + 1}: invalid job reference`);
        continue;
      }
      const candidateId = insertCandidate.run(
        row.name, row.email || null, row.phone || null, row.location || null,
        row.current_title || null, row.current_company || null, row.source || 'CSV import'
      ).lastInsertRowid;

      const applicationId = insertApp.run(candidateId, job.id, req.user.id).lastInsertRowid;
      insertActivity.run(applicationId, req.user.id);
      created.push({ candidate_id: candidateId, application_id: applicationId });
      imported++;
    }
  });
  runImport();

  res.status(201).json({ imported, errors, created });
});

module.exports = router;
