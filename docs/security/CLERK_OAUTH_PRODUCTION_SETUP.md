# Visual 4D Studio — Clerk OAuth production setup

Status: **external configuration pending**. This document contains no credentials.

## Decision

Clerk is the preferred first production authorization-server candidate for Visual 4D because its current OAuth/MCP implementation supports JWT access tokens, JWKS, PKCE S256, custom OAuth scopes, OAuth protected-resource metadata workflows, Client ID Metadata Documents (CIMD), and Dynamic Client Registration (DCR) fallback.

Visual 4D remains provider-neutral in code. Switching providers must not require changing tool authorization logic.

## Visual 4D production scopes

Create and advertise only the scopes required by the application:

- `visual4d:read`
- `visual4d:render`
- `visual4d:write`
- `visual4d:approve`
- `visual4d:identity`

Prefer least privilege. A client that only previews designs should receive `visual4d:render`, not write or approval scopes.

## Required Clerk properties

1. Use the current Clerk OAuth implementation, not a legacy OAuth application.
2. Keep OAuth consent enabled.
3. Use Authorization Code with PKCE S256 for public clients.
4. Issue JWT access tokens so Visual 4D can validate them locally through JWKS.
5. Configure the custom Visual 4D scopes above.
6. Prefer CIMD when enabled for the account. Do not enable anonymous DCR unless a target MCP client actually requires it.
7. Record the Clerk issuer/discovery URL only after the production instance exists.

## Visual 4D environment mapping

After Clerk is configured, map its values into the production service:

```text
VISUAL4D_OIDC_ISSUER=<Clerk authorization-server issuer>
VISUAL4D_OIDC_AUDIENCE=<aud value expected in Clerk OAuth access tokens>
VISUAL4D_MCP_RESOURCE_URI=https://<production-host>/mcp
```

Normally leave `VISUAL4D_OIDC_JWKS_URI` unset. Visual 4D discovers `jwks_uri` from the issuer and validates the issuer match before accepting it.

## Required public MCP metadata

The production server publishes RFC 9728 Protected Resource Metadata at both the root well-known route and the path-scoped route corresponding to `/mcp`. Unauthorized MCP requests include a `WWW-Authenticate` Bearer challenge pointing at the path-scoped metadata URL.

## Safety constraints

Production MUST NOT contain `VISUAL4D_AUTH_TOKEN`. That variable belongs only to staging. Production MUST keep `VISUAL4D_ALLOW_DEV_APPROVAL_GRANTS=false`. The production container runs `scripts/production-auth-preflight.mjs` and exits before startup if these constraints are violated.

## External owner action required later

The repository can be prepared and certified without a Clerk account. The first owner-only action is creating the Clerk production application/instance and enabling the required OAuth/MCP features. No secret should ever be pasted into chat, committed to GitHub, or stored in `.env.production.example`.
