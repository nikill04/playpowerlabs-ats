# Jobs page API contract

Base URL: `http://localhost:4000/api`

JSON examples use the reference screenshot values only to document shape. The
frontend does not seed these values; the backend response controls the content.

## GET /api/sidebar

Powers the left nav, nav counts, optional deep links, and signed-in user
footer.

```json
{
  "user": {
    "name": "Maya Reyes",
    "role": "Recruiting lead",
    "initials": "MR",
    "avatarColor": "#16A34A"
  },
  "counts": {
    "jobs": 6,
    "pipeline": 9,
    "reviewInbox": 4,
    "scheduling": 4,
    "offers": 1
  },
  "links": {
    "jobs": "/jobs",
    "pipeline": "/pipeline/eng-204",
    "reviewInbox": "/review-inbox",
    "candidates": "/candidates/ana-petrova",
    "scheduling": "/scheduling/ana-petrova-onsite",
    "offers": "/offers/sofia-lindqvist",
    "reports": "/reports"
  }
}
```

`links.jobs`, `links.reviewInbox`, and `links.reports` may use the static
routes shown above. The parameterized links (`pipeline`, `candidates`,
`scheduling`, and `offers`) should include real backend IDs so the sidebar can
navigate without relying on any frontend-seeded IDs. If these parameterized
links are omitted, the matching sidebar items render disabled.

## GET /api/jobs

Powers the job list. Can return either a bare array or `{ "jobs": [...] }`.
The page groups jobs by `department`, preserving the order departments first
appear in, and derives open counts from the returned jobs.

```json
[
  {
    "id": "eng-204",
    "code": "ENG-204",
    "title": "Senior Product Engineer",
    "location": "Remote (US)",
    "department": "Engineering",
    "status": "active",
    "owner": {
      "name": "Maya Reyes",
      "initials": "MR",
      "color": "#B45309"
    },
    "pipeline": {
      "inProcess": 18,
      "active": 38,
      "stages": [
        { "label": "sourced", "value": 12, "color": "#CBD5E1" },
        { "label": "screening", "value": 10, "color": "#818CF8" },
        { "label": "interview", "value": 9, "color": "#6366F1" },
        { "label": "offer", "value": 3, "color": "#F59E0B" }
      ]
    }
  }
]
```

`status` must be one of `"active"`, `"on_hold"`, or `"closing"`.
