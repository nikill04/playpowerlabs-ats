# Remaining Talon pages API contract

Base URL: `http://localhost:4000/api`

Each page accepts API data for screen content. Components tolerate extra
fields, but the fields below are what the current UI reads.

JSON examples use the reference screenshot values only to document shape. The
frontend does not seed these values; the backend response controls the content.

## GET /api/pipeline/:jobId

```json
{
  "topTitle": "Jobs / Senior Product Engineer",
  "hasNotifications": true,
  "job": {
    "title": "Senior Product Engineer",
    "statusLabel": "Active",
    "statusTone": "success",
    "metaItems": ["ENG-204", "Remote (US)", "Maya Reyes"]
  },
  "actions": { "secondary": "Edit job", "primary": "Add candidate" },
  "tabs": [
    { "label": "Pipeline", "active": true },
    { "label": "Candidates", "count": 9 },
    { "label": "Job details" },
    { "label": "Hiring team" }
  ],
  "filters": {
    "searchPlaceholder": "Filter candidates",
    "controls": [
      { "label": "Stage", "value": "All" },
      { "label": "Source", "value": "Any" },
      { "label": "Recruiter", "value": "All" }
    ],
    "summary": "9 shown - sort: time in stage"
  },
  "stages": [
    {
      "id": "applied",
      "name": "Applied",
      "count": 4,
      "color": "#5F5D66",
      "passPercent": 100,
      "passLabel": "100% pass",
      "medianLabel": "median 2d",
      "candidates": [
        {
          "id": "tess-bianchi",
          "initials": "TB",
          "avatarColor": "#CC3B3B",
          "name": "Tess Bianchi",
          "headline": "Frontend Engineer at Halo",
          "tags": ["Agency"],
          "meta": [
            { "label": "4d in stage" },
            { "label": "Review" }
          ]
        }
      ]
    }
  ]
}
```

## GET /api/review-inbox

```json
{
  "topTitle": "Review inbox",
  "hasNotifications": true,
  "selectedId": "jordan-cole",
  "queue": {
    "title": "Review queue",
    "waitingLabel": "4 waiting",
    "progressPercent": 0,
    "progressLabel": "0 of 4 reviewed today",
    "items": [
      {
        "id": "jordan-cole",
        "initials": "JC",
        "avatarColor": "#B86A06",
        "name": "Jordan Cole",
        "headline": "Fullstack at Beacon",
        "ageLabel": "2d"
      }
    ]
  },
  "details": [
    {
      "id": "jordan-cole",
      "initials": "JC",
      "avatarColor": "#B86A06",
      "name": "Jordan Cole",
      "summary": "Fullstack at Beacon - Chicago, IL - applied 2d ago",
      "actions": {
        "secondary": "Reject",
        "secondaryShortcut": "R",
        "primary": "Advance to Screen",
        "primaryShortcut": "A"
      },
      "sections": [
        { "title": "Cover note", "body": "I have spent the last three years..." },
        { "title": "Resume highlights", "items": ["5 yrs fullstack"] }
      ],
      "signalTitle": "Signal",
      "signals": [
        { "label": "Years experience", "value": "5", "tone": "success" }
      ],
      "keyboardHint": "Keyboard: A advance, R reject, up/down navigate"
    }
  ]
}
```

## GET /api/candidates/:id

```json
{
  "topTitle": "Senior Product Engineer / Ana Petrova",
  "hasNotifications": true,
  "schedulingAppId": "ana-petrova-onsite",
  "candidate": {
    "applicationId": "ana-petrova-onsite",
    "initials": "AP",
    "avatarColor": "#6F4ED6",
    "name": "Ana Petrova",
    "summary": "Senior SWE at Meridian - Austin, TX",
    "stageAgeLabel": "3d in Onsite"
  },
  "actions": {
    "reject": "Reject",
    "schedule": "Schedule",
    "advance": "Advance ->"
  },
  "stages": [
    { "label": "Applied" },
    { "label": "Screen" },
    { "label": "Onsite", "active": true },
    { "label": "Offer" },
    { "label": "Hired" }
  ],
  "tabs": [
    { "label": "Activity", "active": true },
    { "label": "Emails", "count": 2 }
  ],
  "nextAction": {
    "label": "Next action",
    "body": "Values round with Maya Reyes is still unconfirmed",
    "buttonLabel": "Open scheduling"
  },
  "noteBox": { "placeholder": "Log a note, @ to mention", "buttonLabel": "Add note" },
  "activity": [
    {
      "id": "onsite-loop",
      "title": "Onsite loop scheduled",
      "body": "4 interviews on Thu Aug 6...",
      "timeLabel": "2h ago",
      "tone": "blue"
    }
  ],
  "sidebarSections": [
    {
      "title": "Details",
      "fields": [
        { "label": "Email", "value": "ana.petrova@gmail.com" }
      ]
    },
    {
      "title": "Links",
      "links": [
        { "label": "Resume", "href": "#" }
      ]
    }
  ]
}
```

