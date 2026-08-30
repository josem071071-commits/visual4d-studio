# Visual 4D Studio — Tool Review Matrix

Status: Sprint 4.9 submission evidence

This matrix is the human-review companion to the executable MCP tool registry and production scope policy. It must stay aligned with `services/mcp-server/src/tool-registry.ts`, `render-tool.ts`, and `tool-scope-policy.ts`.

| Tool | Operation | External side effect | Required production scope | Explicit approval | Review classification |
|---|---|---:|---|---:|---|
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

1. The preview tool is the only currently certified read-only visual surface and requires only `visual4d:render`.
2. Generic `visual4d:write` does not grant stage approval.
3. `approvals.approve_stage` requires the separate `visual4d:approve` scope plus a one-time approval grant bound to actor, project, artifact kind and exact artifact version.
4. Identity activation is separated from generic write permission through `visual4d:identity`.
5. Production scope policy is deny-by-default: a tool missing from the policy raises `PRODUCTION_SCOPE_POLICY_MISSING`.
6. Static staging bearer authentication must never be accepted by the production deployment.
7. Tool annotations must accurately describe side effects; no write tool may be represented as read-only.

## Reviewer test sequence

Recommended minimal review:

1. Connect with only `visual4d:render` and call `generation.render_preview`: expected success.
2. With the same token, attempt a write tool: expected authorization failure.
3. Connect with `visual4d:write`: normal workflow mutations may execute subject to workflow invariants.
4. Attempt `approvals.approve_stage` without `visual4d:approve`: expected authorization failure.
5. With `visual4d:approve` but without a valid one-time approval grant: expected failure.
6. Reuse a consumed approval grant: expected failure.
7. Attempt identity activation without `visual4d:identity`: expected authorization failure.
8. Verify an unauthenticated production MCP request returns a Bearer challenge pointing to protected-resource metadata.

## Submission rule

Immediately before submission, compare this matrix against the live tool-analysis output shown by the OpenAI/ChatGPT app creation surface. Any classification discrepancy must be resolved before publication.