# Plan upload recovery plan — 2026-05-15

Refs #239
Refs #255
Refs #263
Refs #264
Refs #265
Refs #266
Refs #267
Refs #268

## Current state

The plan upload problem is no longer the earlier false `limit-exceeded` state. The current recovery work treats the upload as a runtime reliability problem with separate Free, Pro, diagnostics, smoke, image hardening, and database-status tracks.

Relevant merged work before this runbook:

- #259 allowed `openrouter/free` as an accepted free-cloud OpenRouter model id.
- #260 returned daily quota after provider-chain failures that did not produce an extraction.
- #261 added a product-level PDF recovery path for free-cloud failures.
- #262 made the visible upload status reflect runtime extraction failures instead of only static configuration.
- #269 added an explicit Pro upload path so the same plan can be tested in Free and Pro without automatic paid fallback.
- #270 added sanitized extraction diagnostics with short-lived attempt IDs.
- #271 added the manual Free/Pro provider smoke harness.
- #272 hardened free image extraction with preprocessing and bounded retry behavior.
- #273 added the Supabase price DB smoke script and safe central DB read-status handling.

The remaining product question for #239 is whether real production uploads now pass the manual smoke matrix with the configured providers and user files.

## Architecture snapshot

### Upload modes

- Free mode uses the free-cloud provider chain only.
- Pro mode is explicit and user/operator selected.
- Pro mode does not run as an automatic fallback from Free.
- Manual continuation remains available in every failure state.
- Extracted data is never applied without human review.

### Diagnostics

- Upload attempts receive a safe diagnostic ID.
- Diagnostics may record mode, MIME type, file-size bucket, cache status, result state, safe reason, attempted provider IDs, timing, and quota consumption/reversal state.
- Diagnostics must not store files, base64, full filenames, provider payloads, stack traces, tokens, API keys, or credential-bearing URLs.

### Central price database

- Supabase is the central price database target for pricing candidates.
- The app runtime uses public read credentials only.
- Admin write/sync uses service-role credentials only in admin script/workflow context.
- Supabase price DB status is separate from plan extraction reliability.
- A missing or failing central DB must never block local import or manual pricing.

## Risk map

| Risk | Likely signal | Safe response |
| --- | --- | --- |
| Free image provider unavailable | Free PNG/JPG returns runtime error, Pro succeeds | Keep manual CTA, inspect diagnostic ID, compare provider smoke |
| Free PDF unsupported or unstable | Free PDF returns PDF recovery copy | Ask for image export or manual continuation; use Pro only when explicitly selected |
| Pro provider unavailable | Pro upload fails while Free may still work | Surface Pro-specific product error and diagnostic ID, no provider details in normal UI |
| Oversized or hard-to-read image | Diagnostics show preprocessing, timeout, or provider failure | Use preprocessed image path, reduce dimensions, keep one bounded retry |
| Central price DB missing | `/help` shows base central sem configuracao | Continue with local import/manual price |
| Central price DB read/RPC failure | `/help` shows busca central indisponivel | Run `scripts/supabase-price-db-smoke.mjs`, do not expose URL/token/payload |
| Stale central price source | `/help` shows stale semestral status | Run dry-run/write procedure before treating candidates as current |

## Issue and PR sequence

### 1. Explicit Pro path

- Issue: #263
- PR: #269
- Branch: `feat/explicit-pro-plan-upload-path`
- Title: `feat(ai): add explicit Pro plan upload path`

Purpose: allow the same file to be tested through Free and Pro in the same deploy without changing global `AI_MODE` and without creating automatic paid fallback.

Required checks:

```bash
npm run test -- tests/ai-providers.test.ts tests/ai-plan-extract-route.test.ts tests/plan-import-ui.test.ts tests/start-guided-assistant.test.ts
npm run lint
npm run test
npm run build
```

### 2. Diagnostic ledger

- Issue: #264
- PR: #270
- Branch: `feat/plan-extract-diagnostic-ledger`
- Title: `feat(ai): store sanitized plan extraction diagnostics`

