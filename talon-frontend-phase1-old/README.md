# Talon frontend

## Setup

```bash
npm install
npm run dev
```

The frontend runs on Vite port `5173`. Open `http://localhost:5173`. Vite is
configured with `strictPort`, so if `5173` is busy it will fail clearly instead
of moving to another frontend port. The root route redirects to `/jobs`.

The backend must run separately at `http://localhost:4000/api`. If Vite reports
that port `5173` is already in use, stop the existing frontend process and run
`npm run dev` again.

The frontend always reads the API base URL from `src/api/config.js`.

## Pages

| Route | Page | File |
| --- | --- | --- |
| `/login` | Login | `src/pages/Login.jsx` |
| `/jobs` | Jobs | `src/pages/Jobs.jsx` |
| `/pipeline/:jobId` | Pipeline | `src/pages/Pipeline.jsx` |
| `/review-inbox` | Review inbox | `src/pages/ReviewInbox.jsx` |
| `/candidates/:id` | Candidate | `src/pages/CandidateDetail.jsx` |
| `/scheduling/:appId` | Scheduling | `src/pages/Scheduling.jsx` |
| `/offers/:id` | Offer | `src/pages/OfferDetail.jsx` |
| `/reports` | Reports | `src/pages/Reports.jsx` |
| `/jobs/new` | New job | `src/pages/NewJob.jsx` |

## Backend

All dynamic data is fetched from `http://localhost:4000/api`, configured in
`src/api/config.js`. Without a backend running there, pages show loading
states and then their error state.

Endpoint contracts:
- Login page: see the "Login endpoints" section below.
- Jobs and sidebar: see `API-CONTRACT-jobs.md`.
- Remaining authenticated pages: see `API-CONTRACT-pages.md`.

The names, candidates, jobs, stages, reports, offer values, sidebar counts,
and login highlights shown in the UI all come from backend responses. The
example values in the API contract files document the expected response shape.

### Login endpoints

- `GET /api/login/highlights`
  ```json
  {
    "candidate": {
      "initials": "AP",
      "name": "Ana Petrova",
      "meta": "Onsite loop Thu, 4 rounds",
      "status": "Onsite"
    },
    "stats": [
      { "value": "24d", "label": "median time to hire" },
      { "value": "86%", "label": "offer accept rate" },
      { "value": "1,240", "label": "candidates this year" }
    ]
  }
  ```
- `POST /api/auth/login`: body `{ "email": string, "password": string }`,
  `200` on success, non-`200` with `{ "message": string }` on failure.
- `GET /api/auth/google`, `GET /api/auth/saml`: OAuth/SSO redirect entry
  points.

## Shared components

- `AppFrame.jsx`: authenticated page frame used by the new pages.
- `Sidebar.jsx` / `TopBar.jsx`: app chrome.
- `Badge.jsx`: status pill (`default`, `neutral`, `success`, `warning`,
  `info` tones).
- `Avatar.jsx`: colored initials circle.
- `ProgressBar.jsx`: segmented pipeline bar.
- `PageState.jsx`: loading/error state block.
- `icons.jsx`: inline icon set used across the app.

## Route notes

The sidebar can consume optional deep links from `GET /api/sidebar` for
parameterized pages such as `/pipeline/:jobId`, `/candidates/:id`,
`/scheduling/:appId`, and `/offers/:id`.

For full navigation, the backend should return `links.pipeline`,
`links.candidates`, `links.scheduling`, and `links.offers` with concrete IDs.
Those sidebar items are disabled until those links are present, because the
frontend does not seed fallback job, candidate, scheduling, or offer IDs. The
route table intentionally uses parameterized routes only.

## Handoff checklist

- React + Vite + plain JavaScript only.
- Plain CSS only; no Tailwind or component UI libraries.
- Pages live in `src/pages/`.
- Shared UI lives in `src/components/`.
- Dynamic page data is loaded with `fetch()` from `http://localhost:4000/api`.
- Loading and error states are present for API-backed screens.
- `npm run build` verifies the frontend bundle.
