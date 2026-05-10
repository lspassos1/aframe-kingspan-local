# External Price Database Architecture

Refs #200

## Purpose

This document defines the first architecture decision for a central price database that can support compositions, inputs, H/H, losses and monthly SINAPI references without overloading the Vercel Hobby app runtime.

The current app already has a strong local/imported price model:

- `src/lib/sinapi/price-database.ts` imports and normalizes SINAPI-like price bases.
- `src/lib/budget-assistant/types.ts` models price sources, service compositions, H/H, labor roles, waste rules, budget quantities and budget service lines.
- `src/components/budget-assistant/PriceBaseImportCard.tsx` lets users import CSV, XLSX, JSON and ZIP price bases.
- `project.budgetAssistant.priceSources` and `project.budgetAssistant.serviceCompositions` persist imported price data in the project store.

The missing piece is a shared external database that the app can query before asking the user for manual price entry or future AI/market fallback.

## Decision

Use **Supabase Free** as the first target for the central reference price database.

Use **Neon Free** as the main fallback if Supabase limits, RLS/API ergonomics or operational constraints become a problem.

Do not use Railway or Docker as the first implementation path. They may be useful later for a separate worker/API, but they add more operational burden than is necessary for the first low-volume version.

## Why Supabase First

Supabase is the best first fit because:

- it is managed Postgres, which fits relational construction price data;
- the SQL dashboard is useful for debugging imported rows and monthly versions;
- Row Level Security can expose active reference data as read-only;
- the client can read safe public price candidates without using Vercel Functions for every query;
- monthly writes can run from GitHub Actions using a service role secret;
- Vercel stays focused on the app UI and light runtime queries.

Free-plan quotas can change. Product copy and docs must not promise that Supabase Free is production-grade for commercial scale. This decision is for low-volume/personal usage and should be reviewed before commercial launch.

## Vercel Hobby Boundary

Vercel must not run:

- monthly SINAPI import jobs;
- heavy file parsing;
- bulk database upserts;
- large ETL jobs;
- scheduled price syncs.

Vercel may run:

- UI rendering;
- small candidate queries;
- optional lightweight API wrappers if direct Supabase read access is not suitable.

The preferred first implementation is:

```txt
GitHub Actions monthly sync -> Supabase central database -> app reads active candidates
```

## Data Ownership Model

The central price database stores reference data:

- SINAPI source metadata;
- compositions;
- inputs/insumos;
- material/labor/equipment breakdown;
- H/H;
- waste/loss rules;
- monthly version and status;
- import audit records.

The project store remains responsible for project-specific decisions:

- user-approved matches;
- manual prices;
- imported local bases;
- selected candidates;
- budget/export state.

A central DB price is only a candidate. It is never final until the user approves it inside the project flow.

## Runtime Price Resolution Priority

The app should resolve prices in this order:

```txt
1. Project-local approved/manual prices
2. Project-local imported SINAPI/service compositions
3. Central remote price DB candidates
4. Manual entry
5. Future external API connector
6. Future AI/market suggestion, never auto-approved
```

This keeps the existing local/manual flow intact and makes the central database an enhancement, not a hard dependency.

## Target Monthly Sync Flow

```txt
Monthly GitHub Actions workflow
  -> read official or normalized SINAPI input
  -> normalize rows using current SINAPI importer concepts
  -> insert new source/version as staging
  -> bulk insert or upsert price rows
  -> validate imported row count and status counts
  -> promote staging source to active
  -> archive previous active source for same state/reference/regime/source type
  -> write sync audit record
```

The first sync implementation should support dry-run mode before any write mode is enabled.

## Public Read Layer

The central database should expose only safe active data through a view or RPC, for example:

- `current_price_items`; and/or
- `search_price_candidates(...)`.

The public read layer must not expose:

- service role behavior;
- API keys;
- private project data;
- user-specific manual overrides;
- insert/update/delete capability.

## Security Rules

- Enable RLS on all tables.
- Public/anon read access is allowed only on active reference price data through safe views/RPC.
- Public/anon insert, update and delete must be blocked.
- `SUPABASE_SERVICE_ROLE_KEY` must be used only by GitHub Actions/admin sync tooling.
- `SUPABASE_SERVICE_ROLE_KEY` must never be added to Vercel.
- Future user/project overrides must live in separate auth-protected tables.

## Configuration Boundary

This architecture introduces database-specific configuration only. It must not modify AI configuration.

Vercel public read-only configuration:

```env
NEXT_PUBLIC_PRICE_DB_PROVIDER=supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

GitHub Actions secrets only:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

No DB write key belongs in the browser or in Vercel public envs.

## Future Schema Direction

The schema should be introduced in a later PR, not in this documentation-only PR. The expected core tables are:

- `price_sources`;
- `price_items`;
- `composition_inputs`;
- `waste_rules`;
- `price_sync_runs`.

The schema should preserve these fields from the current local model:

- source title/supplier;
- UF/city;
- reference month;
- regime;
- source code;
- description;
- unit;
- material/labor/equipment/third-party/other costs;
- direct unit cost;
- total labor hours per unit;
- price status;
- confidence;
- review requirement;
- pending reason;
- tags/search text.

## App Integration Direction

Do not spread Supabase calls through the UI. Add a pricing abstraction first:

```txt
src/lib/pricing/price-candidate-types.ts
src/lib/pricing/remote-price-db.ts
src/lib/pricing/price-resolver.ts
src/lib/pricing/supabase-price-adapter.ts
```

The Budget Assistant should call a resolver and receive normalized candidates. It should not need to know database table details.

## Budget Assistant UX Direction

When central price DB support is added later, the Budget Assistant should:

- show `Base central disponível` only when remote DB config is present;
- add `Buscar na base central` for pending price lines;
- show source, UF, reference month, regime, unit, price, H/H and review status;
- allow the user to create a project-level match from a candidate;
- keep the candidate pending until approval;
- keep manual price entry and local import available at all times.

## Rejected For First Version

### Railway

Railway may be useful later for a long-running worker or hosted API, but it is not the best first choice for a free, low-maintenance central price database.

### Docker In Production

Docker is useful for local testing or a future external ETL service. It must not run inside the Vercel app runtime.

### Static JSON As Main Database

Static JSON is cheap but weak for search, versioning, monthly updates, metadata, H/H and future user overrides.

### Automatic AI Pricing

AI-based price suggestions are out of scope for this epic. If added later, they must be a manual/pro fallback and never auto-approved.

## PR Sequence

This architecture should be delivered through small PRs:

1. Architecture documentation.
2. Schema and RLS.
3. Remote price adapter and resolver contract.
4. Monthly sync dry-run.
5. Monthly sync write mode.
6. Budget Assistant central DB search.
7. Operational hardening.

Each PR should reference #200 and avoid automatic issue closure until manually validated.
