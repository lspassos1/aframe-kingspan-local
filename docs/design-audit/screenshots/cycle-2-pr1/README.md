# Cycle 2 PR 1 screenshots

Route: `/admin/feedback`

Capture date: 2026-05-07

Viewports:

- `admin-feedback-desktop.png`: 1440 x 1100
- `admin-feedback-mobile.png`: 390 x 900

State captured:

- Local development without `GITHUB_FEEDBACK_TOKEN`.
- The API returns a safe `missing_token` diagnostic instead of the previous generic 502.
- The page remains visible without bypassing admin/API authorization.
