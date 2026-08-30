import test from "node:test";
import assert from "node:assert/strict";
import { solveNineSixteenFlyer } from "../../dist/packages/layout-engine/src/index.js";
import { createFlyerRenderSpec, renderSvg, validateRenderSpec } from "../../dist/packages/renderer/src/index.js";

const layout = solveNineSixteenFlyer({
  headlineProminence: "VERY_HIGH",
  headlineZone: "UPPER_LEFT",
  heroZone: "CENTER",
  negativeSpace: "HIGH",
  textDensity: "LOW",
  alignment: "LEFT_DOMINANT"
});

const content = {
  eyebrow: "VISUAL 4D STUDIO",
  headline: "Primera composición renderizada",
  body: ["Layout determinista", "RenderSpec verificable", "Salida SVG reproducible"],
  heroLabel: "Área visual",
  footer: "Sprint 3.1"
};

test("Sprint 3.1 creates a valid deterministic RenderSpec", () => {
  const a = createFlyerRenderSpec(layout, content);
  const b = createFlyerRenderSpec(layout, content);
  assert.deepEqual(a, b);
  assert.equal(a.version, "visual4d.render.v1");
  assert.equal(validateRenderSpec(a).valid, true);
});

test("Sprint 3.1 renders deterministic SVG at exact canvas size", () => {
  const spec = createFlyerRenderSpec(layout, content);
  const a = renderSvg(spec);
  const b = renderSvg(spec);
  assert.equal(a, b);
  assert.match(a, /<svg[^>]*width="1080"[^>]*height="1920"/);
  assert.match(a, /id="headline"/);
  assert.match(a, /Primera composición renderizada/);
});

test("renderer escapes user text instead of injecting markup", () => {
  const spec = createFlyerRenderSpec(layout, { ...content, headline: "Diseño <seguro> & verificable" });
  const svg = renderSvg(spec);
  assert.doesNotMatch(svg, /Diseño <seguro>/);
  assert.match(svg, /Diseño &lt;seguro&gt; &amp; verificable/);
});

test("RenderSpec rejects duplicate ids and elements outside canvas", () => {
  const spec = createFlyerRenderSpec(layout, content);
  const first = spec.elements[0];
  assert.ok(first);
  const invalid = {
    ...spec,
    elements: [
      ...spec.elements,
      { ...first, box: { x: -1, y: 0, width: 10, height: 10 } }
    ]
  };
  const validation = validateRenderSpec(invalid);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => error.startsWith("DUPLICATE_ID:")));
  assert.ok(validation.errors.some((error) => error.startsWith("OUTSIDE_CANVAS:")));
});

test("invalid layout cannot be converted into RenderSpec", () => {
  const invalidLayout = {
    ...layout,
    regions: { ...layout.regions, hero: { ...layout.regions.hero, x: -500 } }
  };
  assert.throws(() => createFlyerRenderSpec(invalidLayout, content), /INVALID_LAYOUT_SPEC/);
});
