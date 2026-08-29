# Phase 5 — Sprint 2.1 Security & Workflow Integrity

This hardening sprint closes the security and workflow gaps identified in Sprint 2 before any network MCP exposure.

## Applied corrections

1. **ActorContext authorization**: actor identity is injected by the server and checked against project/institution ownership on every workflow operation.
2. **User approvals**: approvals record `USER_APPROVED`, `approvedByUserId`, exact artifact version and timestamp. AI/system approval is not accepted by the workflow gate.
3. **Mandatory DesignVersion**: generation creates a `DESIGN` artifact; verification must reference the exact latest design; FINAL stores `finalDesignVersionId`.
4. **Strict MCP validation**: no permissive Boolean/Number coercion; schemas reject extra properties and out-of-range scores.
5. **Resource Requirement Resolver**: flyer MVP requires LOGO, BANNER and HERO_MEDIA; missing resources are reported and art direction is blocked until resolved.
6. **MCP workflow contracts**: actor-aware analyze, approve, structure, resource resolution, art direction, design creation, verification, finalization and identity activation contracts.
7. **Idempotency and optimistic revision**: mutating operations accept a request id and repository records replay-safe results; project saves support expected revision checks.
8. **Atomic identity activation semantics**: old ACTIVE version is archived and institution pointer is updated as one repository operation.

## Network boundary

No real network MCP server is enabled in this sprint. The registry remains an in-process contract layer. PostgreSQL repository implementation remains a subsequent step.
