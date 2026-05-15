# Plan upload runtime failure triage — 2026-05-14

Refs #239
Refs #255
Refs #256
Refs #257

## User-visible failure

Lucas uploaded a floor plan in production on 2026-05-14 after #254 had been merged.

Observed UI state:

- Route/flow: `/start?mode=ai`, `Enviar planta baixa`.
- Main upload card: `Análise indisponível`.
- Visible server message: `Nao foi possivel extrair a planta com o modo gratuito neste momento.`
- Side status still shows general availability such as `Upload habilitado` and `Cache por hash ativo quando houver resultado`.

This is no longer the old false daily-limit state. The upload reaches the extraction path and fails as a runtime provider-chain failure.

## Current repo state

Latest relevant merged work:

- #236 and #238 cleaned the daily-limit/manual fallback UX.
- #240 separated real quota exhaustion from rate-limit setup failures.
- #249 added Vercel KV/Upstash env-name compatibility for persistent rate-limit storage.
- #254 added OpenRouter Free as an image-only fallback when Gemini fails in free-cloud mode and added sanitized provider-chain logging.

Issue #239 remains open because production upload is still not reliable after #254.

## Findings

### 1. The current failure maps to `error`, not daily limit

`getPlanImportStateFromResponse` maps non-OK responses as follows:

- `429` + `*-daily-limit-exceeded` -> `limit-exceeded`.
- `503` -> `temporarily-unavailable`.
- everything else -> `error`.

The screenshot matches the `error` copy and the route message from `AiProviderChainError`.

### 2. #254 improved image fallback, but not PDF fallback

In free-cloud mode, provider order is primary plan provider plus the review provider as a fallback if it is different.

OpenRouter is currently configured as image-only for plan extraction:

- supports `image/png`;
- supports `image/jpeg`;
- supports `image/webp`;
- does not support `application/pdf`.

Therefore, PDF uploads still depend on Gemini. If Gemini fails for a PDF, no second free visual provider is attempted.

### 3. The side status panel is configuration/status, not last-attempt health

The right-hand status panel reports static product facts from `StartGuidedAssistant` and `getSafePlanImportProviderUiStatus`. It does not know that the last upload attempt failed at runtime.

This makes the screen look internally inconsistent: the main card says extraction failed, while the status panel still looks generally healthy.

### 4. We need production-safe diagnostics before guessing

The route now logs sanitized provider-chain failures, but the next PR should make the runtime failure easier to classify without exposing secrets or provider details in normal UX.

Minimum safe facts to capture:

- mode;
- MIME type;
- file-size bucket;
- cache hit/miss;
- provider ids tried;
- sanitized failure messages/codes.

Do not log file contents, base64, user files, API keys, token values, full endpoint URLs or stack traces in normal logs.

## Codex execution order

### PR A — runtime provider-chain diagnostics

Issue: #255

Suggested branch:

```txt
fix/plan-upload-runtime-provider-failure
```

Suggested title:

```txt
fix(ai): diagnose plan upload provider-chain failures
```

Goal:

Make the current failure reproducible with mocks and diagnosable in production logs, without changing the Free/Pro contract.

Required validation:

```bash
npm run test -- tests/ai-plan-extract-route.test.ts tests/ai-providers.test.ts tests/plan-import-ui.test.ts
npm run lint
npm run test
npm run build
```

### PR B — PDF recovery path

Issue: #256

Suggested branch:

```txt
fix/free-plan-pdf-recovery
```

Suggested title:

```txt
fix(ai): add PDF recovery path for free plan uploads
```

Goal:

If the uploaded file is PDF and free-cloud PDF extraction fails, either add a safe server-side PDF-to-image fallback or return a specific product-level recovery path asking the user to upload/export an image or continue manually.

Do not enable OpenAI fallback in free-cloud mode.

Required validation:

```bash
npm run test -- tests/ai-providers.test.ts tests/ai-plan-extract-route.test.ts tests/plan-import-ui.test.ts
npm run lint
npm run test
npm run build
```

### PR C — runtime-aware product status

Issue: #257

Suggested branch:

```txt
fix/plan-upload-runtime-status-ux
```

Suggested title:

```txt
fix(ai): reflect failed plan extraction in product status
```

Goal:

After a runtime extraction failure, make the visible product status reflect `Análise não concluída` / manual recovery instead of looking fully healthy.

Do not expose provider/model/env names in normal UX.

Required validation:

```bash
npm run test -- tests/plan-import-ui.test.ts tests/start-guided-assistant.test.ts
npm run lint
npm run test
npm run build
```

## Hard rules

- Use only `Refs #...` in PR bodies.
- Do not use `Closes`, `Fixes` or `Resolves` until Lucas validates manually.
- Do not create, rename or remove env vars.
- Do not call OpenAI automatically from free-cloud mode.
- Do not expose provider/model/env/router details in normal user UX.
- Keep `Continuar manualmente` available in every failure state.
- Keep human review required before applying extracted data.

## Recommended manual production check after each PR

1. Deploy preview.
2. Upload a small PNG floor plan.
3. Upload a PDF floor plan.
4. Confirm status, message and CTA for each file type.
5. Check server logs for sanitized event names only.
6. Confirm no secret, URL with credentials, base64 or file contents appear in logs.
7. Capture desktop/mobile screenshots for the failed and successful paths.
