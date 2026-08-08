const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const { nextActionFor } = require('../helpers');
const { getFreeBusy } = require('../calendar');

// Frontend adapter routes.
//
// These routes exist only to match the pre-built React frontend's expected
// view-model JSON shape. The original REST routes and database schema remain
// the source of truth for data and mutations. This router is mounted before
// the original routers in index.js, so GET paths that collide with existing
// routes, such as /api/review-inbox, are intentionally shadowed here.

const router = express.Router();

const STAGES = ['Applied', 'Screen', 'Onsite', 'Offer', 'Hired'];
const STAGE_COLORS = {
  Applied: '#5F5D66',
  Screen: '#818CF8',
  Onsite: '#4F55CF',
  Offer: '#F59E0B',
  Hired: '#16A34A',
  Rejected: '#DC2626',
};
const AVATAR_COLORS = ['#4F55CF', '#16A34A', '#B86A06', '#CC3B3B', '#2D71C8', '#6F4ED6', '#0F766E'];
const APPROVAL_ROLE_TO_USER_ROLE = {
  'Hiring manager': 'hiring_manager',
  'VP Engineering': 'admin',
  Finance: 'finance',
};

function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

function avatarColor(seed, fallback) {
  if (fallback) return fallback;
  const text = String(seed || 'talon');
  const total = [...text].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AVATAR_COLORS[total % AVATAR_COLORS.length];
}

function roleLabel(role = '') {
  if (!role) return 'Team member';
  return role
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function statusKey(status = '') {
  return status.toLowerCase().replace(/\s+/g, '_');
}

function statusLabel(status = '') {
  return status || 'Active';
}

function statusTone(status = '') {
  const key = statusKey(status);
  if (key === 'active' || key === 'approved' || key === 'accepted') return 'success';
  if (key === 'on_hold' || key === 'pending_approval' || key === 'pending' || key === 'draft') return 'warning';
  if (key === 'closing' || key === 'sent') return 'info';
  if (key === 'declined' || key === 'rejected') return 'danger';
  return 'neutral';
}

function canDecideApproval(approval, user) {
  if (approval.status !== 'Pending') return false;
  if (approval.approver_id) return Number(approval.approver_id) === Number(user.id);
  return APPROVAL_ROLE_TO_USER_ROLE[approval.approver_role] === user.role;
}

function daysSince(dateStr) {
  if (!dateStr) return 0;
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function money(value) {
  if (value === null || value === undefined || value === '') return 'Not set';
  return `$${Number(value).toLocaleString('en-US')}`;
}

function moneyK(value) {
  if (value === null || value === undefined || value === '') return 'not set';
  return `$${Number(value).toLocaleString('en-US')}k`;
}

function salaryBand(min, max) {
  if (!min && !max) return 'band not set';
  return `band ${money(min)} to ${money(max)}`;
}

function formatDate(dateStr) {
  if (!dateStr) return 'Not set';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(dateStr));
}

function formatDayLabel(date) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).format(date);
}

function formatTime(date) {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date);
}

function stageId(stage) {
  return stage.toLowerCase().replace(/\s+/g, '-');
}

