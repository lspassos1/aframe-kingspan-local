# PR 209 - Scene-first 3D shell

Screenshots captured locally at `http://localhost:3000/model-3d` after the scene-first shell update.

## Files

- `209-model-3d-scene-shell-desktop.png` - desktop layout with the 3D scene as the main surface, floating view/actions toolbar, collapsible controls entry, and bottom summary strip.
- `209-model-3d-scene-shell-mobile.png` - mobile layout with simplified model preview, compact summary, quick views, reset, and collapsed advanced controls.

## Validation notes

- The route stayed on `/model-3d`; it did not redirect to `/start`.
- The captured project used the generic construction viewer path (`Alvenaria convencional`), including manual openings in the preview.
- The A-frame viewer shares the same shell component and keeps React Three Fiber `<Canvas>`; no real A-Frame migration was introduced.
