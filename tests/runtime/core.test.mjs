import test from "node:test";
import assert from "node:assert/strict";
import {
  enforceAssetPolicy,
  assertMasterAssetUsable,
  assertOwnerMatchesInstitution,
  assertSameInstitution,
  DomainRuleError,
  requirePortraitNineSixteen
} from "../../dist/packages/domain/src/index.js";
import { canTransition, transition, TransitionError } from "../../dist/packages/state-machine/src/index.js";
import { validateProvenance } from "../../dist/packages/provenance/src/index.js";
import { solveNineSixteenFlyer } from "../../dist/packages/layout-engine/src/index.js";

const version = (currentVersionId = null, approvedVersionId = null) => ({ currentVersionId, approvedVersionId });
const none = {
  analysis: version(),
  structure: version(),
  resources: version(),
  artDirection: version(),
  verification: version(),
  verificationPassed: false,
  criticalErrors: []
};

test("master assets cannot be generatively edited", () => {
  assert.throws(
    () => enforceAssetPolicy({ type: "LOGO", isMaster: true, generativeEditAllowed: true, documentary: false, generatedByAI: false }),
    (e) => e instanceof DomainRuleError && e.code === "MASTER_ASSET_GENERATIVE_EDIT_FORBIDDEN"
  );
});

test("generated images cannot be documentary", () => {
  assert.throws(
    () => enforceAssetPolicy({ type: "GENERATED_IMAGE", isMaster: false, generativeEditAllowed: true, documentary: true, generatedByAI: true }),
    (e) => e instanceof DomainRuleError && e.code === "GENERATED_CANNOT_BE_DOCUMENTARY"
  );
});

test("documentary photo cannot be AI generated", () => {
  assert.throws(
    () => enforceAssetPolicy({ type: "PHOTO_DOCUMENTARY", isMaster: false, generativeEditAllowed: false, documentary: false, generatedByAI: true }),
    (e) => e instanceof DomainRuleError && e.code === "DOCUMENTARY_PHOTO_MUST_NOT_BE_AI_GENERATED"
  );
});

test("assets cannot cross institution boundaries", () => {
  assert.throws(() => assertSameInstitution("inst_a", "inst_b"));
  assert.doesNotThrow(() => assertSameInstitution("inst_a", "inst_a"));
});

test("private library owner must match institution owner", () => {
  assert.throws(
    () => assertOwnerMatchesInstitution("usr_a", "usr_b"),
    (e) => e instanceof DomainRuleError && e.code === "OWNER_INSTITUTION_MISMATCH"
  );
});

test("archived master asset cannot be active master", () => {
  assert.throws(
    () => assertMasterAssetUsable({ isMaster: true, status: "ARCHIVED" }),
    (e) => e instanceof DomainRuleError && e.code === "MASTER_ASSET_NOT_ACTIVE"
  );
});

test("prototype format is portrait 9:16 and enforces tolerance", () => {
  assert.doesNotThrow(() => requirePortraitNineSixteen(1080, 1920));
  assert.doesNotThrow(() => requirePortraitNineSixteen(1081, 1920));
  assert.throws(() => requirePortraitNineSixteen(1090, 1920));
  assert.throws(() => requirePortraitNineSixteen(1920, 1080));
});

test("cannot structure before analysis approval", () => {
  assert.equal(canTransition("ANALYSIS_REVIEW", "STRUCTURING", none), false);
});

test("can structure after current analysis approval", () => {
  const approval = { ...none, analysis: version("analysis_v2", "analysis_v2") };
  assert.equal(transition("ANALYSIS_REVIEW", "STRUCTURING", approval), "STRUCTURING");
});

test("stale analysis approval is rejected", () => {
  const approval = { ...none, analysis: version("analysis_v3", "analysis_v2") };
  assert.throws(
    () => transition("ANALYSIS_REVIEW", "STRUCTURING", approval),
    (e) => e instanceof TransitionError && e.code === "ANALYSIS_APPROVAL_REQUIRED"
  );
});

test("cannot generate with stale art-direction approval", () => {
  const approval = { ...none, artDirection: version("art_v2", "art_v1") };
  assert.throws(
    () => transition("ART_DIRECTION_REVIEW", "GENERATING", approval),
    (e) => e instanceof TransitionError && e.code === "ART_DIRECTION_APPROVAL_REQUIRED"
  );
});

test("critical error blocks approval", () => {
  const approval = {
    ...none,
    verification: version("verification_v2", "verification_v2"),
    verificationPassed: true,
    criticalErrors: ["WRONG_DATE"]
  };
  assert.throws(
    () => transition("VERIFICATION_REVIEW", "APPROVED", approval),
    (e) => e instanceof TransitionError && e.code === "CRITICAL_ERRORS_BLOCK_APPROVAL"
  );
});

test("stale verification blocks final", () => {
  const approval = {
    ...none,
    verification: version("verification_v3", "verification_v2"),
    verificationPassed: true,
    criticalErrors: []
  };
  assert.throws(
    () => transition("APPROVED", "FINAL", approval),
    (e) => e instanceof TransitionError && e.code === "FINAL_BLOCKED_BY_VERIFICATION"
  );
});

test("generated documentary provenance is rejected", () => {
  const errors = validateProvenance({
    elementId: "hero",
    sourceType: "GENERATED_ASSET",
    sourceId: "asset_gen",
    generatedByAI: true,
    documentary: true,
    approved: false,
    approvedAt: null
  });
  assert.deepEqual(errors, ["GENERATED_CANNOT_BE_DOCUMENTARY"]);
});

test("master asset provenance cannot be generated", () => {
  const errors = validateProvenance({
    elementId: "logo",
    sourceType: "MASTER_ASSET",
    sourceId: "asset_logo",
    generatedByAI: true,
    documentary: false,
    approved: false,
    approvedAt: null
  });
  assert.deepEqual(errors, ["MASTER_ASSET_CANNOT_BE_GENERATED"]);
});

test("solver returns typed 1080x1920 safe layout", () => {
  const spec = solveNineSixteenFlyer({
    headlineProminence: "VERY_HIGH",
    headlineZone: "UPPER_LEFT",
    heroZone: "CENTER",
    negativeSpace: "HIGH",
    textDensity: "LOW",
    alignment: "LEFT_DOMINANT"
  });
  assert.equal(spec.canvas.width, 1080);
  assert.equal(spec.canvas.height, 1920);
  assert.ok(spec.regions.header.x >= spec.safeArea.left);
  assert.ok(spec.regions.footer.y + spec.regions.footer.height <= spec.canvas.height - spec.safeArea.bottom);
  assert.ok(spec.constraints.minBodyFontPx >= 30);
});
