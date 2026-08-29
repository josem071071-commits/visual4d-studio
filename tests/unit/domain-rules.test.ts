import test from "node:test";
import assert from "node:assert/strict";
import {
  enforceAssetPolicy,
  assertMasterAssetUsable,
  assertOwnerMatchesInstitution,
  assertSameInstitution,
  DomainRuleError,
  requirePortraitNineSixteen
} from "../../packages/domain/src/index.js";

test("master assets cannot be generatively edited", () => {
  assert.throws(
    () => enforceAssetPolicy({ type: "LOGO", isMaster: true, generativeEditAllowed: true, documentary: false, generatedByAI: false }),
    (e: unknown) => e instanceof DomainRuleError && e.code === "MASTER_ASSET_GENERATIVE_EDIT_FORBIDDEN"
  );
});

test("generated images cannot be documentary", () => {
  assert.throws(
    () => enforceAssetPolicy({ type: "GENERATED_IMAGE", isMaster: false, generativeEditAllowed: true, documentary: true, generatedByAI: true }),
    (e: unknown) => e instanceof DomainRuleError && e.code === "GENERATED_CANNOT_BE_DOCUMENTARY"
  );
});

test("documentary photo cannot be AI generated", () => {
  assert.throws(
    () => enforceAssetPolicy({ type: "PHOTO_DOCUMENTARY", isMaster: false, generativeEditAllowed: false, documentary: false, generatedByAI: true }),
    (e: unknown) => e instanceof DomainRuleError && e.code === "DOCUMENTARY_PHOTO_MUST_NOT_BE_AI_GENERATED"
  );
});

test("assets cannot cross institution boundaries", () => {
  assert.throws(() => assertSameInstitution("inst_a", "inst_b"));
  assert.doesNotThrow(() => assertSameInstitution("inst_a", "inst_a"));
});

test("private library owner must match institution owner", () => {
  assert.throws(
    () => assertOwnerMatchesInstitution("usr_a", "usr_b"),
    (e: unknown) => e instanceof DomainRuleError && e.code === "OWNER_INSTITUTION_MISMATCH"
  );
});

test("archived master asset cannot be selected as active master", () => {
  assert.throws(
    () => assertMasterAssetUsable({ isMaster: true, status: "ARCHIVED" }),
    (e: unknown) => e instanceof DomainRuleError && e.code === "MASTER_ASSET_NOT_ACTIVE"
  );
  assert.doesNotThrow(() => assertMasterAssetUsable({ isMaster: true, status: "ACTIVE" }));
});

test("prototype format is portrait 9:16 and rejects outside tolerance", () => {
  assert.doesNotThrow(() => requirePortraitNineSixteen(1080, 1920));
  assert.doesNotThrow(() => requirePortraitNineSixteen(1081, 1920));
  assert.throws(() => requirePortraitNineSixteen(1090, 1920));
  assert.throws(() => requirePortraitNineSixteen(1920, 1080));
});
