# Visual 4D Studio — Current Status

**Status date:** 2026-09-04  
**Release metadata:** v1.0.0  
**Overall classification:** production-candidate operational; external publication not complete.

This document is the canonical human-readable status summary. It distinguishes repository implementation, live deployment, certification evidence, and remaining decisions.

## Status matrix

| Capability | Implemented | Deployed | Certified | Remaining qualification |
| --- | :---: | :---: | :---: | --- |
| Public Cloudflare site | Yes | Yes | Yes | Marketplace publication is separate. |
| Public policy/support routes | Yes | Yes | Yes | None recorded for route availability. |
| Railway MCP endpoint | Yes | Yes | Yes | Continue external liveness/readiness checks after changes. |
| PostgreSQL bootstrap, migrations 0001–0006, 17-table contract | Yes | Yes | Yes | Provider backup policy is an account-level control. |
| 11-tool MCP catalog | Yes | Yes | Yes | Catalog changes require intentional recertification. |
| `projects.create` persistence and idempotency | Yes | Yes | Yes | Certification applies to the tested contract and evidence chain. |
| Full gated workflow | Yes | Yes | Yes | User approvals and exact-version rules remain mandatory. |
| OAuth/ChatGPT integration path | Yes | Yes | Yes | Manifest still labels the Clerk environment `development`; production-tenant promotion is not independently established by that metadata. |
| Branding package | Partial | N/A | No | Icon proposal and wordmark require approval. |
| Public/marketplace publication | Partial | No | No | External registration requirements and explicit publication approval remain open. |

## What “certified” means here

A certified item has a repository certification gate or recorded real end-to-end check for a defined contract. It does not promise indefinite availability, certify untested external-provider account settings, or automatically satisfy marketplace publication requirements.

The protected recorded chain is:

`WEB → CLOUDFLARE → RAILWAY → POSTGRESQL → OAUTH → MCP → tools/list(11) → projects.create → complete workflow → CHATGPT`

## Evidence recorded in the September 1 history

- release-candidate hardening and complete 11-tool workflow certification;
- migration `0006` round-trip certification;
- production schema contract and database readiness;
- live MCP liveness/readiness verification;
- structured production logs with token non-disclosure checks;
- logical PostgreSQL backup/restore certification;
- immutable release-candidate validation;
- production multi-user isolation gate;
- package promotion to v1.0.0;
- public manifest and production runbook alignment.

The repository also contains September 2 approval-UI bridge work. Those changes do not erase the September 1 baseline; any claim about the bridge should follow its own blocking certification evidence.

## Deployed and operational

The repository records these production addresses:

- `https://www.visual4dstudio.com`
- `https://www.visual4dstudio.com/privacy`
- `https://www.visual4dstudio.com/terms`
- `https://www.visual4dstudio.com/support`
- `https://www.visual4dstudio.com/security`
- `https://mcp.visual4dstudio.com/mcp`
- `https://mcp.visual4dstudio.com/healthz`
- `https://mcp.visual4dstudio.com/readyz`

A deployed address is not, by itself, evidence of every functional or publication claim. The associated certification gates define the verified scope.

## Open gates

1. Approve final branding assets.
2. Reconcile the manifest's Clerk `development` environment designation with the authentication configuration actually deployed.
3. Complete remaining external registration or marketplace requirements.
4. Set `publication_ready=true` only after those publication gates close.
5. Review provider-managed backup retention and disaster-recovery settings separately from the certified logical restore procedure.

## Source-of-truth order

When documentation disagrees, reconcile it in this order:

1. immutable certification evidence for the exact tested SHA;
2. deployment and external verification records;
3. `docs/public/app-manifest.public.json`;
4. this status summary;
5. README overview;
6. historical sprint documents.

Historical sprint files describe the state at that time and must not override newer certification or deployment evidence.
