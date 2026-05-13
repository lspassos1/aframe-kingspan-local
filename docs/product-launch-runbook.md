# Product Launch And Validation Runbook

Refs #208

## Scope

This runbook defines the validation sequence for shipping the current product safely after the AI, UX and external price database work lands.

It is operational documentation only. It does not enable production mode, change environment variables, run paid AI calls, run live Supabase writes or promote Vercel deployments.

## Ground Rules

- Do not use automatic issue-closing keywords in PR bodies.
- Do not call a preliminary estimate final.
- Do not run live OpenAI, Gemini, OpenRouter, Groq, Cerebras, SambaNova or Supabase writes unless the step explicitly says it is a planned manual production check.
- Do not run heavy SINAPI sync or bulk import inside Vercel Hobby.
- Do not add service-role database keys to Vercel app env vars.
- Keep manual price entry and local price import available even when AI or the central database is unavailable.

## Before Merge

Run from the PR branch:

```bash
git fetch origin
git status --short --branch
npm ci
npm run lint
npm run test
npm run build
```

Review gates:

- PR scope matches the issue.
- PR body uses `Refs #...` only.
- No `Closes`, `Fixes` or `Resolves`.
- Vercel preview is green.
- Snyk/checks are green or documented.
- CodeRabbit/Codex/GitHub review threads are resolved or answered.
- Product screenshots are attached or referenced for UI PRs.
- No secret values appear in logs, docs, screenshots or PR comments.

Route checkpoints for UI/product PRs:

```txt
/
/start
/dashboard
/budget-assistant
/budget
/export
/help
/model-3d
```

For each changed route, capture or verify:

- desktop viewport;
- mobile viewport;
- no provider/model/router noise in normal UI;
- no stack traces;
- no raw env names outside advanced diagnostics;
- clear fallback action when data/config is missing.

## After Merge To Main

Run from `main`:

```bash
git checkout main
git pull --ff-only
npm ci
npm run lint
npm run test
npm run build
git status --short
```

Confirm:

- merged commit is present on `main`;
- issue remains open until manual closure is intentional;
- Vercel production was not promoted accidentally;
- hourly/12h Slack triage still reports without noisy GitHub comments;
- open PR queue did not become stale because of the merge.

## Before Production Promotion

Use the Vercel preview URL first. Do not promote production before these checks pass.

Preview smoke routes:

```txt
/
/start
/budget-assistant
/budget
/export
/help
/model-3d
```

Preview checks:

- `/` communicates the product flow without provider names.
- `/start` lets the user continue manually.
- `/budget-assistant` supports local import and manual price entry.
- `/budget` shows preliminary status, source and pending review.
- `/export` shows blockers before export.
- `/help` shows operational readiness and advanced diagnostics without secrets.
- `/model-3d` loads without blank canvas or broken fallback.

If any preview route redirects unexpectedly, capture:

```txt
route:
expected:
actual:
browser:
viewport:
console/network symptom:
```

## After Production Deploy

Check production with read-only and manual-safe flows first:

1. Open `/`.
2. Open `/start`.
3. Continue manually.
4. Open `/budget-assistant`.
5. Confirm local/manual price fallback is visible.
6. Open `/help`.
7. Confirm readiness statuses are safe and no secrets appear.
8. Open `/export`.
9. Confirm export remains preliminary and keeps warnings visible.

Do not run live paid AI or sync writes as part of the default production smoke test.

## Free Mode Check

Expected configuration:

```env
AI_MODE=free-cloud
AI_PAID_FALLBACK_ENABLED=false
AI_PLAN_EXTRACT_ENABLED=true
AI_PLAN_EXTRACT_MAX_FILE_MB=8
AI_PLAN_PRIMARY_PROVIDER=gemini
AI_PLAN_REVIEW_PROVIDER=openrouter
AI_TEXT_PROVIDER=groq
AI_TEXT_FALLBACK_PROVIDER=cerebras
GEMINI_API_KEY=
GEMINI_MODEL=
GEMINI_FREE_TIER_NOTICE=
OPENROUTER_API_KEY=
OPENROUTER_PLAN_REVIEW_MODEL=
GROQ_API_KEY=
GROQ_TEXT_MODEL=
CEREBRAS_API_KEY=
CEREBRAS_TEXT_MODEL=
SAMBANOVA_API_KEY=
SAMBANOVA_TEXT_MODEL=
```

Validation:

- `/start` shows product language such as `Modo gratuito`, not provider routing.
- Upload assistido can be presented when enabled.
- OpenAI is not called in free mode.
- Paid fallback is not automatic.
- If free providers are unavailable, the UI offers `Continuar manualmente`.

Do not expose provider/model names outside advanced diagnostics.

## Pro Mode Check

Expected configuration:

```env
AI_MODE=paid
OPENAI_API_KEY=
AI_OPENAI_MODEL=gpt-4o-mini
AI_OPENAI_MODEL_PREMIUM=gpt-5.4-mini
```

