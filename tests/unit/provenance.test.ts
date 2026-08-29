import test from "node:test";
import assert from "node:assert/strict";
import { validateProvenance } from "../../packages/provenance/src/index.js";

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

test("documentary asset provenance cannot be generated", () => {
  const errors = validateProvenance({
    elementId: "photo",
    sourceType: "DOCUMENTARY_ASSET",
    sourceId: "asset_photo",
    generatedByAI: true,
    documentary: false,
    approved: false,
    approvedAt: null
  });
  assert.deepEqual(errors, ["DOCUMENTARY_ASSET_CANNOT_BE_GENERATED"]);
});
