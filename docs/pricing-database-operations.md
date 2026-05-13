# External Price Database Operations

Refs #200

## Scope

This document defines the minimum operational setup for the external price database. It does not add runtime writes, UI search behavior, ETL workers or service-role usage inside the app.

The app must remain usable when the central database is missing, stale or in a failed sync state. Local import and manual price entry remain the safe fallback.

## Minimum Setup

Runtime public read configuration for the app:

```env
NEXT_PUBLIC_PRICE_DB_PROVIDER=supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Admin-only sync configuration for GitHub Actions or equivalent tooling:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Rules:

- `SUPABASE_SERVICE_ROLE_KEY` must not be added to Vercel app env vars.
- `SUPABASE_SERVICE_ROLE_KEY` must not appear in `src/app`, `src/components` or client code.
- Runtime app reads use public read paths only.
- Sync/write tooling runs outside Vercel Hobby.
- Central candidates are never auto-approved.

## Operational Statuses

The product should report these states safely:

- `missing-config`: central database is not configured; use local import or manual price entry.
- `missing-sync`: public read config exists, but no safe sync/source snapshot is available.
- `sync-running`: sync is in progress; existing candidates remain review-required.
- `sync-failed`: latest sync failed; keep local/manual fallback and inspect admin workflow logs.
- `stale-data`: latest active reference is older than the freshness window.
- `ready`: public read config and fresh reference are available.

These statuses are product diagnostics, not approval signals. Even `ready` means only that candidates can be searched; prices still require human review.

## Safe Error Handling

Public diagnostics must not expose:

- service-role keys;
- bearer tokens;
- API keys;
- Supabase URLs that include sensitive paths or query details;
- stack traces;
- raw provider payloads.

User-facing copy should say what action is safe:

- continue manually;
- import a local price base;
- inspect the admin sync workflow;
- rerun dry-run before write mode;
- keep candidates pending until review.

## Stale Data Policy

The default operational freshness window is 210 days from the active reference month, matching the January/July SINAPI cadence with a short operational grace period. Stale data should not block the app, but it must keep candidates review-required and guide the user to local/manual fallback if a fresher base is needed.

## Validation Expectations

Operational hardening PRs should include tests for:

- missing central DB config;
- failed sync with sanitized error message;
- stale active reference;
- ready/fresh active reference;
- no service-role key in app/client code;
- safe fallback text in the `/help` checklist.
