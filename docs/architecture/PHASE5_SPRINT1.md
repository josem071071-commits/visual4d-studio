# Visual 4D Prototype v0.1 — Phase 5 / Sprint 1

## Sprint goal
Build and verify the trustworthy core before MCP, rendering, or AI integration.

## Included
- Shared domain rules
- State machine and approval guards
- Provenance rules
- Layout intent -> deterministic baseline solver
- PostgreSQL core migration + rollback
- Unit tests

## Explicitly excluded from Sprint 1
- ChatGPT UI
- MCP transport/server wiring
- OpenAI model calls
- Image generation
- Chromium renderer
- S3 client implementation
- Authentication integration

## Non-negotiable invariants
1. Master assets cannot be generatively edited.
2. Generated imagery cannot be documentary evidence.
3. Cross-institution asset mixing is forbidden.
4. The v0.1 flyer canvas is portrait 9:16.
5. Method stages cannot be skipped.
6. Critical verification errors block APPROVED and FINAL.
7. Historical versions are not overwritten.

## Sprint 1 exit criteria
- Core TypeScript compiles.
- Domain/state/provenance/layout unit tests pass.
- PostgreSQL migration has an explicit down migration.
- No OpenAI key is required to test the core.
