# Sprint 2.4 — External CI Certification

## Objective
Certify the Visual 4D secure core in a clean CI environment with a real disposable PostgreSQL service and authenticated MCP integration. No visual renderer is included in this sprint.

## Required gate
A successful certification requires all of the following in the same CI run:

- `npm ci`
- core build
- full TypeScript typecheck
- integration build
- runtime/domain/state-machine suites
- PostgreSQL migration UP/DOWN/UP
- PostgreSQL atomic rollback
- concurrent idempotency exactly-once behavior
- authenticated MCP end-to-end workflow
- cross-user authorization rejection
- approval grant failure/retry lifecycle
- 0 skipped certification tests
- 0 failed tests

## Trust model
The PostgreSQL service exists only for CI and may be destructively reset. Development approval grants are enabled only in this isolated certification job. This mechanism is not approved for production authentication or production human approval.

## Release rule
After a green CI run, tag the exact commit as `visual4d-core-v0.2.4-certified`. Sprint 3 must branch from that exact certified commit.
