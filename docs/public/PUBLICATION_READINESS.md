# Visual 4D Studio — Production Publication Readiness

Status: Sprint 4.4

## Objective
Move Visual 4D Studio from a certified staging MCP/Apps SDK integration to a publication-ready product without weakening the existing security boundary.

## Public product identity
- Official name: Visual 4D Studio
- Short name: Visual 4D
- Positioning: Del contenido a una pieza visual verificada.
- Category: visual design, structured content transformation, deterministic preview and verification.

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

Proposed scopes:
- `visual4d:read` — inspect projects/status/resources.
- `visual4d:render` — generate deterministic previews.
- `visual4d:write` — create or modify project state.
- `visual4d:approve` — explicit gated approvals; never implied by generic write access.
- `visual4d:identity` — manage organization/project identity assets where authorized.

## ChatGPT action classification
- `generation.render_preview`: read-only / low external side-effect.
- Analysis and verification tools: read-only unless they persist state.
- Project mutations: write.
- Approval tools: high-significance write and explicit user intent required.
- Identity/master-asset changes: write and explicit authorization required.

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

## Gates to PUBLICATION READY
- [x] MCP HTTPS staging endpoint certified.
- [x] `generation.render_preview` certified remotely.
- [x] Apps SDK UI resource and structured content certified remotely.
- [x] Privacy Policy draft in repository.
- [x] Terms draft in repository.
- [x] Registration package draft in repository.
- [ ] Production domain selected and controlled.
- [ ] Public HTTPS privacy/terms/support/security pages deployed.
- [ ] Production OAuth/OIDC provider selected/configured.
- [ ] Multi-user token validation implemented.
- [ ] Tenant/user isolation tests pass.
- [ ] Revocation/disconnection tests pass.
- [ ] Final app icon/wordmark approved.
- [ ] Legal/operator name, jurisdiction and contact details finalized.
- [ ] Submission metadata validated against the then-current OpenAI submission form/guidelines.

## Rule
Do not declare PUBLICATION READY while any unchecked gate above remains unresolved.
