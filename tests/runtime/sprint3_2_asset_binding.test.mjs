import test from "node:test";
import assert from "node:assert/strict";
import { solveNineSixteenFlyer } from "../../dist/packages/layout-engine/src/index.js";
import { createFlyerRenderSpec, renderSvg, validateRenderSpec } from "../../dist/packages/renderer/src/index.js";
import { bindRasterAsset, validateRasterAssetBinding } from "../../dist/packages/asset-binding/src/index.js";

const PNG_1PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlZ4QAAAABJRU5ErkJggg==";

const layout = solveNineSixteenFlyer({
  headlineProminence: "HIGH",
  headlineZone: "UPPER_LEFT",
  heroZone: "CENTER",
  negativeSpace: "MEDIUM",
  textDensity: "LOW",
  alignment: "LEFT_DOMINANT"
});

function baseSpec() {
  return createFlyerRenderSpec(layout, {
    eyebrow: "VISUAL 4D STUDIO",
    headline: "Asset con procedencia controlada",
    body: ["Imagen raster segura", "Procedencia preservada"],
    footer: "Sprint 3.2"
  });
}

const institutionalBinding = {
  elementId: "hero",
  assetId: "asset_institutional_001",
  sourceType: "INSTITUTIONAL_ASSET",
  generatedByAI: false,
  documentary: false,
  approved: true,
  approvedAt: "2026-08-30T00:00:00.000Z",
  mediaType: "image/png",
  dataUri: PNG_1PX
};

test("Sprint 3.2 binds a safe raster asset deterministically", () => {
  const a = bindRasterAsset(baseSpec(), institutionalBinding);
  const b = bindRasterAsset(baseSpec(), institutionalBinding);
  assert.deepEqual(a, b);
  assert.equal(validateRenderSpec(a).valid, true);
  const hero = a.elements.find((element) => element.id === "hero");
  assert.equal(hero?.kind, "image");
  assert.equal(hero?.assetId, "asset_institutional_001");
});

test("Sprint 3.2 renderer preserves asset and provenance metadata", () => {
  const svg = renderSvg(bindRasterAsset(baseSpec(), institutionalBinding));
  assert.match(svg, /<image id="hero"/);
  assert.match(svg, /data-asset-id="asset_institutional_001"/);
  assert.match(svg, /data-source-type="INSTITUTIONAL_ASSET"/);
  assert.match(svg, /href="data:image\/png;base64,/);
});

test("generated assets cannot be bound as documentary evidence", () => {
  const validation = validateRasterAssetBinding({
    ...institutionalBinding,
    sourceType: "GENERATED_ASSET",
    generatedByAI: true,
    documentary: true
  });
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.includes("GENERATED_CANNOT_BE_DOCUMENTARY"));
});

test("MASTER assets cannot be represented as AI-generated", () => {
  const validation = validateRasterAssetBinding({
    ...institutionalBinding,
    sourceType: "MASTER_ASSET",
    generatedByAI: true
  });
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.includes("MASTER_ASSET_CANNOT_BE_GENERATED"));
});

test("remote URLs and SVG data are rejected by raster binding", () => {
  const remote = validateRasterAssetBinding({ ...institutionalBinding, dataUri: "https://example.com/tracker.png" });
  assert.equal(remote.valid, false);
  assert.ok(remote.errors.includes("UNSAFE_OR_MISMATCHED_RASTER_DATA_URI"));

  const svg = validateRasterAssetBinding({
    ...institutionalBinding,
    mediaType: "image/png",
    dataUri: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="
  });
  assert.equal(svg.valid, false);
});

test("approval metadata must be internally consistent", () => {
  const missingDate = validateRasterAssetBinding({ ...institutionalBinding, approvedAt: null });
  assert.equal(missingDate.valid, false);
  assert.ok(missingDate.errors.includes("APPROVED_AT_REQUIRED"));

  const unapprovedWithDate = validateRasterAssetBinding({ ...institutionalBinding, approved: false });
  assert.equal(unapprovedWithDate.valid, false);
  assert.ok(unapprovedWithDate.errors.includes("APPROVED_AT_WITHOUT_APPROVAL"));
});
