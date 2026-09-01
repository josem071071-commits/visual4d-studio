# Visual 4D Studio — Production Operations, Cutover and Rollback Runbook

Owner process: **V4D-SAT — Equipo de Aseguramiento Integral de Sistemas Visual 4D**

Current state: **production-candidate operational**. The public website, Railway MCP runtime, PostgreSQL bootstrap, OAuth/ChatGPT integration and the 11-tool MCP workflow have all passed automated or real production certification. `publication_ready` remains fail-closed until the remaining branding/external publication gates are explicitly completed.

## Production topology

- `https://www.visual4dstudio.com` — public product site on Cloudflare.
- `/privacy`, `/terms`, `/support`, `/security` — certified public routes.
- `https://mcp.visual4dstudio.com/mcp` — production MCP on Railway.
- `https://mcp.visual4dstudio.com/healthz` — process liveness.
- `https://mcp.visual4dstudio.com/readyz` — PostgreSQL/schema readiness.
- Production schema contract — migrations `0001` through `0006`, 17 required application tables.

## Protected baseline

The currently certified chain must never regress silently:

`WEB -> CLOUDFLARE -> RAILWAY -> POSTGRESQL -> OAUTH -> MCP -> tools/list(11) -> projects.create -> complete workflow -> CHATGPT`

Every production change must retain an exact rollback SHA and pass Core Certification before merge.

## Readiness semantics

`/healthz` answers whether the MCP process is alive. It deliberately does not depend on PostgreSQL.

`/readyz` answers whether the instance can serve stateful production work. HTTP 200 requires:

- PostgreSQL connection succeeds;
- `visual4d_schema_migrations` exists;
- all six migration versions are present;
- all 17 production tables are present.

A degraded readiness response is HTTP 503 with a stable error code and `Retry-After`. Detailed missing-schema diagnostics are server-side only.

## Deployment sequence

1. Select an immutable commit SHA that passed Core Certification.
2. Keep `railway.json` pinned to `Dockerfile.production`; CI rejects any drift.
3. Railway builds the production image, ships canonical migration SQL and runs schema bootstrap before starting the MCP server.
4. Wait for Railway deployment status `success`.
5. Verify `/healthz` and `/readyz` from an independent external runner.
6. Verify OAuth metadata, Bearer challenge and MCP discovery.
7. Verify the 11-tool catalog remains unchanged unless an intentional, reviewed release modifies it.
8. For public-site changes, require Cloudflare build success and live-route certification.

## Release Candidate sequence

A release candidate is an **exact SHA**, not a mutable branch description.

- Manual: dispatch `Visual 4D Release Candidate` with a full 40-character SHA.
- Automated: create a branch named `rc/<candidate-name>` pointing to the exact green SHA. The RC workflow automatically checks out and validates that SHA.
- The RC identity gate validates publication metadata, core/integration builds, typecheck and production deployment configuration.
- Promotion additionally requires Core, production auth, external MCP/readiness, public website and recovery gates to be green for that candidate.

Do not set `publication_ready=true` merely because an RC passes technical certification.

## Database recovery certification

CI demonstrates logical PostgreSQL recovery using `pg_dump`/`pg_restore`:

1. bootstrap the full production schema;
2. create a real project through the domain service;
3. create a logical backup;
4. destroy the application schema;
5. restore the backup;
6. verify the project, six-entry migration ledger and completed idempotency record;
7. rerun production bootstrap and require zero new migrations;
8. replay the same idempotent project-creation request and require the original project ID.

This proves logical backup/restore feasibility. Provider-managed backup retention and disaster-recovery policy remain operational account settings and must be reviewed separately.

## Observability

Production tool executions emit structured `[mcp-tool]` JSON events containing only operational metadata:

- tool;
- authenticated actor ID;
- outcome;
- duration;
- request/project/institution IDs when present;
- sanitized error code when applicable.

Bearer tokens and full tool payloads must never be logged. CI explicitly checks token non-disclosure.

## Rollback triggers

Rollback or stop promotion immediately if any of these occur:

- `/readyz` is persistently 503 after the expected bootstrap interval;
- OAuth accepts invalid issuer/audience/signature or staging credentials;
- unauthenticated MCP operations succeed;
- data isolation between actors/projects fails;
- stage approvals or one-time grants can be bypassed;
- the 11-tool catalog changes unintentionally;
- a schema migration cannot complete or recovery validation fails;
- production error/latency prevents the core workflow;
- public routes or TLS become unstable.

## Runtime rollback procedure

1. Freeze further merges and record the failing deployment SHA.
2. Preserve logs and evidence before changing state.
3. Redeploy the last certified rollback SHA in Railway.
4. Do **not** roll back the database by running destructive DOWN migrations unless a migration-specific rollback has been explicitly reviewed against existing data.
5. If data recovery is required, restore from the selected provider backup/logical backup into a controlled target first, validate schema/readiness, then perform the provider-approved cutover.
6. Revoke affected tokens/credentials if security is implicated.
7. Re-run `/healthz`, `/readyz`, OAuth/MCP discovery and Core Certification before reopening promotion.

## Cloudflare rollback

Website and MCP routing are separated. A web rollback must not alter `mcp.visual4dstudio.com` unless the MCP route itself is the diagnosed failure.

1. Promote the previous known-good Cloudflare version.
2. Verify `/`, `/privacy`, `/terms`, `/support`, `/security` externally.
3. Preserve `www` custom-domain mapping and do not edit unrelated `mcp` DNS records.

## Completion criteria for v1.0.0

Technical promotion to v1.0.0 requires, at minimum:

- 11 tools certified in one real PostgreSQL/MCP workflow;
- state-machine negative paths certified;
- schema bootstrap and migration 0006 round trip certified;
- liveness/readiness and structured observability certified;
- logical database backup/restore certified;
- Railway and Cloudflare production deployments healthy;
- public website routes healthy;
- OAuth/ChatGPT production integration healthy;
- immutable RC SHA certified;
- rollback reference and runbook recorded;
- no unresolved critical security defects.

Public/marketplace publication is a separate gate: branding assets and any remaining external registration requirements must be explicitly approved before `publication_ready=true`.
