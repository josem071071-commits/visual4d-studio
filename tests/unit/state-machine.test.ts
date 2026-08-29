import test from "node:test";
import assert from "node:assert/strict";
import { canTransition, transition, TransitionError, type ApprovalSnapshot } from "../../packages/state-machine/src/index.js";

const version = (currentVersionId: string | null = null, approvedVersionId: string | null = null) => ({
  currentVersionId,
  approvedVersionId
});

const none: ApprovalSnapshot = {
  analysis: version(),
  structure: version(),
  resources: version(),
  artDirection: version(),
  verification: version(),
  verificationPassed: false,
  criticalErrors: []
};

test("cannot structure before analysis approval", () => {
  assert.equal(canTransition("ANALYSIS_REVIEW", "STRUCTURING", none), false);
});

test("can structure only when current analysis version is approved", () => {
  const approval: ApprovalSnapshot = { ...none, analysis: version("analysis_v2", "analysis_v2") };
  assert.equal(transition("ANALYSIS_REVIEW", "STRUCTURING", approval), "STRUCTURING");
});

test("stale analysis approval cannot authorize a newer analysis version", () => {
  const approval: ApprovalSnapshot = { ...none, analysis: version("analysis_v3", "analysis_v2") };
  assert.throws(
    () => transition("ANALYSIS_REVIEW", "STRUCTURING", approval),
    (error: unknown) => error instanceof TransitionError && error.code === "ANALYSIS_APPROVAL_REQUIRED"
  );
});

test("cannot resolve resources without approved current structure version", () => {
  const approval: ApprovalSnapshot = {
    ...none,
    analysis: version("analysis_v2", "analysis_v2"),
    structure: version("structure_v2", "structure_v1")
  };
  assert.throws(
    () => transition("STRUCTURE_REVIEW", "RESOLVING_RESOURCES", approval),
    (error: unknown) => error instanceof TransitionError && error.code === "STRUCTURE_APPROVAL_REQUIRED"
  );
});

test("cannot generate without approved current art direction", () => {
  const approval: ApprovalSnapshot = {
    ...none,
    artDirection: version("art_v2", "art_v1")
  };
  assert.throws(
    () => transition("ART_DIRECTION_REVIEW", "GENERATING", approval),
    (error: unknown) => error instanceof TransitionError && error.code === "ART_DIRECTION_APPROVAL_REQUIRED"
  );
});

test("critical error blocks approval", () => {
  const approval: ApprovalSnapshot = {
    ...none,
    verification: version("verification_v2", "verification_v2"),
    verificationPassed: true,
    criticalErrors: ["WRONG_DATE"]
  };
  assert.throws(
    () => transition("VERIFICATION_REVIEW", "APPROVED", approval),
    (error: unknown) => error instanceof TransitionError && error.code === "CRITICAL_ERRORS_BLOCK_APPROVAL"
  );
});

test("final requires current approved verification version", () => {
  const approval: ApprovalSnapshot = {
    ...none,
    verification: version("verification_v3", "verification_v2"),
    verificationPassed: true,
    criticalErrors: []
  };
  assert.throws(
    () => transition("APPROVED", "FINAL", approval),
    (error: unknown) => error instanceof TransitionError && error.code === "FINAL_BLOCKED_BY_VERIFICATION"
  );
});
