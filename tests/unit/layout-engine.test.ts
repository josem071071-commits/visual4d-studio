import test from "node:test";
import assert from "node:assert/strict";
import { solveNineSixteenFlyer } from "../../packages/layout-engine/src/index.js";

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
