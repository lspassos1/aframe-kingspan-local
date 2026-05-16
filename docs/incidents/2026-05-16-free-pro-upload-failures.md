# Free and Pro plan upload failures — 2026-05-16

Refs #278
Refs #239
Refs #255
Refs #263
Refs #264
Refs #266

## Current observation

Lucas retested the current plan upload UI after the Free/Pro work landed. The UI now correctly renders two separate upload paths, but both paths still fail after upload.

The UI, mode selection, diagnostic ID display, and manual fallback are working. The provider execution path is still not producing a successful extraction.

## Immediate goal

Do not make another blind provider-routing change. Use the diagnostic IDs from issue #278 and the smoke harness to identify the concrete failure class first.

## Senior debugging sequence

### 1. Retrieve diagnostic records

Use the diagnostic IDs recorded in issue #278.

Expected safe fields:

- mode
- MIME type
- file-size bucket
- cache state
- final status
- safe reason
- provider attempt summary
- quota consumed/released
- duration

If the records are missing, treat that as a diagnostic persistence bug and fix that before provider logic.

### 2. Correlate with Vercel logs

Use the timestamp from the screenshot/test and the diagnostic IDs. The server logs should contain sanitized events only.

Look for provider-chain failures, diagnostic persistence fallback logs, provider attempt summaries, and safe HTTP status categories.

Do not paste secrets, raw provider payloads, file contents, base64, or user tokens into comments.

### 3. Run the smoke harness against the same deployment

Use the manual smoke harness from the recovery runbook and pass the deployment endpoint explicitly.

Minimum matrix:

```bash
AI_LIVE_PROVIDER_SMOKE=true npm run ai:plan-extract:smoke -- --endpoint "$AI_SMOKE_ENDPOINT" --mode free-cloud --fixture png --json
AI_LIVE_PROVIDER_SMOKE=true npm run ai:plan-extract:smoke -- --endpoint "$AI_SMOKE_ENDPOINT" --mode free-cloud --fixture jpg --json
AI_LIVE_PROVIDER_SMOKE=true npm run ai:plan-extract:smoke -- --endpoint "$AI_SMOKE_ENDPOINT" --mode paid --fixture png --json
AI_LIVE_PROVIDER_SMOKE=true npm run ai:plan-extract:smoke -- --endpoint "$AI_SMOKE_ENDPOINT" --mode paid --fixture jpg --json
AI_LIVE_PROVIDER_SMOKE=true npm run ai:plan-extract:smoke -- --endpoint "$AI_SMOKE_ENDPOINT" --mode paid --fixture pdf --json
```

Free PDF may return the documented recovery message; that does not by itself prove a provider bug.

### 4. Classify the failure

Classify the real failure before coding:

- Free provider rate-limited.
- Free provider timeout.
- Paid environment missing.
- Paid provider HTTP failure.
- Schema parse failure.
- Diagnostic record missing.
- Auth or route issue.

### 5. Fix the smallest layer

Do not combine fixes. Create one narrow PR after classification:

- provider request/payload fix;
- env/status/runbook fix;
- schema parser fix;
- Free provider resilience fix;
- diagnostic persistence fix.

## Acceptance criteria for the next implementation PR

- The PR body summarizes the diagnostic IDs in sanitized form.
- At least one small PNG/JPG extraction path succeeds in preview or production, preferably Pro first.
- If Pro fails due to environment configuration, the UI/help status must make that safe status visible without printing values.
- If Free fails due to external limits, the UI must keep manual fallback and report a safe reason.
- The smoke harness report confirms mode, MIME, status, safe reason, and diagnostic ID.

## Required validation

```bash
npm run test -- tests/ai-plan-extract-route.test.ts tests/ai-plan-extract-diagnostics.test.ts tests/ai-provider-smoke-script.test.ts
npm run lint
npm run test
npm run build
```

## Non-goals

- Do not enable OpenAI as automatic fallback for Free.
- Do not store uploaded file content.
- Do not expose provider/model/env details in the normal UI.
- Do not remove the manual path.
- Do not merge broad provider changes without diagnostic evidence.