function median(nums) {
  const sorted = [...nums].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function jobSummary(job) {
  const manager = db.prepare('SELECT id, name, avatar_color FROM users WHERE id = ?').get(job.hiring_manager_id);
  const apps = db.prepare('SELECT stage FROM applications WHERE job_id = ?').all(job.id);

  const activeCount = apps.filter((app) => app.stage !== 'Rejected').length;
  const inProcessCount = apps.filter((app) => app.stage !== 'Hired' && app.stage !== 'Rejected').length;

  return {
    id: job.id,
    code: job.code,
    title: job.title,
    location: job.location,
    department: job.department,
    status: statusKey(job.status),
    owner: manager
      ? {
          name: manager.name,
          initials: initials(manager.name),
          color: avatarColor(manager.name, manager.avatar_color),
        }
      : null,
    pipeline: {
      inProcess: inProcessCount,
      active: activeCount,
      stages: STAGES.map((stage) => ({
        label: stage.toLowerCase(),
        value: apps.filter((app) => app.stage === stage).length,
        color: STAGE_COLORS[stage],
      })),
    },
  };
}

function reportsOverview(days = 30) {
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const hired = db
    .prepare("SELECT created_at FROM applications WHERE stage = 'Hired' AND created_at >= ?")
    .all(since);
  const timeToHireDays = hired.length
    ? Math.round(
        hired.reduce((sum, app) => sum + (Date.now() - new Date(app.created_at).getTime()) / 86400000, 0) /
          hired.length
      )
    : 0;

  const respondedOffers = db.prepare("SELECT status FROM offers WHERE status IN ('Accepted','Declined')").all();
  const offerAcceptRate = respondedOffers.length
    ? Math.round((respondedOffers.filter((offer) => offer.status === 'Accepted').length / respondedOffers.length) * 100)
    : 0;

  const activeCandidates = db
    .prepare("SELECT COUNT(*) as c FROM applications WHERE stage NOT IN ('Hired','Rejected')")
    .get().c;
  const interviewsThisWeek = db
    .prepare("SELECT COUNT(*) as c FROM interviews WHERE scheduled_at >= datetime('now','-7 days')")
    .get().c;

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

  const interviewsPerWeek = [];
  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date(Date.now() - i * 7 * 86400000);
    const weekEnd = new Date(Date.now() - (i - 1) * 7 * 86400000);
    const count = db
      .prepare('SELECT COUNT(*) as c FROM interviews WHERE scheduled_at >= ? AND scheduled_at < ?')
      .get(weekStart.toISOString(), weekEnd.toISOString()).c;
    interviewsPerWeek.push({ week_label: `W${8 - i}`, count });
  }

  return {
    time_to_hire_days: timeToHireDays,
    offer_accept_rate: offerAcceptRate,
    active_candidates: activeCandidates,
    interviews_this_week: interviewsThisWeek,
    pipeline_conversion: pipelineConversion,
    hires_by_source: hiresBySource,
    interviews_per_week: interviewsPerWeek,
  };
}

router.get('/login/highlights', (req, res) => {
  const overview = reportsOverview(30);
  const candidateCount = db.prepare('SELECT COUNT(*) as c FROM candidates').get().c;
  const preview = db
    .prepare(
      `SELECT a.id as application_id, a.stage, c.name, c.current_title, c.current_company, j.title as job_title
       FROM applications a
       JOIN candidates c ON c.id = a.candidate_id
       JOIN jobs j ON j.id = a.job_id
       WHERE a.stage NOT IN ('Hired','Rejected')
       ORDER BY CASE a.stage WHEN 'Onsite' THEN 1 WHEN 'Offer' THEN 2 WHEN 'Screen' THEN 3 ELSE 4 END, a.id
       LIMIT 1`
    )
    .get();

  res.json({
    stats: [
      { value: `${overview.time_to_hire_days}d`, label: 'time to hire' },
      { value: `${overview.offer_accept_rate}%`, label: 'offer accept rate' },
      { value: String(candidateCount), label: 'candidates' },
    ],
    candidate: preview
      ? {
          id: preview.application_id,
          initials: initials(preview.name),
          name: preview.name,
          meta: `${preview.current_title || 'Candidate'} at ${preview.current_company || preview.job_title}`,
          status: preview.stage,
        }
      : null,
  });
});

