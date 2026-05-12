# PR #204 Golden Product Flows Screenshot Evidence

This PR adds deterministic smoke coverage for the core product flows and uses existing desktop/mobile captures from the recent UX stack as the visual evidence baseline.

## Covered Routes And States

| Flow | Desktop evidence | Mobile evidence |
| --- | --- | --- |
| `/` landing | `docs/design-audit/screenshots/pr199/199-home-desktop.png` | `docs/design-audit/screenshots/pr199/199-home-mobile.png` |
| `/start` guided entry | `docs/design-audit/screenshots/pr199/199-start-desktop.png` | `docs/design-audit/screenshots/pr199/199-start-mobile.png` |
| upload/review | `docs/design-audit/screenshots/pr199/199-upload-review-desktop.png` | `docs/design-audit/screenshots/pr199/199-upload-review-mobile.png` |
| `/budget-assistant` without price base | `docs/design-audit/screenshots/pr205/205-budget-assistant-empty-desktop.png` | `docs/design-audit/screenshots/pr205/205-budget-assistant-empty-mobile.png` |
| `/budget-assistant` local/fallback actions | `docs/design-audit/screenshots/pr205/205-budget-guidance-desktop.png` | `docs/design-audit/screenshots/pr205/205-budget-guidance-mobile.png` |
| `/help` safe diagnostics | `docs/design-audit/screenshots/pr205/205-help-actions-desktop.png` | `docs/design-audit/screenshots/pr205/205-help-actions-mobile.png` |
| export guidance | `docs/design-audit/screenshots/pr205/205-export-guidance-desktop.png` | `docs/design-audit/screenshots/pr205/205-export-guidance-mobile.png` |

## Golden Scenarios

- App without AI configured.
- App with Free mode configured.
- App without remote price database.
- App with no imported price base.
- App with local imported price base fixture.
- Missing price fallback flow.
- Review-required budget line.

The screenshots above are not new runtime output from this PR. They are the latest existing desktop/mobile captures for the same route surfaces, while `tests/product-golden-flows.test.ts` adds the repeatable regression gate for the product states listed here.
