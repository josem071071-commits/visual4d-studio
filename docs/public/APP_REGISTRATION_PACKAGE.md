# Visual 4D Studio — App Registration & Publication Package

**Package version:** 1.1  
**Prepared:** 30 August 2026  
**Target:** ChatGPT Apps SDK / MCP / ChatGPT app directory submission

## 1. Public identity

### Canonical product name
**Visual 4D Studio**

### Short name
**Visual 4D**

### Tagline
**Del contenido a una pieza visual verificada.**

### Short description
Visual 4D Studio convierte contenido, recursos e identidad visual en piezas gráficas estructuradas, renderizadas y verificadas mediante un flujo de trabajo con aprobaciones explícitas.

### Directory description
Visual 4D Studio es una plataforma de diseño visual asistido que guía el proceso desde el análisis del contenido hasta una pieza gráfica verificable. Organiza información, define estructura editorial, resuelve recursos, aplica dirección de arte, genera vistas previas deterministas y mantiene controles de aprobación y trazabilidad. Está diseñada para preservar recursos maestros y separar claramente el contenido aportado por el usuario de los recursos generados por IA.

### Primary category
Design / Productivity

### Secondary categories
Creative tools; Content production; Visual communication

### Intended audience
Profesionales, equipos de comunicación, organizaciones, educadores, creadores y usuarios que necesiten convertir información en piezas visuales con un proceso estructurado y verificable.

## 2. Iconography specification

### Brand concept
Una marca geométrica basada en **4D**: cuatro planos o módulos convergen en un marco visual central. Debe transmitir estructura, diseño, verificación y transformación, no una apariencia genérica de “IA”.

### Master icon
- Square 1:1.
- Recognizable at 32 px.
- Symbol-first; avoid small text inside the icon.
- Recommended construction: stylized numeral 4 integrated with a framing/viewport motif and a subtle fourth-plane/depth cue.
- Clean premium editorial geometry.
- No OpenAI or ChatGPT marks.
- No imitation of third-party trademarks.

### Required exports before submission
- 1024×1024 PNG master.
- 512×512 PNG.
- 256×256 PNG.
- 128×128 PNG.
- 64×64 PNG.
- SVG master where the publication surface accepts it.
- Light-background and dark-background verification.

### Wordmark
**Visual 4D Studio** — clean sans-serif, strong “Visual 4D”, secondary “Studio”.

## 3. Public metadata

```yaml
name: Visual 4D Studio
short_name: Visual 4D
tagline: Del contenido a una pieza visual verificada.
language_primary: es
languages_planned:
  - es
  - en
categories:
  - Design
  - Productivity
mcp_transport: Streamable HTTP
staging_mcp_endpoint: https://honest-success-production-6b40.up.railway.app/mcp
production_mcp_endpoint: REQUIRED_BEFORE_PUBLIC_SUBMISSION
privacy_policy: PUBLIC_HTTPS_URL_REQUIRED
terms_of_service: PUBLIC_HTTPS_URL_REQUIRED
support_url: PUBLIC_HTTPS_URL_REQUIRED
support_email: REQUIRED_BEFORE_PUBLIC_SUBMISSION
developer: Visual 4D Studio
```

## 4. Capability statement

### Current core capability
`generation.render_preview` produces a deterministic, read-only Visual 4D preview from validated layout intent, content, identity tokens and optional approved raster assets.

### UI capability
The tool exposes a ChatGPT Apps SDK/MCP Apps UI resource for an inline Visual 4D preview.

### Broader workflow capabilities
The MCP service also contains workflow tools for analysis, structure, resources, art direction, design versions, verification, explicit approvals and identity activation. Write-capable tools must remain clearly classified and protected by authorization and explicit approval where applicable.

### Initial ChatGPT authorization surface
The first external ChatGPT connection is deliberately constrained to read/render behavior. It must not receive `visual4d:write`, `visual4d:approve` or `visual4d:identity` until those actions have their own product and safety review.

## 5. Authentication architecture for real users

### Decision
**Do not use the current shared/static staging Bearer token as public-user authentication.** It is suitable only for controlled staging certification.

### Production target
Use **per-user OAuth 2.1 / OpenID Connect-compatible authorization** with Authorization Code + PKCE, short-lived access tokens and refresh-token rotation where supported.

### Clerk development configuration completed
- Provider: Clerk.
- Environment: Development only.
- Discovery URL: `https://open-boa-2840.clerk.accounts.dev/.well-known/openid-configuration`.
- Client type: Public OAuth client.
- Authorization flow: Authorization Code + PKCE.
- Consent screen: enabled.
- Base scopes currently selected by Clerk/client: `email`, `profile`, `offline_access`.
- Visual 4D client scopes: `visual4d:read`, `visual4d:render`.
- Custom advertised scopes created: `visual4d:read`, `visual4d:render`, `visual4d:write`, `visual4d:approve`, `visual4d:identity`.
- Redirect URI: intentionally unset until ChatGPT/OpenAI supplies the exact callback through a supported registration/submission surface.

