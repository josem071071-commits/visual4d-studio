# Visual 4D Studio — Clerk OAuth setup

Status: **development provider configured; production promotion pending**. This document contains no secrets.

## Decision

Clerk is the preferred first production authorization-server candidate for Visual 4D because its OAuth/MCP implementation supports JWT access tokens, JWKS, PKCE S256, custom OAuth scopes and OAuth protected-resource metadata workflows.

Visual 4D remains provider-neutral in code. Switching providers must not require changing tool authorization logic.

## Completed in Clerk Development

Application: **Visual 4D Studio**  
Environment: **Development**

Custom scopes created and advertised:
- `visual4d:read`
- `visual4d:render`
- `visual4d:write`
- `visual4d:approve`
- `visual4d:identity`

OAuth client: **Visual 4D — ChatGPT**
- Public client: enabled.
- Authorization Code + PKCE: enabled by public-client mode.
- Consent screen: enabled.
- Selected scopes: `email`, `profile`, `offline_access`, `visual4d:read`, `visual4d:render`.
- Write/approval/identity scopes deliberately excluded from the first ChatGPT-target client.
- Redirect URI: pending exact callback supplied by a supported ChatGPT/OpenAI registration or submission surface.

Development discovery URL:
`https://open-boa-2840.clerk.accounts.dev/.well-known/openid-configuration`

The OAuth Client Secret exists in Clerk but is not required for the intended public-PKCE integration. It must never be committed, pasted into chat, or used as a substitute for PKCE.

## Least privilege rule

The first ChatGPT connection is read/render only. Do not add these scopes until separately reviewed and certified:
- `visual4d:write`
- `visual4d:approve`
- `visual4d:identity`

## Visual 4D production environment mapping

After the production Clerk instance and production domain exist, map the production provider into the production service:

```text
VISUAL4D_OIDC_ISSUER=<production Clerk authorization-server issuer>
VISUAL4D_OIDC_AUDIENCE=<aud value expected in Clerk OAuth access tokens>
VISUAL4D_MCP_RESOURCE_URI=https://<production-host>/mcp
```

Normally leave `VISUAL4D_OIDC_JWKS_URI` unset. Visual 4D discovers `jwks_uri` from the issuer and validates the issuer match before accepting it.

Do not use the current `.accounts.dev` issuer as the final production identity endpoint.

## Required public MCP metadata

The production server publishes RFC 9728 Protected Resource Metadata at both the root well-known route and the path-scoped route corresponding to `/mcp`. Unauthorized MCP requests include a `WWW-Authenticate` Bearer challenge pointing at the path-scoped metadata URL.

## Safety constraints

Production MUST NOT contain `VISUAL4D_AUTH_TOKEN`. That variable belongs only to staging. Production MUST keep `VISUAL4D_ALLOW_DEV_APPROVAL_GRANTS=false`. The production container runs `scripts/production-auth-preflight.mjs` and exits before startup if these constraints are violated.

## Redirect URI rule

Do not invent a ChatGPT callback URL. Clerk requires an exact URI match. Keep Redirect URIs empty in Development until OpenAI/ChatGPT exposes the exact callback through a supported app-registration or submission flow.

Once supplied:
1. add the exact URI to Clerk Development;
2. run Authorization Code + PKCE end-to-end certification;
3. test identity isolation and scopes;
4. test disconnect/revocation;
5. only then reproduce/promote the configuration in the production Clerk instance.

## Remaining owner/external actions

Repository preparation can continue autonomously. External ownership is required later for:
- production domain;
- production Clerk instance/promotion;
- exact ChatGPT/OpenAI redirect URI;
- final legal/support contact information;
- final production app submission.
