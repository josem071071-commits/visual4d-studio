# Visual 4D Studio v1.0.0

Visual 4D Studio is a production-candidate visual workflow system exposed through MCP and an Apps SDK interface. The repository is no longer accurately described as the local-only v0.2.2 prototype.

Its gated workflow is:

`ANALYZE → USER APPROVAL → STRUCTURE → USER APPROVAL → RESOURCES → USER APPROVAL → ART DIRECTION → USER APPROVAL → DESIGN VERSION → VERIFY EXACT DESIGN → USER APPROVAL → FINAL`

## Current verified state

The repository records the following as implemented, deployed, or certified:

| Area | State | Meaning |
| --- | --- | --- |
| Package release | **v1.0.0** | Package metadata was promoted on September 1, 2026. |
| Public website | **Deployed and route-certified** | The Cloudflare site and the public legal, support, and security routes passed the recorded live-site checks. |
| Production MCP | **Deployed and operational** | Railway serves the MCP endpoint, liveness endpoint, and database-aware readiness endpoint. |
| PostgreSQL schema | **Bootstrapped and certified** | Migrations `0001`–`0006`, the 17-table contract, migration round trip, and logical backup/restore are covered by certification gates. |
| MCP catalog | **11 tools certified** | The complete catalog is exercised by the recorded real PostgreSQL/MCP workflow certification. |
| `projects.create` | **End-to-end certified** | Project creation is included in the protected production chain, including persistence and idempotent replay. |
| OAuth/ChatGPT path | **Operationally certified** | The repository records working OAuth/ChatGPT integration and production endpoint discovery. See the qualification below. |
| Publication | **Pending** | Technical operation does not imply marketplace/publication approval; `publication_ready` remains `false`. |

The canonical evidence and status qualifications are maintained in [Current Status](docs/release/CURRENT_STATUS.md). Operational deployment and rollback details remain in [Production Operations, Cutover and Rollback Runbook](docs/release/PRODUCTION_CUTOVER_RUNBOOK.md).

## Production topology

- Public site: `https://www.visual4dstudio.com`
- Production MCP: `https://mcp.visual4dstudio.com/mcp`
- Liveness: `https://mcp.visual4dstudio.com/healthz`
- Readiness: `https://mcp.visual4dstudio.com/readyz`
- Staging MCP: retained separately for testing

## Certified MCP tools

1. `projects.create`
2. `method.analyze`
3. `method.structure`
4. `method.resolve_resources`
5. `method.art_direct`
6. `generation.render_preview`
7. `generation.create_design`
8. `verification.save`
9. `approvals.approve_stage`
10. `versions.mark_final`
11. `identity.activate_version`

## Security and workflow invariants

- private owner/institution boundary;
- scoped permissions for read, render, write, approval, and identity operations;
- MASTER ASSETS cannot be generatively edited;
- generated imagery cannot be documentary evidence;
- every gated stage uses an exact approved artifact version;
- explicit approvals require a one-time user-action grant at the MCP boundary;
- FINAL cannot auto-approve verification;
- verification and final-design foreign keys are scoped to the same project;
- idempotency and optimistic project revisions are persisted;
- production logs exclude Bearer tokens and full tool payloads;
- multi-user isolation and negative workflow paths are certification gates.

## Important qualifications

“Deployed,” “operational,” “certified,” and “publication-ready” are not synonyms:

- **Deployed** means the recorded service or site is running at its production address.
- **Operational** means the recorded health/readiness or integration checks succeeded.
- **Certified** means an automated or real end-to-end gate exercised a defined contract.
- **Publication-ready** requires separate branding and external registration/marketplace gates.

The public manifest currently records the Clerk provider `environment` as `development` while also recording the OAuth/ChatGPT path as operational and `production_ready: true`. Until that field and the deployed provider configuration are reconciled, the documentation claims operational certification of the OAuth path, not independently verified promotion to a Clerk production tenant.

## Still pending

- approval of the final icon and wordmark;
- completion of remaining external registration or marketplace requirements;
- an explicit decision to set `publication_ready=true`;
- reconciliation of the Clerk environment designation with the deployed authentication configuration;
- provider-managed backup retention and disaster-recovery policy review.

## Development and certification

Requires Node.js 22 and npm 10.9.2.

```bash
npm install
npm test
npm run test:certification
```

PostgreSQL-backed certification requires the database environment expected by the integration scripts. CI uses no-skip wrappers for mandatory PostgreSQL, migration, and all-tools gates.

## Status rule

Do not regress this README to a sprint-era or prototype-era statement. Update [Current Status](docs/release/CURRENT_STATUS.md), the public manifest, and this README together whenever a deployment, certification, or publication gate changes.
