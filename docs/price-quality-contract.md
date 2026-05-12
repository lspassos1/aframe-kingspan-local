# Price Quality Contract

## Context

This contract defines when a price candidate can be treated as usable by the budget pipeline. It is shared policy for local imports, manual price overrides, future central database reads and future external connectors.

The contract is intentionally stricter than "row imported successfully". Imported rows can be searchable while still remaining pending or invalid for budget approval.

## Required Metadata

Every usable price must have:

- source id;
- source code or source title;
- UF or source region;
- reference month/date-base;
- known regime when the source is SINAPI or regime-based;
- supported unit;
- direct unit cost;
- review status.

Missing metadata keeps the row pending. It must not be silently promoted to reviewed.

## Blocking Rules

A price is not usable when any of these conditions is true:

- direct unit price is missing;
- direct unit price is zero;
- direct unit price is negative;
- unit is unsupported;
- unit is incompatible with the quantity item;
- UF is outside the project region and no explicit fallback was accepted;
- reference month/date-base is missing;
- regime is `unknown`;
- direct unit cost is lower than material + labor + equipment + third-party + other components;
- H/H per unit is negative or not finite;
- H/H per unit is unrealistic and has not been reviewed;
- waste/loss percent is negative or not finite;
- waste/loss percent is unrealistic and has not been justified;
- source metadata is missing;
- the row or candidate is marked `requiresReview`;
- the candidate has not been approved by the user.

## Thresholds

Current operational thresholds live in `src/lib/budget-assistant/price-quality.ts`:

- maximum H/H per unit before review: `80`;
- maximum waste/loss percent before review: `50`.

These thresholds are review triggers, not engineering guarantees. They can be tightened later with project data.

## Status Semantics

`usable`

- No contract issue.
- Can be offered as a usable reviewed price candidate.

`pending`

- The row is structurally readable but cannot be treated as reviewed.
- The UI must guide the user to review source, unit, region, reference, regime or price.

`invalid`

- The row has an impossible condition, such as invalid unit, negative value or direct cost below component sum.
- It must not be approved without correcting the underlying data.

## SINAPI Alignment

The current SINAPI importer already classifies:

- zero price as `zeroed`;
- missing price as `missing`;
- unsupported unit as `invalid_unit`;
- out-of-region UF as `out_of_region`;
- missing reference as `requires_review`;
- unknown regime as `requires_review`;
- direct cost below component sum as `invalid`.

`evaluateServiceCompositionPriceQuality` adds a reusable contract layer over those imported service compositions so future Supabase rows, external API rows and manual overrides can be checked with the same rules before becoming budget candidates.

## Candidate Approval

No candidate is auto-approved by this contract. A candidate with `candidateApprovedByUser=false` remains pending even if its source row is otherwise usable.

This preserves the product rule: pricing can be suggested, matched and ranked, but reviewed budget approval is a user decision.

## Current Gaps

- Waste/loss is not part of every imported SINAPI row today; the contract supports it when future rows or manual overrides provide the value.
- H/H realism currently uses a conservative threshold. A future data-quality cycle can replace it with method-specific thresholds.
- Regional fallback is explicit via `allowOutOfRegionFallback`; the UI still needs to make that acceptance clear before a fallback price is used.

## Validation

Covered by `tests/price-quality-contract.test.ts`:

- valid reviewed composition;
- zero price;
- missing price;
- invalid unit;
- incompatible unit;
- out-of-region price;
- missing source metadata;
- missing reference;
- unknown regime;
- invalid cost breakdown;
- negative and unrealistic H/H;
- negative and unrealistic waste;
- candidate not auto-approved;
- alignment with current SINAPI importer output.
