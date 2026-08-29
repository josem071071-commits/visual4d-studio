# Core Certification Report — Visual 4D Prototype v0.2.3

## Scope
Sprint 2.3 certifies only the secure workflow core. It intentionally produces no visual piece.

## Build/runtime results executed here

| Gate | Result |
|---|---|
| Core TypeScript build (`tsc -p tsconfig.core.json`) | PASS |
| Runtime/domain/state/workflow/security suite | PASS |
| Sprint 2.3 certification contracts | PASS |
| Concurrent duplicate idempotency (memory) | PASS |
| Total executed tests | 49 PASS / 0 FAIL / 0 SKIP |

## External certification gates

| Gate | Status in this environment |
|---|---|
| Clean `npm ci` | NOT CERTIFIED — dependency installation unavailable/timed out |
| Full integration typecheck | NOT CERTIFIED — Node/MCP/pg type packages unavailable locally |
| Real PostgreSQL rollback | READY, NOT EXECUTED |
| Real PostgreSQL concurrent idempotency | READY, NOT EXECUTED |
| PostgreSQL migration UP/DOWN/UP | READY, NOT EXECUTED |
| MCP authenticated full E2E | READY, NOT EXECUTED |
| Cross-user network authorization | READY, NOT EXECUTED |
| Approval failure/retry in PostgreSQL | READY, NOT EXECUTED |

## Invariants implemented
- MASTER ASSET generative modification remains blocked.
- Generated imagery cannot be documentary.
- Workflow stages cannot be skipped.
- Approval is tied to the exact current artifact version.
- Actor ownership is verified server-side.
- Final state requires the exact verified DesignVersion.
- Critical verification errors block finalization.
- Duplicate mutation request IDs are coordinated before effects.
- PostgreSQL workflow operations are routed through one transaction context.
- Approval grants move ISSUED -> CLAIMED -> CONSUMED and can recover from failed action.
- Approval bridge is development-only and disabled by default.

## Certification status
**CONDITIONALLY PASSED / NOT YET 100% CERTIFIED.**

The source-level and executable local core gates pass. Final core closure requires the provided PostgreSQL/MCP certification test to pass in a clean CI environment with zero skips and zero failures.
