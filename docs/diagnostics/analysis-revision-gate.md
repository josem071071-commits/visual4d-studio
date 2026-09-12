# V4D-SAT — Analysis revision gate

Observed production state: `method.analyze` creates v1 and moves the project to `ANALYSIS_REVIEW`. A second analysis attempt is then rejected with `ANALYSIS_STAGE_REQUIRED`, even when the current v1 is incomplete and intentionally unapproved.

The state machine already declares `ANALYSIS_REVIEW -> ANALYZING` as a valid transition, but `ProjectWorkflowService.startAnalysis()` only moves `DRAFT -> ANALYZING`; it never exercises the allowed review-to-analyzing transition.

Required behavior:

1. If stage is `DRAFT`, move to `ANALYZING` and create v1.
2. If stage is `ANALYSIS_REVIEW`, move back to `ANALYZING` and create a new ANALYSIS artifact version (v2+).
3. Never require approval of an incomplete prior version just to revise it.
4. Only the latest ANALYSIS version can be approved; older versions remain stale and unapprovable.
5. `STRUCTURING` remains guarded by approval of the current/latest analysis version.
6. Same-request idempotency must still return the original artifact rather than creating duplicates.

This is a workflow-state correction, not a relaxation of approval security.