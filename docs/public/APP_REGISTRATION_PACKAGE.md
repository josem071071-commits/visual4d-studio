# Visual 4D Studio — App Registration & Publication Package

**Package version:** 1.0  
**Prepared:** 29 August 2026  
**Target:** ChatGPT Apps SDK / MCP / future Plugin Directory distribution

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
mcp_endpoint: CURRENT_CERTIFIED_RAILWAY_MCP_ENDPOINT
health_endpoint: CURRENT_CERTIFIED_RAILWAY_HEALTH_ENDPOINT
privacy_policy: PUBLIC_HTTPS_URL_REQUIRED
terms_of_service: PUBLIC_HTTPS_URL_REQUIRED
support_url: PUBLIC_HTTPS_URL_REQUIRED
support_email: REQUIRED_BEFORE_PUBLIC_SUBMISSION
developer: José Guerrero / Visual 4D Studio
```

## 4. Capability statement

### Current core capability
`generation.render_preview` produces a deterministic, read-only Visual 4D preview from validated layout intent, content, identity tokens and optional approved raster assets.

### UI capability
The tool exposes a ChatGPT Apps SDK/MCP Apps UI resource for an inline Visual 4D preview.

### Broader workflow capabilities
The MCP service also contains workflow tools for analysis, structure, resources, art direction, design versions, verification, explicit approvals and identity activation. Write-capable tools must remain clearly classified and protected by authorization and explicit approval where applicable.

## 5. Authentication architecture for real users

### Decision
**Do not use the current shared/static staging Bearer token as public-user authentication.** It is suitable only for controlled staging certification.

### Production target
Use **per-user OAuth 2.1 / OpenID Connect-compatible authorization** with Authorization Code + PKCE, short-lived access tokens and refresh-token rotation where supported.

### Required security properties
1. Every external user receives an individual identity; never share one production bearer credential among users.
2. Bind authenticated subject → Visual 4D actor/user → project ownership and permissions.
3. Use HTTPS only.
4. Short-lived access tokens; secrets never embedded in app metadata or source-controlled public files.
5. Validate issuer, audience, expiry and scopes on every protected request.
6. Apply least-privilege scopes, separating read and write capabilities where practical.
7. Preserve explicit approval semantics for consequential mutations.
8. Maintain rate limiting, request-size limits and timeout controls.
9. Revoke sessions/tokens on account disablement or suspected compromise.
10. Record security-relevant events without logging unnecessary user content or raw credentials.

### Suggested scopes
- `visual4d:read` — read project/status/output.
- `visual4d:render` — request non-persistent previews.
- `visual4d:write` — create/change project artifacts.
- `visual4d:approve` — explicit approval operations.
- `visual4d:identity` — manage institutional identity where authorized.

### Rollout sequence
**Stage A:** current authenticated staging remains isolated.  
**Stage B:** introduce production identity provider and OAuth validation beside staging auth.  
**Stage C:** certify multi-user isolation and scope enforcement.  
**Stage D:** disable static bearer authentication on the public production endpoint.  
**Stage E:** submit the OAuth-backed endpoint for distribution.

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

Before public submission these documents must be served through stable public HTTPS URLs and receive legal review appropriate to the chosen operating jurisdiction.

## 8. Submission assets checklist

- [x] Canonical name defined.
- [x] Short description defined.
- [x] Directory description defined.
- [x] Tagline defined.
- [x] Categories and audience defined.
- [x] Iconography specification defined.
- [x] Privacy policy draft created.
- [x] Terms draft created.
- [x] Public metadata template created.
- [x] Production authentication architecture defined.
- [x] Safety/data declaration defined.
- [x] Certified remote MCP exists.
- [x] Apps SDK inline preview resource exists.
- [ ] Final icon artwork exported.
- [ ] Stable public website/domain selected.
- [ ] Privacy policy published at public HTTPS URL.
- [ ] Terms published at public HTTPS URL.
- [ ] Support URL published.
- [ ] Support/privacy email selected.
- [ ] Operating entity/jurisdiction confirmed.
- [ ] Production OAuth/OIDC implemented and externally certified.
- [ ] Multi-user authorization/isolation penetration tests completed.
- [ ] Submission screenshots/demo media captured from the final production integration.
- [ ] Final developer/submission guidelines rechecked immediately before submission.

## 9. ChatGPT custom-app registration values

When the “Create app” surface is available, use:

**Name:** Visual 4D Studio  
**MCP endpoint:** production HTTPS `/mcp` endpoint (not a local URL)  
**Authentication:** OAuth for public/multi-user distribution  
**Logo:** final approved Visual 4D 1:1 icon  
**Description:** use the short description above  

Then run the platform’s tool analysis. Confirm that `generation.render_preview` is classified read-only and that every write/mutation tool is represented accurately before creating or publishing the app.

## 10. Distribution readiness gate

Visual 4D Studio is **registration-package ready** when all unchecked items in section 8 that are mandatory for the chosen distribution path are closed. It is **not public-production-auth ready** until OAuth/OIDC and multi-user authorization replace the shared staging credential on the production endpoint.

## 11. Recommended next engineering sprint

**Sprint 4.4 — Production Identity & Publication Surface**

Deliverables:
1. production OAuth/OIDC provider integration;
2. actor mapping and scopes;
3. multi-user isolation tests;
4. stable public `/privacy`, `/terms`, `/support` pages;
5. final icon/wordmark assets;
6. production endpoint certification;
7. final submission manifest and screenshots.