## GET /api/scheduling/:appId

```json
{
  "topTitle": "Ana Petrova / Schedule onsite loop",
  "hasNotifications": true,
  "candidate": {
    "initials": "AP",
    "avatarColor": "#6F4ED6",
    "name": "Ana Petrova",
    "summary": "Onsite loop - Senior Product Engineer"
  },
  "roundsLabel": "Loop, 4 rounds",
  "rounds": [
    {
      "id": "lin",
      "initials": "LC",
      "avatarColor": "#2D71C8",
      "name": "Lin Chen",
      "detail": "Coding, 60 min",
      "status": "Confirmed",
      "statusTone": "success"
    }
  ],
  "warning": "Maya Reyes is busy at 10:00...",
  "actions": {
    "secondary": "Hold slot for 24h",
    "primary": "Send invites, 10:00 AM Aug 6"
  },
  "calendar": {
    "dateLabel": "Thursday, Aug 6",
    "modes": [
      { "label": "Day", "active": true },
      { "label": "Week" }
    ],
    "note": "Times in CT, candidate available 9 to 4",
    "legend": [
      { "label": "busy", "type": "busy" },
      { "label": "selected loop", "type": "selected" }
    ],
    "columns": [
      { "id": "lin", "initials": "LC", "avatarColor": "#2D71C8", "name": "Lin C." }
    ],
    "rows": [
      {
        "timeLabel": "9:00",
        "cells": [
          { "columnId": "lin", "type": "busy", "label": "Busy" }
        ]
      }
    ]
  }
}
```

## GET /api/offers/:id

```json
{
  "topTitle": "Sofia Lindqvist, L5",
  "hasNotifications": true,
  "offer": {
    "title": "Offer: Sofia Lindqvist",
    "statusLabel": "Pending approval",
    "statusTone": "warning",
    "versionLabel": "v2 - edited 3h ago",
    "rows": [
      { "label": "Candidate", "value": "Sofia Lindqvist" },
      { "label": "Base salary", "value": "$210,000", "badge": "band $190k to $225k" }
    ],
    "actions": {
      "primary": "Send for approval",
      "secondary": "Preview letter"
    },
    "approvalTitle": "Approval chain",
    "approvalChain": [
      { "name": "Sam Altmann", "role": "Hiring manager", "status": "Approved", "statusTone": "success" }
    ],
    "letter": {
      "title": "Talon Inc. Offer of Employment",
      "paragraphs": [
        {
          "parts": [
            { "text": "Dear Sofia, " },
            { "text": "Senior Product Engineer", "bold": true }
          ]
        }
      ],
      "closing": ["Warmly,", "Maya Reyes - Recruiting, Talon"]
    }
  }
}
```

## GET /api/reports

```json
{
  "topTitle": "Recruiting overview",
  "hasNotifications": true,
  "title": "Reports",
  "subtitle": "Last 30 days - all departments",
  "metrics": [
    { "label": "Time to hire", "value": "24d", "delta": "3d faster than last month" }
  ],
  "pipelineConversion": {
    "title": "Pipeline conversion",
    "items": [
      { "label": "Applied", "value": "412", "percent": 100, "color": "#D3CEC5" }
    ]
  },
  "hiresBySource": {
    "title": "Hires by source",
    "items": [
      { "label": "Referrals", "value": "4 hires", "color": "#268A5A" }
    ]
  },
  "interviewsTrend": {
    "title": "Interviews per week",
    "caption": "8 week trend",
    "items": [
      { "label": "W1", "value": 12 },
      { "label": "W8", "value": 28, "active": true }
    ]
  }
}
```

## GET /api/jobs/new and POST /api/jobs

```json
{
  "topTitle": "Jobs / New job",
  "title": "New job",
  "stepLabel": "Step 1 of 4",
  "steps": [
    { "number": 1, "label": "Role basics", "active": true }
  ],
  "form": {
    "titleLabel": "Job title",
    "titlePlaceholder": "e.g. Senior Backend Engineer",
    "departmentLabel": "Department",
    "departments": [
      { "label": "Engineering", "value": "engineering", "selected": true }
    ],
    "locationLabel": "Location",
    "locations": [
      { "label": "Remote (US)", "value": "remote-us", "selected": true }
    ],
    "bandMinLabel": "Band min (k)",
    "bandMaxLabel": "Band max (k)",
    "defaults": {
      "title": "",
      "bandMin": "180",
      "bandMax": "220"
    }
  },
  "actions": {
    "cancel": "Cancel",
    "back": "<- Back",
    "continue": "Continue ->",
    "submitting": "Continuing..."
  }
}
```

`POST /api/jobs` receives the edited form object and may return
`{ "id": "eng-204" }` to move the user to `/pipeline/:id`.
