# PR 10 screenshots

Captured against `http://localhost:3000` after the internal screen redesign pass.

Routes:
- `/dashboard`
- `/edit`
- `/budget`
- `/budget-assistant`
- `/model-3d`
- `/materials`
- `/export`
- `/help`

Viewports:
- desktop: 1440 x 1000
- mobile: 390 x 844

Validation used local browser automation with Playwright screenshots for repeatable desktop/mobile captures. Internal routes were reached through app navigation after starting from the example flow, matching the known direct-reload behavior documented in PR 1. No screenshot route missed its target URL and no console errors were reported during capture.
