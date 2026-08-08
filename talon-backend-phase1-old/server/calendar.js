// calendar.js - talks to the real Google Calendar API on behalf of a user
// who has linked their Google account with the calendar scope granted.
//
// How it fits together:
//   - /auth/google/calendar requests Calendar scopes + offline access, so Google
//     hands us a refresh_token we can use forever (until revoked).
//   - We store that refresh_token on the user row (see routes/auth.js).
//   - This file builds a per-user authenticated client from that refresh
//     token, then exposes two functions the scheduling routes call:
//       getFreeBusy(userId, timeMinISO, timeMaxISO) -> [{start,end}, ...]
//       createEvent(userId, {summary, description, startISO, endISO, attendees}) -> event
//
// If a user hasn't linked Google (no refresh token on file), both functions
// return null so callers can fall back to the in-DB "busy" approximation -
// the app keeps working even for accounts that only use password login.

const { google } = require('googleapis');
const db = require('./db');

const DEFAULT_TIME_ZONE = process.env.GOOGLE_CALENDAR_TIME_ZONE || 'Asia/Kolkata';

function calendarDateTime(value) {
  if (!value) return null;

  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(text)) {
    return { dateTime: text, timeZone: DEFAULT_TIME_ZONE };
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return { dateTime: text, timeZone: DEFAULT_TIME_ZONE };
  return { dateTime: date.toISOString() };
}

function clientForUser(userId) {
  const row = db.prepare('SELECT google_refresh_token FROM users WHERE id = ?').get(userId);
  if (!row || !row.google_refresh_token) return null;

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALLBACK_URL
  );
  client.setCredentials({ refresh_token: row.google_refresh_token });
  return client;
}

async function getFreeBusy(userId, timeMinISO, timeMaxISO) {
  const auth = clientForUser(userId);
  if (!auth) return null; // no linked Google account - caller should fall back

  const calendar = google.calendar({ version: 'v3', auth });
  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin: timeMinISO,
      timeMax: timeMaxISO,
      items: [{ id: 'primary' }],
    },
  });

  const busy = response.data.calendars?.primary?.busy || [];
  return busy.map((b) => ({ start: b.start, end: b.end }));
}

async function createEvent(userId, { summary, description, startISO, endISO, attendees }) {
  const auth = clientForUser(userId);
  if (!auth) return null; // no linked Google account - caller should skip real invite creation

  const calendar = google.calendar({ version: 'v3', auth });
  const response = await calendar.events.insert({
    calendarId: 'primary',
    conferenceDataVersion: 1,
    sendUpdates: 'all',
    requestBody: {
      summary,
      description,
      start: calendarDateTime(startISO),
      end: calendarDateTime(endISO),
      attendees: (attendees || []).map((email) => ({ email })),
      conferenceData: {
        createRequest: { requestId: `talon-${Date.now()}` },
      },
    },
  });

  return { id: response.data.id, htmlLink: response.data.htmlLink, hangoutLink: response.data.hangoutLink };
}

module.exports = { getFreeBusy, createEvent };
