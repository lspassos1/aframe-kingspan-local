# PR #257 Visual Check

Refs #257

Runtime failure state to validate manually after deploy:

- Route: `/start?mode=ai`
- Desktop: 1440px wide
- Mobile: 390px wide
- Trigger: upload a small PNG/JPG/PDF that returns an extraction error, or force the plan import card into `error` during local QA.

Expected result:

- Main upload card shows `Análise indisponível`.
- Product status shows `Análise não concluída`, `Continuar manualmente disponível`, and `Tente outro arquivo`.
- The status panel does not present `Upload habilitado` or cache availability as the primary signal after the runtime failure.
- `Continuar manualmente` remains visible as the safe recovery path.
- Normal UI does not expose provider names, model names, raw env names, router details, stack traces, or paid fallback language.
