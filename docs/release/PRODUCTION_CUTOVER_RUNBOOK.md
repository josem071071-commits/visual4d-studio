# Visual 4D Studio — Production Cutover Runbook

Sprint 4.11

Target public domain: `https://www.visual4dstudio.com`

Current status: domain declared by operator, not yet technically certified. Staging remains the only certified runtime endpoint.

## Objective

Move Visual 4D Studio from certified staging to a production deployment without reusing staging credentials, weakening OAuth, or losing rollback capability.

## Preconditions

Do not start cutover until all of the following are true:

- final release candidate SHA selected;
- Core, Production Auth, External HTTPS/MCP and Publication Readiness certifications are green on that exact SHA;
- DNS control for `visual4dstudio.com` is verified;
- production hosting target exists independently of staging;
- Clerk production environment is configured;
- exact OpenAI/ChatGPT redirect URI is known from a supported registration/submission surface;
- public legal/support pages exist over HTTPS;
- final app identity assets are approved;
- backup/rollback point is recorded.

## Intended public topology

Recommended separation:

- `https://www.visual4dstudio.com` — public product site.
- `https://www.visual4dstudio.com/privacy` — privacy policy.
- `https://www.visual4dstudio.com/terms` — terms of service.
- `https://www.visual4dstudio.com/support` — support/contact.
- `https://www.visual4dstudio.com/security` — security reporting.
- `https://mcp.visual4dstudio.com/mcp` — production MCP endpoint.

The MCP subdomain is recommended so runtime traffic can be operated, observed and rolled back independently from the public website.

## DNS phase

1. Confirm registrar ownership/control.
2. Record current DNS zone before changes.
3. Configure `www` for the public website target.
4. Configure `mcp` for the production runtime target.
5. Keep TTL reasonably low during initial cutover.
6. Verify DNS resolution from at least two independent public resolvers.
7. Verify TLS certificates for both `www` and `mcp` before exposing OAuth traffic.

## Production runtime phase

1. Deploy the exact RC SHA to an isolated production service.
2. Do not copy the staging static bearer secret into production.
3. Configure production database and secrets independently.
4. Configure production OIDC issuer/JWKS/audience values.
5. Run production preflight and health checks.
6. Confirm unauthenticated MCP requests receive the expected Bearer challenge and protected-resource metadata.
7. Confirm staging authentication is rejected.

## Clerk production phase

1. Promote/recreate the Clerk configuration in Production.
2. Preserve least privilege scopes:
   - `visual4d:read`
   - `visual4d:render`
   - `visual4d:write`
   - `visual4d:approve`
   - `visual4d:identity`
3. Initial ChatGPT authorization remains restricted to read/render unless the platform review explicitly requires more.
4. Register the exact redirect URI supplied by OpenAI/ChatGPT. Never approximate it.
5. Validate Authorization Code + PKCE.
6. Validate issuer, audience, signature, expiry and per-user `sub` mapping.
7. Validate disconnect/revocation behavior.

## Public policy phase

Only after the pages are live and verified, set manifest URLs to:

- `https://www.visual4dstudio.com/privacy`
- `https://www.visual4dstudio.com/terms`
- `https://www.visual4dstudio.com/support`
- `https://www.visual4dstudio.com/security`

Do not mark these URLs as live merely because the paths are planned.

## End-to-end acceptance test

Required production test sequence:

1. Open the target ChatGPT/OpenAI app integration.
2. Start OAuth authorization.
3. Confirm Clerk consent displays only intended initial privileges.
4. Complete PKCE callback successfully.
5. Call MCP discovery/listing.
6. Call `generation.render_preview` successfully.
7. Attempt a write operation without write scope and confirm denial.
8. Disconnect/revoke authorization.
9. Confirm the revoked session/token can no longer operate.
10. Reconnect and confirm a fresh authorization works.

## Monitoring immediately after cutover

Monitor:

- HTTP 5xx rate;
- OAuth callback failures;
- JWT validation failures;
- MCP authorization failures by scope;
- latency and timeout rate;
- database migration/runtime errors;
- unexpected write/approval attempts;
- support/security reports.

## Rollback triggers

Rollback immediately if any of these occur:

- OAuth accepts invalid issuer/audience/signature;
- unauthenticated MCP requests succeed;
- staging bearer credentials work against production;
- data isolation between users/projects fails;
- approval scope or one-time grant enforcement fails;
- production error rate prevents core rendering flow;
- DNS/TLS instability makes the integration unreliable.

## Rollback procedure

1. Disable new OAuth authorization if security is implicated.
2. Restore previous production runtime deployment/RC.
3. Revert DNS only if routing is the failure source.
4. Preserve logs/evidence needed for incident analysis.
5. Revoke affected credentials/tokens when appropriate.
6. Re-run required certification gates before attempting cutover again.

## Completion criteria

Cutover is complete only when:

- public domain and MCP subdomain resolve reliably over HTTPS;
- production OAuth end-to-end test passes;
- legal/support URLs are live;
- exact RC SHA is recorded;
- all required workflow evidence corresponds to that SHA;
- rollback has been tested or demonstrated feasible;
- `publication_ready=true` is changed only after the remaining external submission gates are actually closed.
