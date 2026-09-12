# V4D-SAT — ANALYSIS semantic contract

## Root cause

`method.analyze` currently persists the raw source but does not persist a semantic analysis. The workflow service hard-codes `objective: null`, `essentialInformation: []` and `missingInformation: []`. The MCP runtime also has no AI-provider dependency of its own.

## Architecture decision

The semantic extraction must happen before the tool invocation in the ChatGPT/MCP model layer, and the MCP server must validate and persist the structured result. The server must not add a hidden second AI provider merely to populate ANALYSIS.

## Required ANALYSIS payload

- `sourceContent`: immutable source text.
- `analysisSummary`: concise semantic synthesis.
- `objective`: explicit central objective.
- `essentialInformation[]`: facts and elements required for downstream structure.
- `missingInformation[]`: unresolved or unverified information.
- optional `timeline[]`.
- optional `agreements[]`.
- optional `commitments[]`.
- optional `validationFlags[]`.

## Completeness gate

An ANALYSIS artifact is complete only when:

- `objective` is non-empty; and
- `essentialInformation.length > 0`.

Incomplete versions may be persisted for traceability and revision, but they must not be offered as normal approval candidates. Approval-grant issuance and `approvals.approve_stage` must fail closed with `ANALYSIS_INCOMPLETE` for incomplete ANALYSIS versions.

## Revision semantics

`generated != approved`.

The already-corrected workflow allows `ANALYSIS_REVIEW -> ANALYZING`, so v1, v2, v3... may be generated before explicit approval. Only the latest current ANALYSIS version is approvable; stale versions remain rejected. `STRUCTURING` remains guarded by approval of the current/latest ANALYSIS version.

## MCP contract direction

`method.analyze` should require the model to submit semantic fields together with the source. The tool description must explicitly instruct the caller to extract objective, essential information and unresolved information from the source before calling the tool. The server validates types and completeness rather than fabricating values.

## Regression gates

1. source with explicit objective -> persisted `objective != null`;
2. essential facts -> non-empty `essentialInformation`;
3. uncertainties -> `missingInformation` or validation flags;
4. incomplete analysis -> `ANALYSIS_INCOMPLETE` at approval boundary;
5. reanalysis creates a new version;
6. prior version becomes stale;
7. same requestId remains idempotent;
8. STRUCTURE only opens after approval of the exact latest analysis;
9. OAuth, grants, scopes, PostgreSQL and multi-user isolation remain unchanged.
