# External Price Database Schema And RLS

Refs #200

## Scope

This document describes the schema/RLS migration introduced for the external price database. It is schema-only: no Supabase client, runtime adapter, Vercel env var, sync job or Budget Assistant UI is added here.

Migration:

```txt
supabase/migrations/20260512215000_price_database_schema.sql
```

## Tables

- `price_sources`: monthly source/version metadata, including UF, reference month, regime and active/staging/archive status.
- `price_items`: composition and input rows with unit, category, construction method, cost breakdown, H/H, review status and search text.
- `composition_inputs`: material/labor/equipment/third-party/other rows inside a composition.
- `waste_rules`: loss assumptions tied to a source or generic category/method.
- `price_sync_runs`: audit records for future monthly sync runs.

## Public Read Layer

The public read surface is intentionally narrow:

- `current_price_items` view exposes active reference candidates only.
- `search_price_candidates(...)` returns filtered candidates from `current_price_items`.

Both are read-only surfaces for candidate discovery. A candidate from this database is not a final price until the project flow copies it into the project store and a user reviews/approves it.

## RLS Rules

All tables have RLS enabled.

Public read behavior:

- `price_sources`: `anon` and `authenticated` can read active sources only.
- `price_items`: `anon` and `authenticated` can read items only when their source is active.
- `composition_inputs`: `anon` and `authenticated` can read inputs only for composition items from active sources.
- `waste_rules`: `anon` and `authenticated` can read rules without a source or tied to active sources.
- `price_sync_runs`: no public read/write grant or policy.

Because the public view/RPC use `security_invoker`, the read roles need underlying SELECT grants. RLS remains the enforcement layer, so direct table reads by `anon`/`authenticated` are still limited to active safe reference rows. Runtime consumers should use `current_price_items` or `search_price_candidates(...)` rather than table details.

Write behavior:

- `anon` and `authenticated` have no insert/update/delete grants.
- Service-role/admin sync tooling can write in future GitHub Actions jobs.
- The service role key must not be placed in Vercel or client code.

## Security Invoker Contract

The public view uses:

```sql
with (security_invoker = true)
```

The public RPC uses:

```sql
security invoker
```

No public read path uses `SECURITY DEFINER`. If a future admin-only `SECURITY DEFINER` function becomes necessary, it must be justified in that future PR and must not be exposed to `anon` or public read roles.

## SQL Validation Notes

The migration and static test assert:

- each core table enables RLS;
- public grants are SELECT-only on safe read tables;
- `anon`/`authenticated` do not receive insert/update/delete grants;
- the public view is `security_invoker`;
- the public RPC is `security invoker`;
- `SECURITY DEFINER` is absent;
- `price_sync_runs` stays unavailable to public read roles;
- no Supabase service role key or Vercel env wiring is introduced.

These checks are static guards for this schema PR. A later integration PR should add live database validation when a real Supabase project exists.
