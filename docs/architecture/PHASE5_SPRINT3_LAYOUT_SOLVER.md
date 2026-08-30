# Visual 4D — Phase 5 / Sprint 3 Layout Solver v1

## Objective
Evolve the certified core into a deterministic visual-composition layer before introducing a user-facing application shell.

Sprint 3 does not weaken or bypass any Sprint 2.4 certification gate. The secure core remains the authority for workflow state, approvals, provenance, identity and persistence.

## Scope

1. Evolve `packages/layout-engine` from a fixed baseline into an intent-sensitive deterministic solver.
2. Preserve the canonical 1080 × 1920 portrait format and safe-area constraints.
3. Support hero placement variants: `UPPER`, `CENTER`, `LOWER`, `LEFT`, `RIGHT`.
4. Support meaningful headline alignment zones: `UPPER_LEFT`, `UPPER_CENTER`, `UPPER_RIGHT`.
5. Make text-density and headline-prominence inputs affect layout constraints.
6. Add machine-verifiable geometry validation for safe-area containment and critical-region overlap.
7. Add a dedicated Sprint 3 runtime suite to external CI.

## Non-goals

- no production frontend yet;
- no public deployment;
- no generative image provider integration;
- no weakening of explicit human approval gates;
- no modification of documentary/master-asset provenance rules;
- no renderer that silently changes approved content.

## Architectural rule

`APP/UI (future) -> workflow/core -> approved visual intent -> layout solver -> render specification -> renderer (future) -> verification -> explicit approval -> FINAL`

The layout solver is pure and deterministic: equal inputs must produce equal output. It must not read network state, mutate project state or make approval decisions.

## Sprint 3.0 acceptance gates

- TypeScript strict build passes.
- Existing Sprint 2.x suites remain green.
- Equal layout intents produce identical specs.
- All supported hero zones remain inside the 1080 × 1920 safe area.
- Critical regions do not overlap.
- Headline zones materially affect placement.
- Text-density constraints preserve a minimum body font size of 28 px.
- External GitHub Actions certification remains green.

## Next increment after 3.0

Sprint 3.1 should introduce a renderer-neutral `RenderSpec` contract and an SVG reference renderer. The renderer must consume a validated `LayoutSpec`; it must not recalculate workflow state or approvals.
