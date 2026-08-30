# Visual 4D — Phase 6 / Sprint 4.1 Staging Deployment

## Objective

Produce a reproducible staging deployment adapter for Visual 4D Studio before any production ChatGPT connection. The staging image must preserve the certified Sprint 2.x/3.x security and rendering guarantees while proving that the MCP service can run inside a deployable container.

## Selected staging target

Railway is the initial staging target because it can build the repository root `Dockerfile`, inject a runtime `PORT`, attach a managed PostgreSQL service, perform HTTP health checks, and use configuration-as-code through `railway.json`.

This selection is for staging. It does not make the local bearer-token mechanism acceptable for production identity.

## Deliverables

- Multi-stage Node 22 `Dockerfile`.
- Non-root runtime process.
- Production dependency-only runtime image.
- Container health check against `/healthz`.
- Railway config-as-code with `/healthz` deployment gate and restart policy.
- `.env.staging.example` containing names only, never real secrets.
- CI staging certification that:
  1. starts PostgreSQL 16;
  2. applies all UP migrations in order;
  3. builds the exact Docker image;
  4. runs the image with the development approval bridge disabled;
  5. checks `/healthz`;
  6. confirms unauthenticated MCP access is rejected;
  7. authenticates an MCP client;
  8. discovers `generation.render_preview` as read-only;
  9. invokes a real deterministic SVG preview;
  10. confirms `/local/approval-grants` is unavailable.

## Runtime contract

Required staging variables:

- `DATABASE_URL`
- `VISUAL4D_LOCAL_AUTH_TOKEN` — staging secret only
- `VISUAL4D_LOCAL_USER_ID` — staging principal only

Recommended/controlled variables:

- `VISUAL4D_ALLOW_DEV_APPROVAL_GRANTS=false`
- `VISUAL4D_MCP_HOST=0.0.0.0`
- `PORT` — injected by Railway; Docker defaults to 8787 when absent
- `VISUAL4D_MAX_BODY_BYTES=65536`
- `VISUAL4D_REQUEST_TIMEOUT_MS=10000`
- `VISUAL4D_RATE_LIMIT_PER_MINUTE=120`

## Security boundary

Sprint 4.1 is intentionally a staging adapter, not a production authentication design. The static bearer token remains acceptable only as an isolated staging credential. It must be rotated, stored only in the provider secret store, and must not be reused for production.

The development approval-grant bridge is forced off in the container image and must remain off in staging. No secret is committed to the repository. Arbitrary remote asset URLs remain unsupported.

## Railway wiring

Create one Railway project with two services:

1. PostgreSQL 16 managed service.
2. Visual 4D service connected to this GitHub repository.

Set `DATABASE_URL` from the PostgreSQL service reference, create a strong staging-only `VISUAL4D_LOCAL_AUTH_TOKEN`, set `VISUAL4D_LOCAL_USER_ID`, and keep `VISUAL4D_ALLOW_DEV_APPROVAL_GRANTS=false`. Railway should build the root Dockerfile and use `/healthz` from `railway.json` as the deployment health gate.

Before the first public staging endpoint is accepted, apply the UP migrations to the managed staging database using a controlled pre-deploy/admin operation. Database reset flags used in CI must never be enabled in staging.

## Closure gates

Sprint 4.1 code-side preparation closes when GitHub Actions proves the container staging certification PASS without weakening the existing core workflow.

The external staging deployment closes only when a real Railway HTTPS URL passes the same remote MCP smoke test with provider-managed secrets and managed PostgreSQL.

## Next sprint

Sprint 4.2 — External HTTPS Staging Certification and production identity design. It requires the actual Railway project/service URL and provider-side secrets/database to exist.
