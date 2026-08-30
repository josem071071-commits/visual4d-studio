# Visual 4D Studio — Production Publication Readiness

Status: Sprint 4.8 — formal submission/distribution readiness

## Objective
Move Visual 4D Studio from a certified staging MCP/Apps SDK integration to a publication-ready product without weakening the existing security boundary.

## Public product identity
- Official name: Visual 4D Studio
- Short name: Visual 4D
- Positioning: Del contenido a una pieza visual verificada.
- Category: visual design, structured content transformation, deterministic preview and verification.

## Current OpenAI distribution reality
OpenAI's Apps SDK submission flow is separate from the in-product custom-app creation/testing flow. The repository must therefore remain independently submission-ready even when the current ChatGPT account UI does not expose a custom-app creation surface.

Do not invent a ChatGPT redirect URI. The Clerk OAuth client's redirect URI remains unset until OpenAI/ChatGPT supplies the exact callback value in a supported registration or submission flow.

## Required public surfaces
Before external submission, publish stable HTTPS pages for:
- `/privacy` — Privacy Policy
- `/terms` — Terms of Service
- `/support` — support/contact and incident reporting
- `/security` — security disclosure and responsible reporting

Do not invent or publish placeholder domains as production URLs. The final domain must be owned and controlled by the project operator.

## Authentication architecture for real users
The current staging Bearer token remains staging-only and MUST NOT become a shared production credential.

Production target:
1. OAuth 2.1 / OpenID Connect compatible authorization.
2. Authorization Code flow with PKCE for interactive users.
3. Short-lived access tokens; refresh-token rotation when refresh tokens are used.
4. Per-user `sub` identity mapped to an internal Visual 4D principal.
5. Audience validation for the Visual 4D MCP/API.
6. Issuer, expiry, signature and nonce/state validation as applicable.
7. Least-privilege scopes.
8. Revocation/disconnection support.
9. Audit trail for security-relevant and mutating operations.

Configured Clerk development provider:
- Provider: Clerk
- Environment: Development only
- OIDC discovery: `https://open-boa-2840.clerk.accounts.dev/.well-known/openid-configuration`
- OAuth client: public client with Authorization Code + PKCE
- Consent screen: enabled
- Redirect URI: intentionally pending exact ChatGPT/OpenAI callback
- Initial ChatGPT-target scopes: `email`, `profile`, `offline_access` (Clerk-selected base scope), `visual4d:read`, `visual4d:render`
- Custom scopes advertised in Clerk: `visual4d:read`, `visual4d:render`, `visual4d:write`, `visual4d:approve`, `visual4d:identity`

The development Client Secret is not required by the intended public-PKCE integration and must never be committed or pasted into chat.

## ChatGPT action classification
- `generation.render_preview`: read-only / low external side-effect.
- Analysis and verification tools: read-only unless they persist state.
- Project mutations: write.
- Approval tools: high-significance write and explicit user intent required.
- Identity/master-asset changes: write and explicit authorization required.

The first external ChatGPT connection must remain read/render only. `visual4d:write`, `visual4d:approve` and `visual4d:identity` are deliberately excluded from the initial client authorization.

## Data minimization
- Collect only data needed to fulfill the user's requested Visual 4D operation.
- Do not use user assets for unrelated model training or secondary purposes without a separate lawful basis and clear disclosure.
- Preserve MASTER ASSETS; do not generatively reinterpret them when the workflow marks them immutable.
- Define retention windows before production launch.
- Provide deletion/disconnection procedures before publication.

## Publication package
Required artifacts:
- app name and short description
- long description and example prompts
- approved app icon and wordmark
- privacy URL
- terms URL
- support URL
- security contact/process
- MCP endpoint
- OAuth authorization/token/discovery configuration as required
- tool inventory with read/write classification
- resource/UI inventory
- screenshots or preview media
- version and changelog
- test evidence
- third-party notices and proprietary license notice

## Current verified technical endpoint
Staging MCP endpoint:
`https://honest-success-production-6b40.up.railway.app/mcp`

This is a staging endpoint and must not be represented as the final production domain.

## Automated publication gate
`npm run validate:publication` validates that the public package is internally consistent and fail-closed. GitHub Actions workflow `Visual 4D Publication Readiness` runs this validation automatically when publication/security metadata changes.

The validator intentionally permits incomplete legal/public URLs while `publication_ready=false`, but will reject `publication_ready=true` unless the production endpoint, legal URLs, operator/jurisdiction, production authentication and final branding are all complete.

## Gates to PUBLICATION READY
- [x] MCP HTTPS staging endpoint certified.
- [x] `generation.render_preview` certified remotely.
- [x] Apps SDK UI resource and structured content certified remotely.
- [x] Privacy Policy draft in repository.
- [x] Terms draft in repository.
- [x] Registration package draft in repository.
- [x] Production OAuth/OIDC provider selected.
- [x] Clerk Development OAuth client created as public + PKCE.
- [x] Five Visual 4D custom scopes created and advertised.
- [x] Initial ChatGPT client limited to read/render privileges.
- [x] Multi-user JWT/JWKS validation implemented.
- [x] Production MCP scope enforcement implemented.
- [x] RFC 9728 Protected Resource Metadata implemented.
- [x] Isolated production OAuth container build certified.
- [x] Automated publication-package consistency gate implemented.
- [ ] Exact ChatGPT/OpenAI OAuth redirect URI obtained through a supported registration/submission surface.
- [ ] Clerk redirect URI configured and OAuth authorization-code flow tested end-to-end.
- [ ] Production Clerk instance/provider promoted or recreated with production domain.
- [ ] Production domain selected and controlled.
- [ ] Public HTTPS privacy/terms/support/security pages deployed.
- [ ] Revocation/disconnection end-to-end tests pass against the selected production provider.
- [ ] Final app icon/wordmark approved.
- [ ] Legal/operator name, jurisdiction and contact details finalized.
- [ ] Submission metadata validated against the then-current OpenAI submission form/guidelines.

## Rule
Do not declare PUBLICATION READY while any unchecked gate above remains unresolved.
