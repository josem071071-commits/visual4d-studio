import fs from "node:fs";
import path from "node:path";
import { solveNineSixteenFlyer } from "../dist/packages/layout-engine/src/index.js";
import { createFlyerRenderSpec, renderSvg } from "../dist/packages/renderer/src/index.js";
import { bindRasterAsset } from "../dist/packages/asset-binding/src/index.js";
import { applyIdentityTokens } from "../dist/packages/identity-style/src/index.js";

const PNG_1PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlZ4QAAAABJRU5ErkJggg==";
const layout = solveNineSixteenFlyer({
  headlineProminence: "VERY_HIGH",
  headlineZone: "UPPER_LEFT",
  heroZone: "CENTER",
  negativeSpace: "HIGH",
  textDensity: "LOW",
  alignment: "LEFT_DOMINANT"
});

let spec = createFlyerRenderSpec(layout, {
  eyebrow: "VISUAL 4D STUDIO",
  headline: "Identidad aplicada sobre composición verificable",
  body: ["Tokens de color", "Contraste mínimo", "Tipografía local segura"],
  footer: "Sprint 3.3 — referencia técnica"
});

spec = bindRasterAsset(spec, {
  elementId: "hero",
  assetId: "asset_brand_ci_reference",
  sourceType: "INSTITUTIONAL_ASSET",
  generatedByAI: false,
  documentary: false,
  approved: true,
  approvedAt: "2026-08-30T00:00:00.000Z",
  mediaType: "image/png",
  dataUri: PNG_1PX
});

spec = applyIdentityTokens(spec, {
  version: "visual4d.identity.v1",
  colors: {
    background: "#FFFFFF",
    primary: "#173B57",
    text: "#111827",
    mutedText: "#4B5563",
    heroSurface: "#E8EDF2"
  },
  typography: { family: "SYSTEM_SANS" }
});

const outDir = path.resolve("certification/samples");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "sprint3_3_brand_reference.svg");
fs.writeFileSync(outPath, renderSvg(spec), "utf8");
console.log(outPath);
