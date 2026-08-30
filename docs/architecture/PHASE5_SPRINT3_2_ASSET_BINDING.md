# Visual 4D — Phase 5 / Sprint 3.2 Controlled Asset Binding

## Objective
Bind real raster assets into a deterministic RenderSpec while preserving provenance, approval metadata, and the security invariants certified in Sprint 2.x.

## Scope

- Add `packages/asset-binding` as the policy boundary between repository assets and rendering.
- Preserve provenance metadata on rendered image elements.
- Permit only inline raster data for PNG, JPEG, and WebP in this sprint.
- Reject remote image URLs to avoid uncontrolled network retrieval/tracking at render time.
- Reject SVG data payloads in the raster binding path.
- Enforce existing provenance rules, including:
  - generated content cannot be documentary evidence;
  - MASTER assets cannot be represented as AI-generated;
  - documentary assets cannot be AI-generated.
- Validate approval timestamp consistency.
- Replace only an explicitly bindable `HERO_PLACEHOLDER` element.
- Generate a CI reference SVG with a bound raster asset.

## Security rationale

Asset binding is intentionally separate from the renderer. The renderer must not decide whether an asset is trustworthy. Binding validates provenance and transport safety first; rendering consumes only the resulting validated RenderSpec.

## Non-goals

- No remote object-storage fetching yet.
- No SVG/image scripting.
- No generative edits of MASTER assets.
- No browser upload UI.
- No production CDN integration.

## Closure gates

Sprint 3.2 closes only when CI confirms:

1. Sprint 2.x core certification remains green;
2. Sprint 3.0/3.1 tests remain green;
3. controlled asset-binding tests pass;
4. unsafe/mismatched image sources are rejected;
5. provenance policy violations are rejected;
6. a raster-bound SVG reference artifact is generated;
7. PostgreSQL/MCP certification remains green.

## Next increment

Sprint 3.3: identity/style tokens and deterministic brand-safe composition, followed by an application-facing render service contract.
