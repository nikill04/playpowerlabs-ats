// auth.js — small, readable auth helpers used across routes.
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'talon-dev-secret-change-me';

// A "full" token is issued after password/Google login succeeds AND (if the
// user has 2FA enabled) after the TOTP code is verified. It's what every
// protected route requires.
function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: '7d',
  });
}

// A "pending" token is issued right after password/Google login when the user
// has 2FA enabled but hasn't entered their code yet. It ONLY works against
// POST /auth/2fa/verify — requireAuth rejects it everywhere else.
function signPendingToken(user) {
  return jwt.sign({ id: user.id, stage: 'pending_2fa' }, JWT_SECRET, { expiresIn: '10m' });
}

// Express middleware: reads "Authorization: Bearer <token>", verifies it,
// and attaches the decoded payload to req.user. Rejects with 401 otherwise.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.stage === 'pending_2fa') {
      return res.status(401).json({ error: '2FA verification required' });
    }
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { signToken, signPendingToken, requireAuth, JWT_SECRET };
