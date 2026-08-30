# Visual 4D — Phase 5 / Sprint 3.4 Application-Facing Render Service

## Objective
Expose the certified visual pipeline behind one deterministic service boundary suitable for later MCP/API/UI consumption.

`LayoutIntent + Content + optional raster asset + IdentityTokens → LayoutSpec → RenderSpec → SVG + provenance summary`

## Scope
- Add `packages/render-service`.
- Keep policy in the existing layout, provenance, asset-binding, identity, and renderer packages.
- Provide `Visual4DRenderService.render()` and `renderVisual4DFlyer()`.
- Return exact LayoutSpec, RenderSpec, SVG, and rendered-asset summary.
- Preserve deterministic output for identical input.
- Support a safe no-image render.
- Propagate policy failures without bypasses.
- Generate SVG and JSON CI contract references.

## Closure gates
1. Previous certification gates remain green.
2. Identical requests return identical results.
3. The complete visual pipeline executes behind one boundary.
4. Provenance/accessibility failures propagate.
5. No-image rendering remains valid.
6. SVG and JSON reference artifacts are generated.
7. PostgreSQL/MCP certification remains green.

## Next increment
Sprint 3.5: expose this service through a strictly validated render MCP tool suitable for ChatGPT-facing integration, without granting persistence or approval privileges.
