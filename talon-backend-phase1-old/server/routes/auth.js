const express = require('express');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const db = require('../db');
const { signToken, signPendingToken, requireAuth, JWT_SECRET } = require('../auth');

const router = express.Router();

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_CALLBACK_URL
);

const BASIC_GOOGLE_SCOPES = ['openid', 'email', 'profile'];
const CALENDAR_SCOPES = [
  ...BASIC_GOOGLE_SCOPES,
  'https://www.googleapis.com/auth/calendar.freebusy',
  'https://www.googleapis.com/auth/calendar.events.owned',
];

function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CALLBACK_URL);
}

function redirectAuthError(res, message) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  return res.redirect(`${frontendUrl}/auth/callback#error=${encodeURIComponent(message)}`);
}

function callbackRedirect(res, frontendUrl, params) {
  return res.redirect(`${frontendUrl}/auth/callback#${new URLSearchParams(params).toString()}`);
}

function safeReturnTo(value) {
  if (typeof value !== 'string') return '/jobs';
  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || /[\r\n]/.test(trimmed)) return '/jobs';
  return trimmed;
}

function calendarAuthUrl(state) {
  return googleClient.generateAuthUrl({
    access_type: 'offline',
    include_granted_scopes: true,
    prompt: 'consent',
    scope: CALENDAR_SCOPES,
    state,
  });
}

function parseCalendarState(rawState) {
  if (!rawState || rawState === 'calendar') return null;
  try {
    const state = jwt.verify(String(rawState), JWT_SECRET);
    if (state.purpose !== 'google_calendar' || !state.user_id) return null;
    return {
      userId: state.user_id,
      returnTo: safeReturnTo(state.return_to),
    };
  } catch (err) {
    throw new Error('Calendar connection expired. Start again from Scheduling.');
  }
}

// Shared "did login succeed, now what" logic used by both password login
// and Google login: if the account has 2FA on, hand back a pending token
// that only works against /2fa/verify. Otherwise hand back a full token.
function respondAfterLogin(res, row) {
  const user = { id: row.id, name: row.name, email: row.email, role: row.role };
  if (row.totp_enabled) {
    return res.json({ requires_2fa: true, pending_token: signPendingToken(user) });
  }
  return res.json({ requires_2fa: false, token: signToken(user), user });
}

// ---------- Email + password ----------

router.post('/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email, and password are required' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'An account with that email already exists' });

  const password_hash = bcrypt.hashSync(password, 8);
  const result = db
    .prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)')
    .run(name, email, password_hash, 'recruiter');

  const user = { id: result.lastInsertRowid, name, email, role: 'recruiter' };
  res.status(201).json({ requires_2fa: false, token: signToken(user), user });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!row || !row.password_hash || !bcrypt.compareSync(password || '', row.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  respondAfterLogin(res, row);
});

// ---------- Google OAuth (server-side redirect flow) ----------

// GET /auth/google — frontend just does window.location = this URL.
// Basic Google sign-in for localhost development. Calendar permissions are
// requested separately at /auth/google/calendar.
router.get('/google', (req, res) => {
  if (!googleConfigured()) return redirectAuthError(res, 'Google OAuth is not configured on the server');

  const url = googleClient.generateAuthUrl({
    scope: BASIC_GOOGLE_SCOPES,
  });
  res.redirect(url);
});

router.get('/google/calendar', (req, res) => {
  if (!googleConfigured()) return redirectAuthError(res, 'Google OAuth is not configured on the server');

  res.redirect(calendarAuthUrl('calendar'));
});

router.post('/google/calendar/start', requireAuth, (req, res) => {
  if (!googleConfigured()) return res.status(503).json({ error: 'Google OAuth is not configured on the server' });

  const state = jwt.sign(
    {
      purpose: 'google_calendar',
      user_id: req.user.id,
      return_to: safeReturnTo(req.body?.return_to),
    },
    JWT_SECRET,
    { expiresIn: '10m' }
  );

  res.json({ url: calendarAuthUrl(state) });
});