Purpose: make failed production uploads traceable by safe diagnostic ID instead of relying on screenshots or raw provider logs.

Required checks:

```bash
npm run test -- tests/ai-plan-extract-route.test.ts tests/ai-rate-limit.test.ts tests/operational-checklist.test.ts tests/ai-plan-extract-diagnostics.test.ts
npm run lint
npm run test
npm run build
```

### 3. Provider smoke harness

- Issue: #266
- PR: #271
- Branch: `test/ai-plan-extract-provider-smoke`
- Title: `test(ai): add plan extraction provider smoke harness`

Purpose: run live provider checks manually and safely for Free PNG/JPG, Free PDF, Pro PNG/JPG, and Pro PDF.

Required checks:

```bash
npm run test -- tests/ai-provider-smoke-script.test.ts
npm run lint
npm run test
npm run build
```

### 4. Free image hardening

- Issue: #265
- PR: #272
- Branch: `fix/free-image-plan-extract-resilience`
- Title: `fix(ai): harden free image plan extraction`

Purpose: improve Free image success rate with safe preprocessing and bounded provider retry, without calling OpenAI in Free mode.

Required checks:

```bash
npm run test -- tests/ai-image-preprocess.test.ts tests/ai-providers.test.ts tests/ai-plan-extract-route.test.ts tests/ai-plan-extract-diagnostics.test.ts
npm run lint
npm run test
npm run build
```

### 5. Supabase price DB smoke

- Issue: #267
- PR: #273
- Branch: `ops/supabase-price-db-smoke`
- Title: `ops(db): add Supabase price database smoke checks`

Purpose: validate the public-read Supabase pricing surface and safe `/help` status without using service-role credentials in app runtime.

Required checks:

```bash
npm run test -- tests/supabase-price-db-smoke.test.ts tests/remote-price-resolver.test.ts tests/price-db-operations.test.ts tests/operational-environment.test.ts tests/operational-checklist.test.ts tests/help-operational-checklist-ui.test.ts
npm run lint
npm run test
npm run build
```

### 6. Recovery runbook

- Issue: #268
- PR: #274
- Branch: `docs/plan-upload-recovery-2026-05-15`
- Title: `docs(ai): define plan upload recovery sequence`

Purpose: keep the recovery plan current after the implementation PRs and make the remaining production smoke criteria explicit.

Required checks:

```bash
git diff --check
npm run lint
npm run test
npm run build
```

## Manual smoke matrix

Run this only after the preview or production deployment includes the relevant PRs.

### Browser smoke

1. Open `/start?mode=ai`.
2. Confirm manual continuation is visible before any upload.
3. Upload a small PNG floor plan in Free mode.
4. Upload the same PNG floor plan in Pro mode when Pro is configured.
5. Upload a small JPG floor plan in Free mode.
6. Upload the same JPG floor plan in Pro mode when Pro is configured.
7. Upload a PDF floor plan in Free mode and confirm either extraction or the PDF recovery path.
8. Upload the same PDF in Pro mode when Pro is configured.
9. Confirm every failure state shows `Continuar manualmente`.
10. Confirm normal UI does not expose provider names, model names, env names, stack traces, raw URLs, tokens, or payloads.

### Provider smoke

Use the manual harness only with live smoke explicitly enabled and pointed at the deployment being validated. Do not rely on the default localhost endpoint for preview or production sign-off.

Set the target endpoint first:

```bash
export AI_SMOKE_ENDPOINT="https://PREVIEW_OR_PRODUCTION_DOMAIN/api/ai/plan-extract"
[[ -z "$AI_SMOKE_ENDPOINT" ]] && echo "ERROR: AI_SMOKE_ENDPOINT must be set" && exit 1
```

If the deployment requires authentication, set one auth input locally before running the commands below. Do not paste, commit, or log these values:

```bash
export AI_SMOKE_AUTH_COOKIE="..." # full Cookie header value
# or
export AI_SMOKE_AUTH_BEARER="..." # raw token only; the harness sends Authorization: Bearer <token>
# or
export AI_SMOKE_AUTH_HEADER="Bearer ..." # full Authorization header value
```

