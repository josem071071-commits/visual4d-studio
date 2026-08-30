# Visual 4D Studio — Submission Evidence Index

Status: Sprint 4.9

Purpose: provide one review entry point for engineering, security and future platform submission.

## Product and legal package

- `APP_REGISTRATION_PACKAGE.md` — canonical product metadata, positioning, auth architecture and asset checklist.
- `app-manifest.public.json` — machine-readable publication state; intentionally `publication_ready: false` until all external gates close.
- `PRIVACY_POLICY.md` — privacy draft; must be deployed to stable HTTPS before submission.
- `TERMS_OF_SERVICE.md` — terms draft; must be deployed to stable HTTPS before submission.
- `SECURITY.md` — public security/reporting draft.
- `PUBLICATION_READINESS.md` — authoritative publication gates.
- `SUBMISSION_CHECKLIST.md` — final human submission checklist.
- `TOOL_REVIEW_MATRIX.md` — tool side-effect, scope and approval classification.

## Authentication evidence

- `docs/security/CLERK_OAUTH_PRODUCTION_SETUP.md` — provider configuration contract and secret-handling rules.
- `services/mcp-server/src/production-auth.ts` — production actor/scope contract.
- `services/mcp-server/src/production-jwt.ts` — JWT verification.
- `services/mcp-server/src/oidc-discovery.ts` — issuer/JWKS discovery.
- `services/mcp-server/src/protected-resource-metadata.ts` — RFC 9728 metadata.
- `services/mcp-server/src/tool-scope-policy.ts` — deny-by-default per-tool scope policy.
- `.github/workflows/production-auth-readiness.yml` — repeatable production-auth CI gate.

## MCP / Apps SDK evidence

- `services/mcp-server/src/render-tool.ts` — deterministic preview tool.
- `services/mcp-server/src/apps-ui.ts` — Apps SDK/MCP UI resource.
- `services/mcp-server/src/production-server.ts` — protected production transport.
- `.github/workflows/external-staging-certification.yml` — public HTTPS and authenticated remote MCP certification.
- `.github/workflows/publication-readiness.yml` — publication package validation.

## Core integrity evidence

- `.github/workflows/core-certification.yml` — Node 22 + PostgreSQL 16 certification, typecheck, runtime/domain suites, MCP integration and migration checks.
- `docs/PROVENANCE.md` — project provenance record.

## Current certified state

At preparation time, the publication-package workflow, production-auth readiness workflow and external staging certification have passed on the current development line. Core certification has repeatedly passed its functional stages. The final production publication decision remains blocked by external/owner gates documented in `PUBLICATION_READINESS.md`.

## Evidence freshness rule

Before an actual OpenAI submission:

1. run all certification workflows on the exact candidate commit;
2. record the candidate commit SHA and successful workflow run IDs;
3. capture final production screenshots/demo media;
4. validate the live OAuth flow using the exact callback supplied/required by the target platform;
5. confirm public legal/support URLs and production MCP endpoint;
6. compare live platform tool analysis against `TOOL_REVIEW_MATRIX.md`;
7. only then change `publication_ready` to `true`.