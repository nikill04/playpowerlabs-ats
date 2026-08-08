const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const { getFreeBusy, createEvent } = require('../calendar');

const router = express.Router();

// NOTE: deliberately not using router.use(requireAuth) — see routes/offers.js
// for why a blanket rule on a bare-/api-mounted router is unsafe.

// This router is mounted at /api directly (not under /applications) because
// it needs both /applications/:id/... and /interviews/:id/... paths.

// GET /applications/:id/scheduling — rounds + interviewer availability.
// For interviewers who've linked Google Calendar, we pull their REAL
// free/busy data. For everyone else we fall back to "other confirmed Talon
// interviews" as an approximation, so the screen still works without Google.
router.get('/applications/:id/scheduling', requireAuth, async (req, res) => {
  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });

  const rounds = db
    .prepare(
      `SELECT i.*, u.name as interviewer_name, u.avatar_color FROM interviews i
       LEFT JOIN users u ON u.id = i.interviewer_id WHERE i.application_id = ?`
    )
    .all(req.params.id);

  const interviewerIds = [...new Set(rounds.map((r) => r.interviewer_id).filter(Boolean))];

  // Look 7 days out from now for availability — enough to cover a typical
  // onsite-loop scheduling window.
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + 7 * 86400000).toISOString();

  const availability = await Promise.all(
    interviewerIds.map(async (interviewerId) => {
      let busy_blocks;
      let source = 'talon';

      try {
        const realBusy = await getFreeBusy(interviewerId, timeMin, timeMax);
        if (realBusy) {
          busy_blocks = realBusy;
          source = 'google_calendar';
        }
      } catch (err) {
        console.error(`Calendar freebusy failed for user ${interviewerId}:`, err.message);
      }

      if (!busy_blocks) {
        // Fallback: this interviewer hasn't linked Google (or the call
        // failed) — approximate busy time from their other confirmed
        // interviews already in Talon.
        const dbBusy = db
          .prepare(
            `SELECT scheduled_at, duration_minutes FROM interviews
             WHERE interviewer_id = ? AND status IN ('Confirmed','Completed') AND application_id != ?`
          )
          .all(interviewerId, req.params.id)
          .filter((b) => b.scheduled_at);

        busy_blocks = dbBusy.map((b) => ({
          start: b.scheduled_at,
          end: new Date(new Date(b.scheduled_at).getTime() + b.duration_minutes * 60000).toISOString(),
        }));
      }

      return { interviewer_id: interviewerId, source, busy_blocks };
    })
  );

  res.json({ rounds, availability });
});

router.post('/applications/:id/interviews', requireAuth, (req, res) => {
  const { round_name, interviewer_id, duration_minutes, scheduled_at } = req.body;
  if (!round_name) return res.status(400).json({ error: 'round_name is required' });

  const result = db
    .prepare(
      `INSERT INTO interviews (application_id, interviewer_id, round_name, duration_minutes, scheduled_at, status)
       VALUES (?,?,?,?,?, 'Pending')`
    )
    .run(req.params.id, interviewer_id || null, round_name, duration_minutes || 45, scheduled_at || null);

  db.prepare(
    `INSERT INTO activity_log (application_id, type, title, message, actor_id)
     VALUES (?, 'schedule', 'Interview round added', ?, ?)`
  ).run(req.params.id, `${round_name} round added to loop.`, req.user.id);

  const row = db.prepare('SELECT * FROM interviews WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(row);
});

// POST /interviews/:interviewId/send-invites — marks the round Confirmed,
// and if the interviewer has Google Calendar linked, creates a REAL calendar
// event (with a Meet link) and stores its id for future reference/updates.
router.post('/interviews/:interviewId/send-invites', requireAuth, async (req, res) => {
  const interview = db.prepare('SELECT * FROM interviews WHERE id = ?').get(req.params.interviewId);
  if (!interview) return res.status(404).json({ error: 'Interview not found' });

  db.prepare('UPDATE interviews SET status = ? WHERE id = ?').run('Confirmed', req.params.interviewId);

  let activityMessage = `Invite sent for ${interview.round_name}.`;
  let calendarEvent = null;

  if (interview.interviewer_id && interview.scheduled_at) {
    const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(interview.application_id);
    const candidate = db.prepare('SELECT name, email FROM candidates WHERE id = ?').get(app.candidate_id);
    const job = db.prepare('SELECT title FROM jobs WHERE id = ?').get(app.job_id);

    const startISO = interview.scheduled_at;
    const endISO = new Date(new Date(startISO).getTime() + interview.duration_minutes * 60000).toISOString();

    try {
      calendarEvent = await createEvent(interview.interviewer_id, {
        summary: `${interview.round_name} — ${candidate.name} (${job.title})`,
        description: `Talon interview round: ${interview.round_name} for ${candidate.name}, candidate for ${job.title}.`,
        startISO,
        endISO,
        attendees: [candidate.email].filter(Boolean),
      });
    } catch (err) {
      console.error(`Calendar event creation failed for interview ${interview.id}:`, err.message);
    }

    if (calendarEvent) {
      db.prepare('UPDATE interviews SET calendar_event_id = ? WHERE id = ?').run(calendarEvent.id, interview.id);
      activityMessage += calendarEvent.hangoutLink
        ? ` Calendar invite created with Meet link.`
        : ` Calendar invite created.`;
    } else {
      activityMessage += ` (Interviewer hasn't linked Google Calendar â€” invite tracked in Talon only.)`;
    }
  }

  db.prepare(
    `INSERT INTO activity_log (application_id, type, title, message, actor_id)
     VALUES (?, 'schedule', 'Interview invite sent', ?, ?)`
  ).run(interview.application_id, activityMessage, req.user.id);

  res.json({ ok: true, calendar_event: calendarEvent });
});

module.exports = router;