router.get('/sidebar', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const firstJob =
    db.prepare("SELECT id FROM jobs WHERE status = 'Active' ORDER BY id LIMIT 1").get() ||
    db.prepare('SELECT id FROM jobs ORDER BY id LIMIT 1').get();
  const firstApp =
    db
      .prepare("SELECT id FROM applications WHERE stage NOT IN ('Hired','Rejected') ORDER BY id LIMIT 1")
      .get() || db.prepare('SELECT id FROM applications ORDER BY id LIMIT 1').get();
  const schedulingApp =
    db
      .prepare(
        `SELECT DISTINCT application_id as id FROM interviews
         WHERE status IN ('Pending','Confirmed') ORDER BY application_id LIMIT 1`
      )
      .get() || firstApp;
  const firstOffer =
    db
      .prepare("SELECT id FROM offers WHERE status NOT IN ('Accepted','Declined') ORDER BY id LIMIT 1")
      .get() || db.prepare('SELECT id FROM offers ORDER BY id LIMIT 1').get();

  res.json({
    user: user
      ? {
          name: user.name,
          role: roleLabel(user.role),
          initials: initials(user.name),
          avatarColor: avatarColor(user.name, user.avatar_color),
        }
      : null,
    counts: {
      jobs: db.prepare("SELECT COUNT(*) as c FROM jobs WHERE status != 'Closed'").get().c,
      pipeline: db.prepare("SELECT COUNT(*) as c FROM applications WHERE stage NOT IN ('Hired','Rejected')").get().c,
      reviewInbox: db.prepare("SELECT COUNT(*) as c FROM applications WHERE stage = 'Applied'").get().c,
      scheduling: db.prepare("SELECT COUNT(*) as c FROM interviews WHERE status = 'Pending'").get().c,
      offers: db.prepare("SELECT COUNT(*) as c FROM offers WHERE status NOT IN ('Accepted','Declined')").get().c,
    },
    links: {
      jobs: '/jobs',
      pipeline: firstJob ? `/pipeline/${firstJob.id}` : null,
      reviewInbox: '/review-inbox',
      candidates: firstApp ? `/candidates/${firstApp.id}` : null,
      scheduling: schedulingApp ? `/scheduling/${schedulingApp.id}` : null,
      offers: firstOffer ? `/offers/${firstOffer.id}` : null,
      reports: '/reports',
    },
  });
});

router.get('/jobs', requireAuth, (req, res) => {
  const jobs = db.prepare('SELECT * FROM jobs ORDER BY department, title').all();
  res.json(jobs.map(jobSummary));
});

router.get('/jobs/new', requireAuth, (req, res) => {
  const departments = db.prepare('SELECT DISTINCT department FROM jobs ORDER BY department').all().map((row) => row.department);
  const locations = db.prepare('SELECT DISTINCT location FROM jobs ORDER BY location').all().map((row) => row.location);

  res.json({
    topTitle: 'Jobs / New job',
    hasNotifications: true,
    title: 'New job',
    stepLabel: 'Step 1 of 4',
    steps: [
      { number: 1, label: 'Role basics', active: true },
      { number: 2, label: 'Hiring team' },
      { number: 3, label: 'Plan' },
      { number: 4, label: 'Review' },
    ],
    form: {
      titleLabel: 'Job title',
      titlePlaceholder: 'e.g. Senior Backend Engineer',
      departmentLabel: 'Department',
      departments: departments.map((department) => ({
        label: department,
        value: department,
        selected: department === 'Engineering',
      })),
      locationLabel: 'Location',
      locations: locations.map((location) => ({
        label: location,
        value: location,
        selected: location === 'Remote (US)',
      })),
      bandMinLabel: 'Band min (k)',
      bandMaxLabel: 'Band max (k)',
      defaults: { title: '', bandMin: '180', bandMax: '220' },
    },
    actions: {
      cancel: 'Cancel',
      back: '<- Back',
      continue: 'Continue ->',
      submitting: 'Continuing...',
    },
  });
});

