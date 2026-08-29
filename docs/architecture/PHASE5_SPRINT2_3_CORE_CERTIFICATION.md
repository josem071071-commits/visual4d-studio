# Visual 4D — Phase 5 / Sprint 2.3 Core Certification

## Objective
No visual output. Certify the trustworthy core before Layout Solver/renderer work.

## Implemented hardening

1. Transaction-scoped idempotency. `ProjectWorkflowService.once()` delegates to repository `runIdempotentMutation()`.
2. PostgreSQL mutations run inside one transaction context using `AsyncLocalStorage`; artifact creation, project transitions, approvals, audit writes and idempotency can share the same transaction.
3. Concurrent duplicate request keys are reserved before side effects.
4. Approval grants use explicit lifecycle `ISSUED -> CLAIMED -> CONSUMED`; failed approval returns an unexpired grant to `ISSUED`.
5. Approval grants are persisted in PostgreSQL by hash, not raw token.
6. Grant issuance validates actor ownership, exact project, current artifact version and expected review stage.
7. The HTTP approval bridge is explicitly development-only (`allowDevApprovalGrants` + `x-visual4d-dev-user-action`).
8. MCP tools use strict schemas and annotations.
9. HTTP boundary adds body-size limit, timeout and per-user minute rate limiting.
10. Migration `0005_sprint2_3_core_certification` persists idempotency states and approval grants.
11. A real PostgreSQL/MCP certification test is provided. It resets only a database explicitly opted in with `VISUAL4D_CERTIFICATION_ALLOW_SCHEMA_RESET=true`.

## Certification gates

### Executed in this environment
- TypeScript core build: PASS
- Runtime/domain/state/security tests: PASS, 49/49
- Concurrent duplicate mutation test (memory repository): PASS
- Static transactional/MCP/migration contract checks: PASS

### Prepared but not executable in this environment
The following require a clean npm dependency installation and a real PostgreSQL test database:
- full `npm ci` reproducibility gate
- full TypeScript integration build/typecheck
- PostgreSQL transaction rollback test
- PostgreSQL concurrent idempotency test
- PostgreSQL UP/DOWN/UP migration test
- cross-user authorization against network MCP
- complete MCP end-to-end workflow
- approval claim failure/retry against PostgreSQL

Run with:

```bash
VISUAL4D_TEST_DATABASE_URL='postgres://...' \
VISUAL4D_CERTIFICATION_ALLOW_SCHEMA_RESET=true \
npm run test:certification
```

The certification database must be disposable. The integration test intentionally drops and recreates its `public` schema.

## Core closure rule
The secure core is not declared 100/100 until every external certification gate executes with zero skipped tests and zero failures in CI.
