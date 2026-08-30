# Sprint 4.5 — Production Authentication Foundation

Status: architecture foundation; not yet production enabled.

## Security baseline
Visual 4D production authentication MUST follow OAuth/OIDC resource-server practices and MUST remain isolated from the staging static Bearer mechanism.

### Required token validation
Every production access token must be validated for:
- cryptographic signature using trusted issuer keys/JWKS;
- exact trusted `iss`;
- expected `aud` for the Visual 4D MCP resource server;
- `exp` and, when present, `nbf`;
- stable non-empty subject (`sub`);
- authorized scopes for the requested operation.

Tokens with missing or invalid claims fail closed. User identity is derived from validated claims, never from request parameters.

## Scopes
- `visual4d:read`
- `visual4d:render`
- `visual4d:write`
- `visual4d:approve`
- `visual4d:identity`

Least privilege is mandatory. Rendering must not implicitly grant write or approval permissions.

## OAuth client requirements
- Authorization Code flow.
- PKCE S256.
- exact redirect URI matching.
- no Implicit grant.
- no Resource Owner Password Credentials grant.
- short-lived access tokens.
- refresh-token rotation or sender constraint when refresh tokens are used.
- TLS end to end.

## Multi-user isolation
`sub` maps to the authenticated Visual 4D actor. Repository/project authorization remains responsible for ensuring an actor cannot access another actor's projects. No user-provided `userId` may override the token subject.

## Staging separation
`VISUAL4D_LOCAL_AUTH_TOKEN` remains a staging/development compatibility mechanism only. Production OAuth support must be enabled explicitly and must not silently fall back to static Bearer authentication.

## Implementation sequence
1. Add provider-neutral production token-verifier interface.
2. Add JWT/JWKS implementation after issuer/audience are configured.
3. Add scope-to-tool authorization matrix.
4. Add negative tests: bad signature, issuer, audience, expiry, subject, scope.
5. Add two-user isolation integration test.
6. Add discovery/metadata endpoints required by the selected production identity provider.
7. External certification before enabling production mode.

## Standards baseline
Security design follows OAuth Security Best Current Practice (RFC 9700), including PKCE, least privilege, audience restriction and avoidance of deprecated flows.