router.get('/pipeline/:jobId', requireAuth, (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const manager = db.prepare('SELECT id, name FROM users WHERE id = ?').get(job.hiring_manager_id);
  const apps = db
    .prepare(
      `SELECT a.*, c.name as candidate_name, c.current_title, c.current_company, c.source,
              r.name as recruiter_name
       FROM applications a
       JOIN candidates c ON c.id = a.candidate_id
       LEFT JOIN users r ON r.id = a.recruiter_id
       WHERE a.job_id = ? AND a.stage != 'Rejected'
       ORDER BY a.stage_entered_at ASC`
    )
    .all(req.params.jobId);
  const totalNonRejected = apps.length;

  const stages = STAGES.map((stage) => {
    const inStage = apps.filter((app) => app.stage === stage);
    const stageIndex = STAGES.indexOf(stage);
    const reachedOrBeyond = apps.filter((app) => STAGES.indexOf(app.stage) >= stageIndex).length;
    const passPercent = stage === 'Hired' || !totalNonRejected ? 0 : Math.round((reachedOrBeyond / totalNonRejected) * 100);

    return {
      id: stageId(stage),
      name: stage,
      count: inStage.length,
      color: STAGE_COLORS[stage],
      passPercent,
      passLabel: stage === 'Hired' ? 'closed' : `${passPercent}% pass`,
      medianLabel: `median ${median(inStage.map((app) => daysSince(app.stage_entered_at)))}d`,
      candidates: inStage.map((app) => {
        const nextAction = nextActionFor(app.id);
        return {
          id: app.id,
          initials: initials(app.candidate_name),
          avatarColor: avatarColor(app.candidate_name),
          name: app.candidate_name,
          headline: `${app.current_title || 'Candidate'} at ${app.current_company || 'Unknown'}`,
          tags: [app.source].filter(Boolean),
          stage,
          source: app.source || '',
          recruiter: app.recruiter_name || 'Unassigned',
          rating: app.rating ? Number(app.rating).toFixed(1) : null,
          meta: [
            { label: `${daysSince(app.stage_entered_at)}d in stage` },
            nextAction ? { label: nextAction, tone: 'danger' } : { label: 'Ready' },
          ],
        };
      }),
    };
  });

  res.json({
    topTitle: `Jobs / ${job.title}`,
    hasNotifications: true,
    job: {
      id: job.id,
      title: job.title,
      department: job.department,
      location: job.location,
      status: job.status,
      bandMin: job.band_min,
      bandMax: job.band_max,
      ownerName: manager?.name || null,
      statusLabel: statusLabel(job.status),
      statusTone: statusTone(job.status),
      metaItems: [job.code, job.location, manager?.name].filter(Boolean),
    },
    actions: { secondary: 'Edit job', primary: 'Add candidate' },
    tabs: [
      { label: 'Pipeline', active: true },
      { label: 'Candidates', count: totalNonRejected },
      { label: 'Job details' },
      { label: 'Hiring team' },
    ],
    filters: {
      searchLabel: 'Filter candidates',
      searchPlaceholder: 'Filter candidates',
      controls: [
        { label: 'Stage', value: 'All' },
        { label: 'Source', value: 'Any' },
        { label: 'Recruiter', value: 'All' },
      ],
      summary: `${totalNonRejected} shown - sort: time in stage`,
    },
    stages,
  });
});