Validation:

- `/help` reports `Modo Pro` safely.
- Pro mode is explicit.
- `AI_OPENAI_MODEL_PREMIUM` remains reserved and is not selected automatically.
- No live paid request is required unless Lucas explicitly approves a paid smoke test.
- Manual fallback remains available.

## No-AI Check

Use a preview or local env where assisted extraction is disabled or unavailable:

```env
AI_PLAN_EXTRACT_ENABLED=false
```

Expected behavior:

- `/start` still offers manual path.
- `/help` reports upload assistido as `desligado`.
- Budget Assistant, local import and export remain usable.
- No UI dead end.

## No Remote DB Check

Unset public central DB read configuration:

```env
NEXT_PUBLIC_PRICE_DB_PROVIDER=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Expected behavior:

- `/help` reports base central as not configured.
- `/budget-assistant` keeps local import and manual price entry.
- No central DB search is implied as active.
- No error page appears.
- No Supabase service-role key is required.

## Central DB Configured Check

Expected public read-only configuration:

```env
NEXT_PUBLIC_PRICE_DB_PROVIDER=supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Expected behavior:

- `/help` reports base central configured.
- Central candidates remain review-required.
- Missing sync, failed sync or stale data states guide the user to local/manual fallback.
- No write capability appears in the app.
- No service-role key appears in the browser, Vercel public envs or client bundle.

## Local Price Import Check

Route:

```txt
/budget-assistant#price-base-import
```

Check:

- CSV/XLSX/JSON/ZIP import path is visible.
- Required columns fail with clear errors.
- Source title, UF, reference date, unit and confidence remain visible.
- Imported candidates do not become approved automatically.
- Manual price entry remains available after import.

## Export Check

Route:

```txt
/export
```

Check:

- Export shows readiness before action.
- Pending price, missing source and review warnings remain visible.
- JSON export includes project state.
- Spreadsheet/PDF export does not call AI or remote DB.
- Export text stays preliminary.

## Semiannual SINAPI Sync Procedure

Dry-run is always the first step:

```bash
node scripts/sinapi-sync-monthly.mjs --dry-run --json --input ./path/to/normalized-sinapi-source.json
```

Dry-run must report:

- row count;
- required columns;
- status counts;
- source metadata;
- invalid rows;
- review rows.

Manual write mode is admin-only and must run outside Vercel Hobby. Prefer GitHub Actions `workflow_dispatch`
with repository/admin secrets configured. For a local admin shell, avoid putting secrets in shell history:

```bash
read -r SUPABASE_URL
read -rs SUPABASE_SERVICE_ROLE_KEY
export SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY
node scripts/sinapi-sync-monthly.mjs --write --json --input ./path/to/normalized-sinapi-source.json
unset SUPABASE_SERVICE_ROLE_KEY
```

Write-mode expectations:

- `--write` flag is explicit.
- `--input` points to the same reviewed normalized source file used in dry-run.
- missing secrets fail safely.
- source starts as staging.
- row counts and status counts are validated.
- source is promoted only after validation.
- previous active source is archived safely.
- sync run is recorded.
- failures are logged without exposing secrets.

GitHub Actions:

- dry-run may run on the semiannual schedule.
- write mode must be manual or explicitly gated.
- write mode must not run on `pull_request`.
- write mode must use repository/admin secrets only.

## Rollback

Application rollback:

1. Identify the last known good deployment in Vercel.
2. Promote or redeploy that deployment.
3. Keep issues/PRs open until validation confirms recovery.
4. Run `/help`, `/budget-assistant`, `/export` and `/model-3d` smoke checks.
5. Add a GitHub comment with the deployment id, reason and validation results.

Central price DB rollback:

1. Do not delete price data from the app runtime.
2. Mark the problematic source as failed or archived through admin tooling.
3. Restore the previous active source if needed.
4. Record a sync run failure reason.
5. Keep Budget Assistant on local/manual fallback until the active source is safe.

AI rollback:

1. Set `AI_PLAN_EXTRACT_ENABLED=false` if extraction is unstable.
2. Keep manual path available.
3. Do not enable paid fallback automatically.
4. Re-enable only after preview validation.

## What Not To Put In Vercel

Do not put these in Vercel app env vars:

```txt
SUPABASE_SERVICE_ROLE_KEY
database superuser passwords
raw GitHub tokens for admin tooling
Slack signing secrets as NEXT_PUBLIC_*
GITHUB_REVIEW_TOKEN as NEXT_PUBLIC_*
any secret with NEXT_PUBLIC_ prefix
```

Allowed Vercel app env vars are only runtime-safe values and server-side secrets required by the app itself. Database write/admin sync secrets belong in GitHub Actions/admin tooling, not the browser or Vercel public envs.

## Manual Closure Of #208

After the runbook PR is merged and `main` passes validation, #208 can be closed manually with a traceability comment that references the merged PR and validation results.
