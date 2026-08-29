# Formal review — Sprint 2.1

Status: **APPROVED FOR LOCAL INTEGRATION HARDENING**.

Independent runtime verification: **34/34 tests passed** using the compiled Sprint 2.1 artifacts.

## Final findings before network/local MCP work

1. The workflow/security architecture is sound: owner authorization, exact-version approvals, mandatory DesignVersion, strict input contracts, idempotency, resource requirements and atomic identity activation are present.
2. The project was still on Zod 3.24.0. MCP TypeScript SDK v2 requires the modern Standard Schema path; Sprint 2.2 upgrades to Zod 4.4.3.
3. A model-callable approval tool still relied on a description saying it should only run after explicit user approval. Sprint 2.2 introduces one-time approval grants minted by a separate authenticated user-action endpoint.
4. Finalization previously approved the verification internally. Sprint 2.2 removes this behavior: FINAL requires an already user-approved exact verification version.
5. Actor permissions existed but were not enforced. Sprint 2.2 requires `visual4d:write`.
6. Database FKs for verification/final design were not project-scoped. Sprint 2.2 adds same-project composite FKs.

## Decision

No conceptual redesign is required. Sprint 2.1 is accepted as the service/security baseline and Sprint 2.2 may add a real PostgreSQL repository and an authenticated loopback MCP server.