// GET /auth/google/callback — Google redirects here with ?code=...
router.get('/google/callback', async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  try {
    if (!googleConfigured()) throw new Error('Google OAuth is not configured on the server');

    const { code } = req.query;
    if (!code) throw new Error('Missing authorization code');

    const { tokens } = await googleClient.getToken(code);
    if (!tokens.id_token) throw new Error('Google did not return an identity token');
    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload(); // { sub, email, name, ... }

    const calendarState = parseCalendarState(req.query.state);
    if (calendarState) {
      const row = db.prepare('SELECT * FROM users WHERE id = ?').get(calendarState.userId);
      if (!row) throw new Error('Talon session expired. Sign in again, then connect Google Calendar.');

      const linked = db.prepare('SELECT id FROM users WHERE google_id = ? AND id != ?').get(payload.sub, row.id);
      if (linked) throw new Error('This Google account is already linked to another Talon user.');

      if (!tokens.refresh_token && !row.google_refresh_token) {
        throw new Error('Google did not return calendar access. Try connecting Google Calendar again.');
      }

      if (tokens.refresh_token) {
        db.prepare('UPDATE users SET google_id = ?, google_refresh_token = ? WHERE id = ?').run(
          payload.sub,
          tokens.refresh_token,
          row.id
        );
      } else if (!row.google_id) {
        db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(payload.sub, row.id);
      }

      const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(row.id);
      const user = { id: updated.id, name: updated.name, email: updated.email, role: updated.role };
      return callbackRedirect(res, frontendUrl, {
        token: signToken(user),
        next: calendarState.returnTo,
      });
    }

    let row = db.prepare('SELECT * FROM users WHERE google_id = ? OR email = ?').get(payload.sub, payload.email);

    if (!row) {
      const result = db
        .prepare('INSERT INTO users (name, email, google_id, google_refresh_token, role) VALUES (?,?,?,?,?)')
        .run(payload.name || payload.email, payload.email, payload.sub, tokens.refresh_token || null, 'recruiter');
      row = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    } else {
      // Existing account (password or returning Google user) — link/refresh
      // the Google id, and only overwrite the refresh token if Google sent
      // a new one (it won't on every login, only on first consent).
      if (tokens.refresh_token) {
        db.prepare('UPDATE users SET google_id = ?, google_refresh_token = ? WHERE id = ?').run(
          payload.sub,
          tokens.refresh_token,
          row.id
        );
      } else if (!row.google_id) {
        db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(payload.sub, row.id);
      }
    }

    // Redirect back to the frontend with either a full token or a pending-2FA
    // token in the URL fragment (not query string, so it never hits server logs).
    const user = { id: row.id, name: row.name, email: row.email, role: row.role };
    if (row.totp_enabled) {
      return callbackRedirect(res, frontendUrl, {
        pending_token: signPendingToken(user),
        requires_2fa: 'true',
      });
    }
    return callbackRedirect(res, frontendUrl, { token: signToken(user) });
  } catch (err) {
    return res.redirect(`${frontendUrl}/auth/callback#error=${encodeURIComponent(err.message)}`);
  }
});

// ---------- TOTP 2FA (Google Authenticator / Authy / etc.) ----------

// POST /auth/2fa/setup — called while already logged in (full token required).
// Generates a secret + QR code the user scans, but does NOT enable 2FA yet —
// that only happens once they prove they scanned it correctly via /2fa/enable.
router.post('/2fa/setup', requireAuth, async (req, res) => {
  const secret = speakeasy.generateSecret({ name: `Talon (${req.user.email})` });
  db.prepare('UPDATE users SET totp_secret = ? WHERE id = ?').run(secret.base32, req.user.id);

  const qrDataUrl = await qrcode.toDataURL(secret.otpauth_url);
  res.json({ secret: secret.base32, qr_code_data_url: qrDataUrl });
});

// POST /auth/2fa/enable — body: { code } — confirms setup and turns 2FA on
router.post('/2fa/enable', requireAuth, (req, res) => {
  const row = db.prepare('SELECT totp_secret FROM users WHERE id = ?').get(req.user.id);
  if (!row || !row.totp_secret) {
    return res.status(400).json({ error: 'Call /2fa/setup first' });
  }
  const verified = speakeasy.totp.verify({
    secret: row.totp_secret,
    encoding: 'base32',
    token: req.body.code,
    window: 1,
  });
  if (!verified) return res.status(400).json({ error: 'Incorrect code' });

  db.prepare('UPDATE users SET totp_enabled = 1 WHERE id = ?').run(req.user.id);
  res.json({ ok: true });
});

// POST /auth/2fa/disable
router.post('/2fa/disable', requireAuth, (req, res) => {
  db.prepare('UPDATE users SET totp_enabled = 0, totp_secret = NULL WHERE id = ?').run(req.user.id);
  res.json({ ok: true });
});

// POST /auth/2fa/verify — body: { pending_token, code } — the second step of
// login when the account has 2FA on. Exchanges the pending token + a valid
// code for a full token.
router.post('/2fa/verify', (req, res) => {
  const { pending_token, code } = req.body;

  let payload;
  try {
    payload = jwt.verify(pending_token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired pending token' });
  }
  if (payload.stage !== 'pending_2fa') return res.status(400).json({ error: 'Not a pending-2FA token' });

  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
  if (!row || !row.totp_secret) return res.status(400).json({ error: '2FA is not set up for this account' });

  const verified = speakeasy.totp.verify({
    secret: row.totp_secret,
    encoding: 'base32',
    token: code,
    window: 1,
  });
  if (!verified) return res.status(401).json({ error: 'Incorrect code' });

  const user = { id: row.id, name: row.name, email: row.email, role: row.role };
  res.json({ token: signToken(user), user });
});

// POST /auth/google/disconnect — revoke local Calendar linkage (requires auth)
router.post('/google/disconnect', requireAuth, (req, res) => {
  db.prepare('UPDATE users SET google_refresh_token = NULL WHERE id = ?').run(req.user.id);
  res.json({ ok: true });
});

// ---------- Current user ----------

router.get('/me', requireAuth, (req, res) => {
  const row = db
    .prepare(
      `SELECT id, name, email, role, avatar_color, totp_enabled,
              google_id IS NOT NULL as has_google,
              google_refresh_token IS NOT NULL as has_calendar
       FROM users WHERE id = ?`
    )
    .get(req.user.id);
  if (!row) return res.status(404).json({ error: 'User not found' });
  res.json(row);
});

module.exports = router;
