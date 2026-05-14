# Normalized SINAPI Sources

This directory stores reviewed, normalized input files for the guarded SINAPI sync workflow.

Files here are not database dumps. They are normalized source inputs consumed by:

```bash
node scripts/sinapi-sync-monthly.mjs --dry-run --json --input <file>
```

Write mode remains admin-only through the manual GitHub Actions workflow and repository secrets.

## Files

- `sinapi-ba-2026-04-desonerado-caixa.json`
  - Source: CAIXA `SINAPI-2026-04-formato-xlsx.zip`, published on 2026-05-12.
  - Scope: Bahia (`BA`), `desonerado`, reference month `2026-04`.
  - Rows: supported-unit SINAPI input rows only.
  - Purpose: initial central price database seed for reviewed remote candidates.
