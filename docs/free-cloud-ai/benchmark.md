# Free-cloud AI benchmark

This document tracks the controlled benchmark for the free-cloud plan analysis path.

The benchmark is intentionally conservative:

- fixtures are synthetic and sanitized;
- dry-run mode performs no network calls;
- real mode is manual only and posts synthetic fixture files to the app endpoint;
- OpenAI remains in standby and is not used by the benchmark;
- estimated cost is recorded as `0` for the free-cloud path;
- divergent values and missing information stay pending for human review.

## How to run

Dry run:

```bash
npm run ai:free-cloud:benchmark -- --dry-run
```

Write a Markdown report:

```bash
npm run ai:free-cloud:benchmark -- --dry-run --output docs/free-cloud-ai/benchmark-report.md --format markdown
```

Use a generated report path such as `benchmark-report.md`; do not write output over this guide.

Optional real run against a local or preview app endpoint:

```bash
npm run ai:free-cloud:benchmark -- --real --endpoint http://localhost:3000/api/ai/plan-extract
```

If the endpoint is protected, pass temporary local authentication as CLI input for the manual run:

```bash
npm run ai:free-cloud:benchmark -- --real \
  --endpoint http://localhost:3000/api/ai/plan-extract \
  --auth-cookie "__session=<local-session-cookie>" \
  --timeout-ms 30000
```

Real mode is not part of CI. It requires the app endpoint to be running with the existing free-cloud server env vars configured. It does not require extra Vercel env vars, and it does not read or print provider API keys.

## Current dry-run baseline

The fixture set lives at `docs/free-cloud-ai/fixtures/synthetic-plan-benchmark.json`.

Expected dry-run behavior:

- Gemini primary succeeds on the synthetic PNG and synthetic PDF fixtures.
- OpenRouter review completes on image input.
- OpenRouter review is skipped on PDF input because this stack does not promise generic OpenRouter PDF support.
- Groq text summary is represented as a text-only dry-run task.
- The rectangular fixture intentionally has one area divergence so the report proves disagreements stay visible.

Run recorded in this PR:

```txt
npm run ai:free-cloud:benchmark -- --dry-run
```

The dry-run output reports:

- `mode: dry-run`;
- `estimatedCostUsd: 0`;
- providers `gemini`, `groq`, `openrouter`;
- at least one divergence;
- at least one skipped review for PDF;
- pending items for missing or divergent information.

## Interpretation

This benchmark is not a quality claim for production plans. It is a repeatable harness to validate routing, schema health, comparison states, cache labels and pending-review behavior without committing client plans or calling paid providers.

Before depending on free-cloud mode for daily use, run a manual real benchmark with local keys and inspect:

- schema validity;
- field coverage;
- latency;
- provider failures;
- free-tier limit behavior;
- divergence rate;
- manual fallback clarity.
