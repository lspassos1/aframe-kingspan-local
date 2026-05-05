# PR 6 Screenshots

Screenshots captured from local `/start` with a real Clerk session and `AI_PLAN_EXTRACT_ENABLED=true`.

The `/api/ai/plan-extract` request was intercepted in Playwright with a valid advanced schema response so the review-ready UI could be validated without calling OpenAI during audit.

- `plan-review-desktop.png`: 1440 px viewport, full-page capture.
- `plan-review-mobile.png`: 390 px viewport, full-page capture.

Browser MCP could navigate the authenticated local route. The review-state capture used Playwright route interception because the Browser runtime cannot generate server-side Clerk tokens or mock API responses outside the page context.
