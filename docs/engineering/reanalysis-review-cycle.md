# V4D-SAT — Reanalysis review cycle

## Confirmed root cause

The state machine already allows `ANALYSIS_REVIEW -> ANALYZING`, but `ProjectWorkflowService.startAnalysis()` only performs the transition when the project is in `DRAFT`. When the project is already in `ANALYSIS_REVIEW`, the service immediately fails with `ANALYSIS_STAGE_REQUIRED` instead of reopening analysis and creating a new analysis version.

## Required behavior

Before STRUCTURE, a user must be able to request a corrected/revised analysis without approving an incomplete current version.

Expected cycle:

`DRAFT -> ANALYZING -> ANALYSIS_REVIEW -> ANALYZING -> ANALYSIS_REVIEW ...`

Each reanalysis must create a new `ANALYSIS` artifact version. Any earlier approval must not authorize STRUCTURE if a newer analysis version exists; the existing exact-current-version approval guard already enforces that condition.

## Minimal code correction

In `ProjectWorkflowService.startAnalysis()`, transition to `ANALYZING` when the current stage is either `DRAFT` or `ANALYSIS_REVIEW`. Preserve all other stage guards.

Conceptually:

```ts
if (p.currentStage === "DRAFT" || p.currentStage === "ANALYSIS_REVIEW") {
  p = await this.move(p, "ANALYZING");
}
```

## Regression requirements

1. First analysis from DRAFT still works.
2. A second analysis from ANALYSIS_REVIEW creates a new version and returns to ANALYSIS_REVIEW.
3. The previous analysis version cannot be approved once a newer version exists (`STALE_ARTIFACT_CANNOT_BE_APPROVED`).
4. STRUCTURE remains blocked until the latest analysis version is explicitly approved.
5. Idempotent replay using the same requestId still returns the same analysis version.
6. No changes to OAuth, approval grants, Apps UI, PostgreSQL schema, or tool catalog.

## Acceptance gate

Do not move the real project to STRUCTURE until the revised analysis version is generated and explicitly approved through the UI bridge.