Do not use the Clerk Client Secret for the intended public-PKCE connection. Never commit or paste it into chat.

### Required security properties
1. Every external user receives an individual identity; never share one production bearer credential among users.
2. Bind authenticated subject → Visual 4D actor/user → project ownership and permissions.
3. Use HTTPS only.
4. Validate issuer, audience, expiry, signature and scopes on every protected request.
5. Apply least-privilege scopes.
6. Preserve explicit approval semantics for consequential mutations.
7. Maintain rate limiting, request-size limits and timeout controls.
8. Revoke sessions/tokens on account disablement or suspected compromise.
9. Record security-relevant events without logging unnecessary user content or raw credentials.
10. Publish RFC 9728 Protected Resource Metadata for the protected MCP resource.

## 6. Data and safety declaration

- Process only data required for the requested Visual 4D function.
- Preserve owner/project boundaries.
- Do not generatively alter protected master assets.
- Do not present AI-generated imagery as documentary evidence.
- Keep read-only preview operations distinct from persistent mutations.
- Require explicit approval for gated workflow stages.
- Do not expose secrets, internal database credentials or infrastructure tokens to the model or UI.
- Maintain an all-audiences product surface and comply with applicable platform usage policies.

## 7. Public legal documents

Repository drafts:
- `docs/public/PRIVACY_POLICY.md`
- `docs/public/TERMS_OF_SERVICE.md`
- `docs/public/SECURITY.md`

Before public submission these documents must be served through stable public HTTPS URLs and receive legal review appropriate to the chosen operating jurisdiction.

## 8. OpenAI submission readiness

The ChatGPT app-directory submission flow is treated as separate from in-product custom-app testing. A limitation in the current account UI must not be represented as a defect in the Visual 4D MCP implementation.

Before submission:
- verify the then-current OpenAI developer/safety/privacy/functionality guidelines;
- provide a stable production MCP endpoint;
- provide public legal/support URLs;
- ensure tool annotations accurately describe read/write behavior;
- provide final icon and screenshots/demo media;
- verify OAuth callback and disconnect/revocation behavior;
- test the actual production integration rather than staging.

## 9. Submission assets checklist

- [x] Canonical name defined.
- [x] Short description defined.
- [x] Directory description defined.
- [x] Tagline defined.
- [x] Categories and audience defined.
- [x] Iconography specification defined.
- [x] Privacy policy draft created.
- [x] Terms draft created.
- [x] Security disclosure draft created.
- [x] Public metadata manifest created.
- [x] Production authentication architecture implemented.
- [x] Certified remote staging MCP exists.
- [x] Apps SDK inline preview resource exists.
- [x] Clerk Development OAuth provider/client configured.
- [x] Read/render least-privilege client scopes configured.
- [x] Production JWT/JWKS validation and scope enforcement implemented.
- [x] RFC 9728 Protected Resource Metadata implemented.
- [x] Automated publication package validation added to CI.
- [ ] Exact ChatGPT/OpenAI redirect URI obtained and configured.
- [ ] OAuth authorization-code + PKCE flow certified end-to-end.
- [ ] Final icon artwork exported and approved.
- [ ] Stable public website/domain selected.
- [ ] Privacy policy published at public HTTPS URL.
- [ ] Terms published at public HTTPS URL.
- [ ] Support and security URLs published.
- [ ] Support/privacy email selected.
- [ ] Operating entity/jurisdiction confirmed.
- [ ] Production Clerk/OIDC instance and production endpoint externally certified.
- [ ] Revocation/disconnection tests completed.
- [ ] Submission screenshots/demo media captured from final production integration.
- [ ] Final OpenAI submission guidelines rechecked immediately before submission.

## 10. ChatGPT custom-app registration values

When a supported “Create app” or app-submission surface provides the connection fields, use:

**Name:** Visual 4D Studio  
**MCP endpoint:** production HTTPS `/mcp` endpoint, not staging/local  
**Authentication:** OAuth/OIDC Authorization Code + PKCE  
**OAuth scopes initially requested:** `visual4d:read`, `visual4d:render` plus provider-required identity/base scopes  
**Logo:** final approved Visual 4D 1:1 icon  
**Description:** use the short description above

Use the exact redirect/callback URI supplied by OpenAI/ChatGPT. Do not guess it.

Then run the platform's tool analysis and confirm that `generation.render_preview` is classified read-only and every future mutation tool is represented accurately before publishing.

## 11. Automated distribution gate

`npm run validate:publication` validates the manifest and required package files. The GitHub workflow `Visual 4D Publication Readiness` runs this check automatically.

The package intentionally remains `publication_ready=false` until all external production/legal/branding gates are complete.

## 12. Current next milestone

**Sprint 4.8 — Submission Surface Readiness**

Remaining external dependencies:
1. exact OpenAI/ChatGPT redirect URI through a supported registration/submission flow;
2. production domain and production Clerk instance;
3. public privacy/terms/support/security URLs;
4. final approved brand assets;
5. legal operator/jurisdiction/contact details;
6. end-to-end production OAuth and disconnect certification.
