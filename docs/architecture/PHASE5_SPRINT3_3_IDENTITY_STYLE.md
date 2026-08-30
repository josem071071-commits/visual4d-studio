# Visual 4D — Phase 5 / Sprint 3.3 Identity Tokens + Brand-Safe Composition

## Objective
Apply institutional identity through a deterministic, validated token contract without allowing arbitrary CSS, remote fonts, or geometry changes.

## Scope

- Add `packages/identity-style` as the styling policy boundary.
- Define `visual4d.identity.v1` with explicit colors and safe local typography tokens.
- Accept only six-digit hexadecimal colors.
- Restrict typography to predefined system font stacks.
- Enforce minimum 4.5:1 contrast for primary, body, and muted text against the background.
- Apply identity to an existing RenderSpec without modifying its geometry or asset provenance.
- Extend renderer validation so injected unsafe fills/font families are rejected.
- Generate a CI reference SVG combining layout, asset binding, identity tokens, and rendering.

## Security and accessibility rationale

Identity data is treated as structured input, not executable styling. This sprint intentionally excludes arbitrary CSS, remote font URLs, gradients, SVG filters, scripts, and external resources. Color contrast is checked before styling is accepted.

## Closure gates

Sprint 3.3 closes only when CI proves:

1. previous Sprint 2.x and Sprint 3.x gates remain green;
2. identity validation tests pass;
3. low-contrast palettes are rejected;
4. arbitrary font/style injection is rejected;
5. applying identity does not change layout geometry;
6. a brand-styled reference SVG is generated;
7. PostgreSQL/MCP certification remains green.

## Certification status

Implementation complete; external CI certification pending for this commit line.

## Next increment

Sprint 3.4: application-facing render service contract that composes validated layout, content, asset binding, identity, RenderSpec, SVG output, and provenance summary behind one deterministic service boundary.
