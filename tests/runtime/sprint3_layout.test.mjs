import test from "node:test";
import assert from "node:assert/strict";
import { solveNineSixteenFlyer, validateLayoutSpec } from "../../dist/packages/layout-engine/src/index.js";

const base = {
  headlineProminence: "HIGH",
  headlineZone: "UPPER_LEFT",
  heroZone: "CENTER",
  negativeSpace: "MEDIUM",
  textDensity: "MEDIUM",
  alignment: "LEFT_DOMINANT"
};

test("Sprint 3 solver is deterministic for identical intent", () => {
  const a = solveNineSixteenFlyer(base);
  const b = solveNineSixteenFlyer(base);
  assert.deepEqual(a, b);
});

test("Sprint 3 solver keeps supported layouts inside safe area without overlap", () => {
  for (const heroZone of ["UPPER", "CENTER", "LOWER", "RIGHT", "LEFT"]) {
    const spec = solveNineSixteenFlyer({ ...base, heroZone });
    const validation = validateLayoutSpec(spec);
    assert.equal(validation.valid, true, `${heroZone}: ${validation.errors.join(", ")}`);
  }
});

test("headline zones materially change horizontal placement", () => {
  const left = solveNineSixteenFlyer({ ...base, headlineZone: "UPPER_LEFT" });
  const center = solveNineSixteenFlyer({ ...base, headlineZone: "UPPER_CENTER" });
  const right = solveNineSixteenFlyer({ ...base, headlineZone: "UPPER_RIGHT" });
  assert.ok(left.regions.headline.x < center.regions.headline.x);
  assert.ok(center.regions.headline.x < right.regions.headline.x);
});

test("text density adjusts legibility constraints without violating minimum body size", () => {
  const low = solveNineSixteenFlyer({ ...base, textDensity: "LOW" });
  const high = solveNineSixteenFlyer({ ...base, textDensity: "HIGH" });
  assert.ok(low.constraints.minBodyFontPx > high.constraints.minBodyFontPx);
  assert.ok(high.constraints.minBodyFontPx >= 28);
  assert.ok(high.constraints.maxBodyLinesPerBlock > low.constraints.maxBodyLinesPerBlock);
});
