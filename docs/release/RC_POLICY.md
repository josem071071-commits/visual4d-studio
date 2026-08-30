# Visual 4D Studio — Release Candidate Certification Policy

Sprint 4.10

A release candidate (RC) is one immutable Git commit SHA. Certification evidence from another SHA is not valid for that RC.

## Required gates

Before an RC may be promoted for external submission, the exact candidate SHA must have successful evidence for:

1. Core certification — Node 22, PostgreSQL 16, build, typecheck, runtime/domain suites, migrations and MCP integration.
2. Production authentication readiness — OIDC/JWT/RFC9728, scope enforcement and production preflight.
3. External HTTPS/MCP certification — public HTTPS boundary and authenticated remote MCP.
4. Publication readiness — public metadata/legal package and tool-review consistency.

## Fail-closed rules

- Never infer RC status from the latest branch state alone.
- Never combine successful workflow runs from different commit SHAs.
- A new commit invalidates the previous candidate and requires certification of the new SHA.
- Staging success is evidence, not production publication authorization.
- `publication_ready` remains false until all owner/external gates are closed.
- OAuth callback values must come from the actual target platform; placeholders are prohibited.

## Candidate record

For each candidate, record:

- full 40-character Git SHA;
- UTC creation timestamp;
- workflow run IDs and conclusions for all required gates;
- production endpoint candidate;
- OAuth provider/environment and callback status;
- public legal/support URLs;
- branding approval status;
- reviewer/tool-analysis reconciliation status.

## Promotion decision

An RC may be called **engineering-certified** when all engineering gates above pass on the exact SHA.

It may be called **submission-ready** only when, in addition, all external publication gates are complete: production domain/endpoint, production OAuth including exact callback, stable HTTPS legal/support pages, approved public identity assets, legal operator/jurisdiction, final demo/reviewer evidence, and the target platform's submission surface is available.
