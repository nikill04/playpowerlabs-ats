require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Registered first and unauthenticated on purpose — a health check must never
// depend on route-ordering luck with other routers.
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api', require('./routes/frontend'));

// Every route file is small and named after the resource it owns —
// look in /routes to find the code for a given screen.
app.use('/api/auth', require('./routes/auth'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/review-inbox', require('./routes/reviewInbox'));
app.use('/api', require('./routes/offers')); // owns /offers/:id, /applications/:id/offers, /offer-approvals/:id/decide
app.use('/api/reports', require('./routes/reports'));
app.use('/api/candidates', require('./routes/candidates'));
app.use('/api', require('./routes/scheduling')); // owns /applications/:id/scheduling + /interviews/:id/send-invites
app.use('/api', require('./routes/misc')); // owns /search + /candidates/bulk-import


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Talon API listening on http://localhost:${PORT}`);
});
