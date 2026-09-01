# Visual 4D Studio — Tool Review Matrix

Status: V4D-SAT production-candidate certification

This matrix is the human-review companion to the executable MCP tool registry and production scope policy. It must stay aligned with `services/mcp-server/src/tool-registry.ts`, `render-tool.ts`, and `tool-scope-policy.ts`.

| Tool | Operation | External side effect | Required production scope | Explicit approval | Review classification |
|---|---|---:|---|---:|---|
| `projects.create` | Create owner-bound project and bootstrap personal institution/identity when needed | Yes | `visual4d:write` | No | Write, idempotent bootstrap |
| `generation.render_preview` | Render deterministic preview | No persistent mutation | `visual4d:render` | No | Read-only preview |
| `method.analyze` | Create analysis version | Yes | `visual4d:write` | Workflow-gated | Write, idempotent |
| `method.structure` | Create editorial structure | Yes | `visual4d:write` | Prior exact-stage approval | Write, idempotent |
| `method.resolve_resources` | Resolve resource requirements | Yes | `visual4d:write` | Workflow-gated | Write, idempotent |
| `method.art_direct` | Create art-direction version | Yes | `visual4d:write` | Required resources resolved | Write, idempotent |
| `generation.create_design` | Create design version | Yes | `visual4d:write` | Workflow-gated | Write, idempotent |
| `verification.save` | Save verification of exact design | Yes | `visual4d:write` | Workflow-gated | Write, idempotent |
| `approvals.approve_stage` | Approve exact artifact version | Yes, consequential | `visual4d:approve` | **Yes: one-time user-action grant** | Explicit approval write |
| `versions.mark_final` | Mark verified design final | Yes, consequential | `visual4d:write` | Exact verification must already be explicitly approved | Finalization write |
| `identity.activate_version` | Activate institutional identity version | Yes, consequential | `visual4d:identity` | Authorized owner/action required | Identity write |

## Safety invariants

1. `generation.render_preview` is read-only and requires only `visual4d:render`.
2. `projects.create` may bootstrap the authenticated owner's personal institution and base identity, but it remains owner-bound and idempotent by request ID.
3. Generic `visual4d:write` does not grant stage approval.
4. `approvals.approve_stage` requires the separate `visual4d:approve` scope plus a one-time approval grant bound to actor, project, artifact kind and exact artifact version.
5. Identity activation is separated from generic write permission through `visual4d:identity`.
6. Production scope policy is deny-by-default: a tool missing from the policy raises `PRODUCTION_SCOPE_POLICY_MISSING`.
7. Static staging bearer authentication must never be accepted by the production deployment.
8. Tool annotations must accurately describe side effects; no write tool may be represented as read-only.

## V4D-SAT certification sequence

The automated release-candidate gate must:

1. Discover exactly 11 tools.
2. Execute `projects.create` against PostgreSQL and verify idempotent replay.
3. Execute `generation.render_preview` through MCP and verify deterministic SVG output.
4. Prove a workflow stage cannot be skipped before the required approval.
5. Execute analysis → structure → resources → art direction → design → verification → finalization.
6. Exercise `approvals.approve_stage` with one-time grants bound to exact versions.
7. Execute `identity.activate_version` on an owner-bound second identity.
8. Reread PostgreSQL and verify FINAL state, final design linkage, active identity and audit persistence.

## Reviewer permission sequence

1. Connect with only `visual4d:render` and call `generation.render_preview`: expected success.
2. With the same token, attempt a write tool: expected authorization failure.
3. Connect with `visual4d:write`: project/workflow mutations may execute subject to workflow invariants.
4. Attempt `approvals.approve_stage` without `visual4d:approve`: expected authorization failure.
5. With `visual4d:approve` but without a valid one-time approval grant: expected failure.
6. Reuse a consumed approval grant: expected failure.
7. Attempt identity activation without `visual4d:identity`: expected authorization failure.
8. Verify an unauthenticated production MCP request returns a Bearer challenge pointing to protected-resource metadata.

## Promotion rule

Before v1.0.0, compare this matrix against the live ChatGPT tool-analysis surface and the V4D-SAT 11-tool CI gate. Any catalog, scope or side-effect classification discrepancy blocks promotion.