router.get('/review-inbox', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT a.id as application_id, a.stage_entered_at, c.*
       FROM applications a
       JOIN candidates c ON c.id = a.candidate_id
       WHERE a.stage = 'Applied'
       ORDER BY a.stage_entered_at ASC`
    )
    .all();

  function highlights(candidate) {
    const items = [];
    if (candidate.years_experience) items.push(`${candidate.years_experience} yrs experience`);
    if (candidate.current_title && candidate.current_company) {
      items.push(`Currently ${candidate.current_title} at ${candidate.current_company}`);
    }
    if (candidate.source) items.push(`Sourced via ${candidate.source}`);
    return items;
  }

  const queueItems = rows.map((row) => ({
    id: row.application_id,
    initials: initials(row.name),
    avatarColor: avatarColor(row.name),
    name: row.name,
    headline: `${row.current_title || 'Candidate'}${row.current_company ? ` at ${row.current_company}` : ''}`,
    ageLabel: `${daysSince(row.stage_entered_at)}d`,
  }));

  const details = rows.map((row) => {
    const waiting = daysSince(row.stage_entered_at);
    return {
      id: row.application_id,
      initials: initials(row.name),
      avatarColor: avatarColor(row.name),
      name: row.name,
      summary: `${row.current_title || 'Candidate'}${row.current_company ? ` at ${row.current_company}` : ''} - ${
        row.location || 'Location unknown'
      } - applied ${waiting}d ago`,
      actions: {
        secondary: 'Reject',
        secondaryShortcut: 'R',
        primary: 'Advance to Screen',
        primaryShortcut: 'A',
      },
      sections: [
        { title: 'Cover note', body: row.cover_note || 'No cover note provided.' },
        { title: 'Resume highlights', items: highlights(row) },
      ],
      signalTitle: 'Signal',
      signals: [
        {
          label: 'Years experience',
          value: row.years_experience ? String(row.years_experience) : 'Unknown',
          tone: row.years_experience >= 5 ? 'success' : 'warning',
        },
        {
          label: 'Stack match',
          value: row.years_experience >= 5 ? 'Strong' : 'Moderate',
          tone: row.years_experience >= 5 ? 'success' : 'warning',
        },
        {
          label: 'Location',
          value: row.location ? 'Remote OK' : 'Unknown',
          tone: row.location ? 'success' : 'neutral',
        },
      ],
      keyboardHint: 'Keyboard: A advance, R reject, up/down navigate',
    };
  });

  res.json({
    topTitle: 'Review inbox',
    hasNotifications: true,
    selectedId: rows[0]?.application_id || null,
    queue: {
      title: 'Review queue',
      waitingLabel: `${rows.length} waiting`,
      progressPercent: 0,
      progressLabel: `0 of ${rows.length} reviewed today`,
      items: queueItems,
    },
    details,
    selected: details[0] || null,
    emptyMessage: 'No candidates are waiting for review.',
  });
});

router.get('/candidates/:id', requireAuth, (req, res) => {
  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });

  const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(app.candidate_id);
  const job = db.prepare('SELECT id, title, code FROM jobs WHERE id = ?').get(app.job_id);
  const recruiter = db.prepare('SELECT id, name FROM users WHERE id = ?').get(app.recruiter_id);
  const activity = db.prepare('SELECT * FROM activity_log WHERE application_id = ? ORDER BY created_at DESC').all(app.id);
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

  const nextAction = nextActionFor(app.id);

  res.json({
    topTitle: `${job.title} / ${candidate.name}`,
    hasNotifications: true,
    schedulingAppId: app.id,
    candidate: {
      applicationId: app.id,
      initials: initials(candidate.name),
      avatarColor: avatarColor(candidate.name),
      name: candidate.name,
      summary: `${candidate.current_title || 'Candidate'} at ${candidate.current_company || 'Unknown'} - ${
        candidate.location || 'Location unknown'
      }`,
      stageAgeLabel: `${daysSince(app.stage_entered_at)}d in ${app.stage}`,
    },
    actions: {
      reject: app.stage === 'Rejected' || app.stage === 'Hired' ? null : 'Reject',
      schedule: 'Schedule',
      advance: app.stage === 'Hired' || app.stage === 'Rejected' ? null : 'Advance ->',
    },
    stages: STAGES.map((stage) => ({ label: stage, active: stage === app.stage })),
    tabs: [
      { label: 'Activity', active: true, count: activity.length },
      { label: 'Emails', count: activity.filter((item) => item.type === 'email').length },
      { label: 'Scorecards', count: scorecards.length },
      { label: 'Interviews', count: interviews.length },
    ],
    nextAction: nextAction
      ? {
          label: 'Next action',
          body: nextAction,
          buttonLabel: 'Open scheduling',
        }
      : null,
    noteBox: { placeholder: 'Log a note, @ to mention', buttonLabel: 'Add note' },
    activity: activity.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      body: item.message,
      timeLabel: timeAgo(item.created_at),
      tone:
        item.type === 'email'
          ? 'blue'
          : item.type === 'scorecard'
            ? 'success'
            : item.type === 'schedule'
              ? 'warning'
        : 'neutral',
    })),
    interviews: interviews.map((interview) => ({
      id: interview.id,
      roundName: interview.round_name,
      interviewerName: interview.interviewer_name || 'Unassigned',
      scheduledAt: interview.scheduled_at,
      durationMinutes: interview.duration_minutes,
      status: interview.status,
    })),
    scorecards: scorecards.map((scorecard) => ({
      id: scorecard.id,
      roundName: scorecard.round_name,
      interviewerName: scorecard.interviewer_name || 'Unassigned',
      rating: scorecard.rating,
      maxRating: scorecard.max_rating,
      recommendation: scorecard.recommendation,
      notes: scorecard.notes,
    })),
    sidebarSections: [
      {
        title: 'Details',
        fields: [
          { label: 'Email', value: candidate.email || 'Not provided' },
          { label: 'Phone', value: candidate.phone || 'Not provided' },
          { label: 'Location', value: candidate.location || 'Not provided' },
          { label: 'Source', value: candidate.source || 'Unknown' },
          { label: 'Recruiter', value: recruiter?.name || 'Unassigned' },
          { label: 'Comp expectation', value: candidate.comp_expectation || 'Not provided' },
          { label: 'Notice period', value: candidate.notice_period || 'Not provided' },
        ],
      },
      {
        title: 'Links',
        links: [
          candidate.resume_url && candidate.resume_url !== '#' ? { label: 'Resume', href: candidate.resume_url } : null,
          candidate.linkedin_url && candidate.linkedin_url !== '#'
            ? { label: 'LinkedIn', href: candidate.linkedin_url }
            : null,
          candidate.github_url && candidate.github_url !== '#' ? { label: 'Portfolio', href: candidate.github_url } : null,
        ].filter(Boolean),
      },
    ],
  });
});

async function schedulingAvailability(rounds, applicationId, selectedDate) {
  const interviewerIds = [...new Set(rounds.map((round) => round.interviewer_id).filter(Boolean))];
  const dayStart = new Date(selectedDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  return Promise.all(
    interviewerIds.map(async (interviewerId) => {
      let busyBlocks = null;
      let source = 'talon';

      try {
        const realBusy = await getFreeBusy(interviewerId, dayStart.toISOString(), dayEnd.toISOString());
        if (realBusy) {
          busyBlocks = realBusy;
          source = 'google_calendar';
        }
      } catch (err) {
        console.error(`Calendar freebusy failed for user ${interviewerId}:`, err.message);
      }

      if (!busyBlocks) {
        const dbBusy = db
          .prepare(
            `SELECT scheduled_at, duration_minutes FROM interviews
             WHERE interviewer_id = ?
               AND status IN ('Confirmed','Completed')
               AND application_id != ?
               AND scheduled_at IS NOT NULL`
          )
          .all(interviewerId, applicationId);

        busyBlocks = dbBusy.map((block) => ({
          start: block.scheduled_at,
          end: new Date(new Date(block.scheduled_at).getTime() + block.duration_minutes * 60000).toISOString(),
        }));
      }

      return { interviewer_id: interviewerId, source, busy_blocks: busyBlocks };
    })
  );
}

function overlaps(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

router.get('/scheduling/:appId', requireAuth, async (req, res) => {
  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.appId);
  if (!app) return res.status(404).json({ error: 'Application not found' });

  const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(app.candidate_id);
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(app.job_id);
  const rounds = db
    .prepare(
      `SELECT i.*, u.name as interviewer_name, u.avatar_color
       FROM interviews i
       LEFT JOIN users u ON u.id = i.interviewer_id
       WHERE i.application_id = ?
       ORDER BY i.id`
    )
    .all(app.id);

  const firstScheduled = rounds.find((round) => round.scheduled_at)?.scheduled_at;
  const selectedDate = firstScheduled ? new Date(firstScheduled) : new Date();
  const availability = await schedulingAvailability(rounds, app.id, selectedDate);
  const availabilityByInterviewer = new Map(availability.map((item) => [item.interviewer_id, item]));

  const columns = rounds.map((round) => ({
    id: round.interviewer_id || `round-${round.id}`,
    initials: initials(round.interviewer_name || round.round_name),
    avatarColor: avatarColor(round.interviewer_name || round.round_name, round.avatar_color),
    name: round.interviewer_name || 'Unassigned',
  }));

  const rows = [];
  const gridStart = new Date(selectedDate);
  gridStart.setHours(9, 0, 0, 0);

  for (let index = 0; index <= 14; index++) {
    const slotStart = new Date(gridStart.getTime() + index * 30 * 60000);
    const slotEnd = new Date(slotStart.getTime() + 30 * 60000);

    rows.push({
      timeLabel: slotStart.getMinutes() === 0 ? formatTime(slotStart).replace(':00', ':00') : '',
      cells: rounds.map((round) => {
        const columnId = round.interviewer_id || `round-${round.id}`;
        const scheduledStart = round.scheduled_at ? new Date(round.scheduled_at) : null;
        const scheduledEnd = scheduledStart ? new Date(scheduledStart.getTime() + round.duration_minutes * 60000) : null;
        if (scheduledStart && overlaps(slotStart, slotEnd, scheduledStart, scheduledEnd)) {
          return { columnId, type: 'selected', label: round.round_name };
        }

        const availabilityItem = round.interviewer_id ? availabilityByInterviewer.get(round.interviewer_id) : null;
        const busy = availabilityItem?.busy_blocks?.some((block) =>
          overlaps(slotStart, slotEnd, new Date(block.start), new Date(block.end))
        );
        if (busy) return { columnId, type: 'busy', label: 'Busy' };
        return { columnId, type: 'empty' };
      }),
    });
  }

  const pendingCount = rounds.filter((round) => round.status === 'Pending').length;
  const firstInviteTime = rounds.find((round) => round.scheduled_at)?.scheduled_at;
  const currentUser = db
    .prepare('SELECT google_refresh_token IS NOT NULL as has_calendar FROM users WHERE id = ?')
    .get(req.user.id);
  const hasCalendar = Boolean(currentUser?.has_calendar);

  res.json({
    topTitle: `${candidate.name} / Schedule onsite loop`,
    hasNotifications: true,
    candidate: {
      initials: initials(candidate.name),
      avatarColor: avatarColor(candidate.name),
      name: candidate.name,
      summary: `${app.stage} loop - ${job.title}`,
    },
    roundsLabel: `Loop, ${rounds.length} rounds`,
    rounds: rounds.map((round) => ({
      id: round.id,
      initials: initials(round.interviewer_name || round.round_name),
      avatarColor: avatarColor(round.interviewer_name || round.round_name, round.avatar_color),
      name: round.interviewer_name || 'Unassigned',
      detail: `${round.round_name}, ${round.duration_minutes || 45} min`,
      status: round.status,
      statusTone: round.status === 'Confirmed' || round.status === 'Completed' ? 'success' : 'warning',
    })),
    warning: pendingCount ? `${pendingCount} round${pendingCount === 1 ? '' : 's'} still need confirmation.` : null,
    actions: {
      secondary: hasCalendar ? 'Google Calendar connected' : 'Connect Google Calendar',
      secondaryUrl: hasCalendar ? null : '/auth/google/calendar/start',
      primary: firstInviteTime ? `Send invites, ${formatTime(new Date(firstInviteTime))}` : 'Send invites',
    },
    calendar: {
      dateLabel: formatDayLabel(selectedDate),
      modes: [{ label: 'Day', active: true }, { label: 'Week' }],
      note: 'Times local, candidate available 9 to 4',
      legend: [
        { label: 'busy', type: 'busy' },
        { label: 'selected loop', type: 'selected' },
      ],
      columns,
      rows,
    },
  });
});

router.get('/offers/:id', requireAuth, (req, res) => {
  const offer = db.prepare('SELECT * FROM offers WHERE id = ?').get(req.params.id);
  if (!offer) return res.status(404).json({ error: 'Offer not found' });

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(offer.application_id);
  const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(app.candidate_id);
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(app.job_id);
  const manager = db.prepare('SELECT name FROM users WHERE id = ?').get(job.hiring_manager_id);
  const approvals = db
    .prepare(
      `SELECT oa.*, u.name as approver_name
       FROM offer_approvals oa
       LEFT JOIN users u ON u.id = oa.approver_id
       WHERE oa.offer_id = ?
       ORDER BY oa.sequence ASC`
    )
    .all(offer.id);

  const firstName = candidate.name.split(/\s+/)[0];

  res.json({
    topTitle: `${candidate.name}, ${offer.level || 'Offer'}`,
    hasNotifications: true,
    offer: {
      title: `Offer: ${candidate.name}`,
      statusLabel: offer.status,
      statusTone: statusTone(offer.status),
      versionLabel: `v${offer.version} - created ${timeAgo(offer.created_at)}`,
      rows: [
        { label: 'Candidate', value: candidate.name },
        { label: 'Role', value: job.title },
        { label: 'Level', value: offer.level || 'Not set' },
        {
          label: 'Base salary',
          value: money(offer.base_salary),
          badge: salaryBand(offer.band_min, offer.band_max),
        },
        { label: 'Equity', value: `${Number(offer.equity_options || 0).toLocaleString('en-US')} options` },
        { label: 'Sign-on bonus', value: money(offer.signon_bonus || 0) },
        { label: 'Start date', value: formatDate(offer.start_date) },
        { label: 'Expires', value: formatDate(offer.expires_at) },
      ],
      actions: {
        primary:
          offer.status === 'Draft'
            ? 'Send for approval'
            : offer.status === 'Approved'
              ? 'Send offer'
              : offer.status === 'Sent'
                ? 'Record response'
                : 'Send approval reminder',
        secondary: 'Preview letter',
      },
      approvalTitle: 'Approval chain',
      approvalChain: approvals.map((approval) => {
        const canDecide = canDecideApproval(approval, req.user);
        return {
          id: approval.id,
          name: approval.approver_name || approval.approver_role,
          role: approval.approver_role,
          status: approval.status,
          statusTone: statusTone(approval.status),
          decisionActions: canDecide ? { approve: 'Approve', reject: 'Reject' } : null,
        };
      }),
      letter: {
        title: 'Talon Inc. Offer of Employment',
        paragraphs: [
          `Dear ${firstName},`,
          {
            parts: [
              { text: 'We are delighted to offer you the position of ' },
              { text: job.title, bold: true },
              { text: ` (${offer.level || 'level to be confirmed'}) at Talon, reporting to ` },
              { text: manager?.name || 'the hiring manager' },
              { text: `. Your annualized base salary will be ${money(offer.base_salary)}, with an equity grant of ` },
              { text: `${Number(offer.equity_options || 0).toLocaleString('en-US')} options`, bold: true },
              { text: ` vesting over ${offer.equity_vest_years || 4} years.` },
            ],
          },
          `Your anticipated start date is ${formatDate(offer.start_date)}. This offer expires on ${formatDate(
            offer.expires_at
          )}.`,
        ],
        closing: ['Warmly,', 'Maya Reyes - Recruiting, Talon'],
      },
    },
  });
});

router.get('/reports', requireAuth, (req, res) => {
  const overview = reportsOverview(30);
  const maxPipelineCount = Math.max(1, ...overview.pipeline_conversion.map((item) => item.count));
  const maxTrendCount = Math.max(1, ...overview.interviews_per_week.map((item) => item.count));

  res.json({
    topTitle: 'Recruiting overview',
    hasNotifications: true,
    title: 'Reports',
    subtitle: 'Last 30 days - all departments',
    metrics: [
      { label: 'Time to hire', value: `${overview.time_to_hire_days}d`, delta: 'live from hired applications' },
      { label: 'Offer accept rate', value: `${overview.offer_accept_rate}%`, delta: 'accepted vs declined offers' },
      { label: 'Active candidates', value: String(overview.active_candidates), delta: 'currently in process' },
      { label: 'Interviews this week', value: String(overview.interviews_this_week), delta: 'scheduled rounds' },
    ],
    pipelineConversion: {
      title: 'Pipeline conversion',
      items: overview.pipeline_conversion.map((item) => ({
        label: item.stage,
        value: String(item.count),
        percent: Math.round((item.count / maxPipelineCount) * 100),
        color: STAGE_COLORS[item.stage],
      })),
    },
    hiresBySource: {
      title: 'Hires by source',
      items: overview.hires_by_source.map((item, index) => ({
        label: item.source || 'Unknown',
        value: `${item.count} ${item.count === 1 ? 'hire' : 'hires'}`,
        color: AVATAR_COLORS[index % AVATAR_COLORS.length],
      })),
    },
    interviewsTrend: {
      title: 'Interviews per week',
      caption: '8 week trend',
      items: overview.interviews_per_week.map((item, index, items) => ({
        label: item.week_label,
        value: item.count,
        heightPercent: Math.round((item.count / maxTrendCount) * 100),
        active: index === items.length - 1,
      })),
    },
  });
});

module.exports = router;