Run every fixture/mode pair that is part of the acceptance criteria:

```bash
AI_LIVE_PROVIDER_SMOKE=true npm run ai:plan-extract:smoke -- --endpoint "$AI_SMOKE_ENDPOINT" --mode free-cloud --fixture png --json
AI_LIVE_PROVIDER_SMOKE=true npm run ai:plan-extract:smoke -- --endpoint "$AI_SMOKE_ENDPOINT" --mode free-cloud --fixture jpg --json
AI_LIVE_PROVIDER_SMOKE=true npm run ai:plan-extract:smoke -- --endpoint "$AI_SMOKE_ENDPOINT" --mode free-cloud --fixture pdf --json
AI_LIVE_PROVIDER_SMOKE=true npm run ai:plan-extract:smoke -- --endpoint "$AI_SMOKE_ENDPOINT" --mode paid --fixture png --json
AI_LIVE_PROVIDER_SMOKE=true npm run ai:plan-extract:smoke -- --endpoint "$AI_SMOKE_ENDPOINT" --mode paid --fixture jpg --json
AI_LIVE_PROVIDER_SMOKE=true npm run ai:plan-extract:smoke -- --endpoint "$AI_SMOKE_ENDPOINT" --mode paid --fixture pdf --json
```

Free PDF may return the documented PDF recovery path instead of a successful extraction; that is acceptable only when the report shows the safe Free PDF recovery reason and the browser flow still offers manual continuation. Auth failures are not provider smoke results; fix the auth input or explicitly enable anonymous plan extraction in the target environment before evaluating provider behavior.

Do not paste or commit the resulting report if it contains deployment-specific metadata. Use it to compare mode, MIME type, status, safe reason, diagnostic ID, and provider attempt summary.

### Supabase smoke

Run with public read env only:

```bash
node scripts/supabase-price-db-smoke.mjs --json
```

Expected safe outcomes:

- `ok: true` when the RPC, active view, and active-source visibility checks pass.
- `missing-config` when public read env is absent.
- `rpc: failed` or `currentView: failed` with sanitized detail when Supabase read fails.

The smoke must not require or send `SUPABASE_SERVICE_ROLE_KEY`.

## Production acceptance criteria

- Free PNG/JPG either extracts to review-ready data or returns a product-level recoverable failure with a diagnostic ID.
- Pro PNG/JPG/PDF works when Pro env is configured.
- Free PDF has a clear recovery path if free-cloud providers cannot process the document.
- Provider-chain failures do not consume daily quota permanently.
- The visible status panel reflects the last runtime failure enough to avoid a false healthy state.
- `/help` shows central DB readiness safely and keeps local/manual fallback available.
- No normal UI exposes provider/model/env/router details.
- No logs or diagnostics expose file contents, base64, API keys, bearer tokens, service-role keys, credential-bearing URLs, or stack traces.

## Rollback

Use the smallest rollback that matches the failure:

- If Pro path causes user confusion, hide the Pro upload option while keeping Free/manual.
- If diagnostics storage misbehaves, keep diagnostic IDs and fall back to sanitized console logging.
- If live provider smoke exposes noisy failures, disable only the manual workflow/script invocation path.
- If image preprocessing regresses extraction, bypass preprocessing for the affected MIME/size bucket.
- If Supabase smoke reports read failure, keep the app on local import/manual pricing and do not promote central candidates as reliable.

Do not roll back the human-review requirement, manual continuation, or secret-redaction safeguards.

## What not to do

- Do not add automatic OpenAI fallback to Free mode.
- Do not add payment or Stripe gating as part of upload recovery.
- Do not store uploaded files or base64 in diagnostics.
- Do not use service-role credentials in app/client/Vercel public runtime.
- Do not close #239 until Lucas validates the production upload path manually.
- Do not use auto-closing GitHub keywords in PR bodies for this recovery sequence.
