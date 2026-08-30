import test from "node:test";
import assert from "node:assert/strict";
import { solveNineSixteenFlyer } from "../../dist/packages/layout-engine/src/index.js";
import { createFlyerRenderSpec, renderSvg, validateRenderSpec } from "../../dist/packages/renderer/src/index.js";
import { applyIdentityTokens, contrastRatio, validateIdentityTokens } from "../../dist/packages/identity-style/src/index.js";

const layout = solveNineSixteenFlyer({
  headlineProminence: "VERY_HIGH",
  headlineZone: "UPPER_LEFT",
  heroZone: "CENTER",
  negativeSpace: "HIGH",
  textDensity: "LOW",
  alignment: "LEFT_DOMINANT"
});

const baseSpec = createFlyerRenderSpec(layout, {
  eyebrow: "VISUAL 4D STUDIO",
  headline: "Identidad visual determinista",
  body: ["Tokens validados", "Contraste verificable", "Sin CSS arbitrario"],
  heroLabel: "Brand-safe",
  footer: "Sprint 3.3"
});

const identity = {
  version: "visual4d.identity.v1",
  colors: {
    background: "#FFFFFF",
    primary: "#173B57",
    text: "#111827",
    mutedText: "#4B5563",
    heroSurface: "#E8EDF2"
  },
  typography: { family: "SYSTEM_SANS" }
};

test("Sprint 3.3 identity tokens pass deterministic accessibility gates", () => {
  const validation = validateIdentityTokens(identity);
  assert.equal(validation.valid, true, validation.errors.join(", "));
  assert.ok(contrastRatio(identity.colors.text, identity.colors.background) >= 4.5);
  assert.ok(contrastRatio(identity.colors.primary, identity.colors.background) >= 4.5);
});

test("Sprint 3.3 applies identity without changing geometry", () => {
  const styled = applyIdentityTokens(baseSpec, identity);
  assert.equal(validateRenderSpec(styled).valid, true);
  for (let index = 0; index < baseSpec.elements.length; index += 1) {
    assert.deepEqual(styled.elements[index]?.box, baseSpec.elements[index]?.box);
  }
});

test("Sprint 3.3 produces deterministic brand-safe SVG", () => {
  const a = renderSvg(applyIdentityTokens(baseSpec, identity));
  const b = renderSvg(applyIdentityTokens(baseSpec, identity));
  assert.equal(a, b);
  assert.match(a, /fill="#173B57"/);
  assert.match(a, /font-family="Arial, Helvetica, sans-serif"/);
});

test("low-contrast identity is rejected", () => {
  const validation = validateIdentityTokens({
    ...identity,
    colors: { ...identity.colors, text: "#EEEEEE", mutedText: "#EEEEEE", primary: "#EEEEEE" }
  });
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.includes("TEXT_BACKGROUND_CONTRAST_LOW"));
  assert.ok(validation.errors.includes("PRIMARY_BACKGROUND_CONTRAST_LOW"));
});

test("invalid colors and arbitrary font tokens are rejected", () => {
  const validation = validateIdentityTokens({
    ...identity,
    colors: { ...identity.colors, primary: "red" },
    typography: { family: "REMOTE_FONT_URL" }
  });
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.includes("INVALID_COLOR:primary"));
  assert.ok(validation.errors.includes("UNSAFE_FONT_TOKEN"));
});

test("renderer rejects manually injected unsafe style values", () => {
  const styled = applyIdentityTokens(baseSpec, identity);
  const headline = styled.elements.find((element) => element.id === "headline");
  assert.equal(headline?.kind, "text");
  const invalid = {
    ...styled,
    elements: styled.elements.map((element) => element.id === "headline" ? { ...element, fill: "url(javascript:alert(1))" } : element)
  };
  const validation = validateRenderSpec(invalid);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.includes("INVALID_FILL:headline"));
});
