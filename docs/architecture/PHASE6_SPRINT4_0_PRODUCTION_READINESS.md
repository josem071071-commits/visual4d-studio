# Visual 4D — Phase 6 / Sprint 4.0 Production Connection Readiness

## Status entering this phase

Sprint 3.5 has established and externally certified an authenticated MCP render-preview path. A real MCP client can discover and invoke `generation.render_preview` and receive deterministic SVG output while the existing PostgreSQL/MCP core certification remains green.

## Objective

Prepare Visual 4D Studio for a production ChatGPT-facing connection without pretending that local-development security or inline assets are production infrastructure.

## What is already ready

- Deterministic layout solver.
- Versioned RenderSpec.
- SVG reference renderer.
- Controlled raster asset binding and provenance enforcement.
- Validated identity/style tokens and contrast gates.
- Application-facing render service.
- Authenticated MCP transport in local/test mode.
- Read-only `generation.render_preview` MCP tool.
- Existing gated workflow, approvals, PostgreSQL persistence, idempotency and authorization core.
- External CI evidence covering Node 22, PostgreSQL 16, TypeScript, runtime/domain suites, migrations and MCP integration.

## Production gaps that must not be guessed

### 1. Public deployment target
A production MCP endpoint needs a selected hosting/runtime environment, public HTTPS endpoint, health checks, logs, deployment identity, rollback strategy and secrets management.

### 2. Production authentication and authorization
`VISUAL4D_LOCAL_AUTH_TOKEN` is explicitly a local-development mechanism. Production must use an authenticated identity mechanism appropriate to the selected ChatGPT/app connection and map that identity to Visual 4D users/permissions.

### 3. Asset transport and object storage
Sprint 3.5 intentionally accepts only bounded inline raster data. Production needs a controlled object-storage/asset-delivery strategy with ownership checks, content-type validation, size limits, checksums and provenance. Remote arbitrary URLs must not become an implicit bypass.

### 4. Production database
A managed or otherwise operational PostgreSQL environment must be selected with backup, restore, migration, connection security, monitoring and least-privilege credentials.

### 5. Domain and TLS
A stable production hostname and TLS termination strategy are required before an external ChatGPT-facing connection can be considered operational.

## Required deployment decisions

The next implementation sprint starts only after these external values are selected or supplied:

1. hosting/runtime provider or environment;
2. production hostname/domain strategy;
3. production authentication mechanism supported by the intended ChatGPT integration;
4. PostgreSQL hosting strategy;
5. object-storage/asset strategy;
6. secret-management mechanism.

## Non-negotiable production invariants

- Do not expose the static local bearer token as production authentication.
- Do not expose the development approval-grant HTTP bridge in production.
- Do not weaken project/institution ownership boundaries.
- Do not allow arbitrary remote URLs as trusted assets.
- Do not permit generated imagery to become documentary evidence.
- Do not generatively edit MASTER assets.
- Do not auto-approve verification or final output.
- Preserve exact-version approvals and auditability.
- Preserve deterministic rendering inputs and provenance summaries.
- Production deployment is not certified until an external HTTPS environment executes its own smoke/integration gates.

## Next executable sprint after infrastructure selection

**Sprint 4.1 — Production MCP Deployment Adapter**

Expected scope:

- provider-specific deployment manifest/configuration;
- production identity adapter;
- production-safe asset resolver;
- PostgreSQL production configuration;
- secrets wiring without committed secrets;
- HTTPS health/smoke tests;
- authenticated remote MCP discovery and `generation.render_preview` invocation;
- deployment-specific CI/CD and rollback evidence.

## Closure rule

Sprint 4.0 is a readiness boundary, not a claim of production deployment. Visual 4D Studio is ready to move from locally certified MCP integration to production connection engineering once the external infrastructure choices above are supplied.
