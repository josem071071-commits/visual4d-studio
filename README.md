# Visual 4D Prototype v0.2.2

Sprint 2.2 adds a **real PostgreSQL repository** and a **local authenticated MCP v2 HTTP server** while preserving the Visual 4D gated workflow.

## Current pipeline

`ANALYZE → USER APPROVAL → STRUCTURE → USER APPROVAL → RESOURCES → USER APPROVAL → ART DIRECTION → USER APPROVAL → DESIGN VERSION → VERIFY EXACT DESIGN → USER APPROVAL → FINAL`

## Security invariants

- private owner/institution boundary;
- `visual4d:write` permission required;
- MASTER ASSETS cannot be generatively edited;
- generated imagery cannot be documentary evidence;
- every gated stage uses an exact approved artifact version;
- explicit approvals require a one-time user-action grant at the MCP boundary;
- FINAL cannot auto-approve verification;
- verification/final design FKs are scoped to the same project;
- idempotency and optimistic project revisions are persisted.

## Sprint 2.2 components

- `packages/postgres-repository`: node-postgres implementation of `ProjectRepository`;
- `services/mcp-server/src/local-server.ts`: loopback Streamable HTTP MCP v2 server;
- `local-auth.ts`: static Bearer auth for local development only;
- `approval-grants.ts`: one-time explicit user approval grants;
- migration `0004_sprint2_2_pg_mcp.sql`;
- PostgreSQL and MCP integration tests.

## Local development variables

See `.env.example`. Required for the local MCP server:

- `DATABASE_URL`
- `VISUAL4D_LOCAL_AUTH_TOKEN`
- `VISUAL4D_LOCAL_USER_ID`

The server defaults to `127.0.0.1:8787` and must not be exposed publicly with this development authentication scheme.

## Dependency installation gate

This package intentionally does not include the stale Sprint 2.1 lockfile because dependencies changed to MCP v2, PostgreSQL and Zod 4. On a network-connected development environment run:

```bash
npm install
npm run build:integration
npm test
```

Then commit the generated lockfile after the clean build passes.

## Tests available without external services

The core and source-contract suite currently passes **40/40** in the build environment.

PostgreSQL integration tests additionally require `VISUAL4D_TEST_DATABASE_URL`. MCP integration tests require installed MCP v2 dependencies.

## Not production ready

This is a local integration prototype. Production ChatGPT connectivity, HTTPS deployment, OAuth/production authentication, object storage, renderer and image-generation services are intentionally outside this sprint.

## Sprint 2.3 — Core Certification

Sprint 2.3 hardens transactional integrity, idempotency, approval grants, MCP contracts and HTTP boundaries before any Layout Solver/renderer work.

Key additions:
- PostgreSQL transaction context across workflow mutations
- concurrency-safe idempotency reservation
- persisted approval grants with `ISSUED / CLAIMED / CONSUMED`
- pre-grant ownership/stage/version validation
- development-only explicit approval bridge
- HTTP body, timeout and rate limits
- MCP tool annotations
- real PostgreSQL + MCP end-to-end certification test

Local non-database gate in the build environment: **49/49 PASS**.
The real PostgreSQL/MCP certification gate remains mandatory before declaring the secure core closed; see `docs/architecture/PHASE5_SPRINT2_3_CORE_CERTIFICATION.md`.

## Sprint 2.4 — External CI Certification package
This package includes `.github/workflows/core-certification.yml`, a disposable PostgreSQL 16 CI service, no-skip wrappers for mandatory integration tests, and automatic generation of `certification/CORE_EXTERNAL_CERTIFICATION_REPORT.md`. A core certification is valid only after a green external CI run with zero skipped tests.
