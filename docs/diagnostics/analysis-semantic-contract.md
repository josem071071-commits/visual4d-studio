# V4D-SAT — ANALYSIS semantic contract

## Root cause

`method.analyze` previously persisted the raw source but did not persist a semantic analysis. The workflow service hard-coded `objective: null`, `essentialInformation: []` and `missingInformation: []`.

## Architecture decision

Visual 4D now performs a deterministic semantic extraction in the MCP runtime before persistence. This avoids adding a hidden second AI provider while ensuring the tool no longer stores only raw text. The original `sourceContent` remains preserved and the extracted semantic result is persisted separately.

For explicitly structured sources, the extractor identifies objective, essential information, agreements, commitments, chronology and validation gaps. If an objective is not explicitly stated, the runtime records a conservative generic objective and a validation flag instead of silently presenting an inferred objective as confirmed fact.

## ANALYSIS payload

- `sourceContent`: immutable source text.
- `analysisSummary`: concise semantic synthesis.
- `objective`: central objective or conservative fallback marked for validation.
- `essentialInformation[]`: facts and elements required for downstream structure.
- `missingInformation[]`: unresolved or unverified information.
- `timeline[]`.
- `agreements[]`.
- `commitments[]`.
- `validationFlags[]`.

## Completeness gate

An ANALYSIS artifact is complete only when:

- `sourceContent` is non-empty;
- `analysisSummary` is non-empty;
- `objective` is non-empty; and
- `essentialInformation.length > 0`.

Approval-grant issuance and `approvals.approve_stage` fail closed with `ANALYSIS_INCOMPLETE` if a persisted ANALYSIS does not satisfy this contract.

## Revision semantics

`generated != approved`.

The workflow allows `ANALYSIS_REVIEW -> ANALYZING`, so v1, v2, v3... may be generated before explicit approval. Only the latest current ANALYSIS version is approvable; stale versions remain rejected. `STRUCTURING` remains guarded by approval of the current/latest ANALYSIS version.

## Regression gates

1. source with explicit objective -> persisted `objective != null`;
2. essential facts -> non-empty `essentialInformation`;
3. uncertainties -> `missingInformation` and `validationFlags`;
4. agreements/commitments/timeline are separated when labelled;
5. incomplete persisted analysis -> `ANALYSIS_INCOMPLETE` at approval boundary;
6. reanalysis creates a new version;
7. prior version becomes stale;
8. same requestId remains idempotent;
9. STRUCTURE only opens after approval of the exact latest analysis;
10. OAuth, grants, scopes, PostgreSQL and multi-user isolation remain unchanged.
