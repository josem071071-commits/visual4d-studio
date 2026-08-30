# Visual 4D — Phase 5 / Sprint 3.5 MCP Render Preview

## Objective
Expose the deterministic render service as an authenticated MCP tool that can serve as the first ChatGPT-facing visual creation entry point.

## Tool
`generation.render_preview`

## Contract
- Strict nested JSON schema with `additionalProperties: false`.
- Read-only, non-destructive, idempotent, closed-world annotations.
- No `projectId`, approval grant, request ID, persistence, finalization, or repository mutation input.
- Validated LayoutIntent, content, identity tokens, and optional inline raster hero asset.
- Returns the deterministic render-service result including SVG and provenance summary.

## Security boundary
The HTTP MCP server still requires bearer authentication. This tool grants no additional approval or persistence privileges. Existing provenance, raster safety, contrast, font, and renderer validation remain authoritative and failures propagate to the MCP caller.

## Closure gates
1. All previous Sprint 2.x and Sprint 3.x certification gates remain green.
2. Tool contract is read-only/idempotent/closed-world.
3. Invalid enum/style/provenance input is rejected.
4. A real authenticated MCP client can discover `generation.render_preview`.
5. A real authenticated MCP client can invoke it and receive deterministic SVG output.
6. Unauthenticated MCP remains rejected.
7. PostgreSQL/MCP core certification remains green.

## Next boundary
A production ChatGPT connection requires deployment infrastructure, HTTPS, production authentication/authorization, and a non-inline asset transport strategy. Those choices are intentionally not guessed inside Sprint 3.5.
