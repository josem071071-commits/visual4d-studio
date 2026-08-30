import fs from "node:fs";
import path from "node:path";
import { solveNineSixteenFlyer } from "../dist/packages/layout-engine/src/index.js";
import { createFlyerRenderSpec, renderSvg } from "../dist/packages/renderer/src/index.js";
import { bindRasterAsset } from "../dist/packages/asset-binding/src/index.js";

const PNG_1PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlZ4QAAAABJRU5ErkJggg==";

const layout = solveNineSixteenFlyer({
  headlineProminence: "VERY_HIGH",
  headlineZone: "UPPER_LEFT",
  heroZone: "CENTER",
  negativeSpace: "HIGH",
  textDensity: "LOW",
  alignment: "LEFT_DOMINANT"
});

const base = createFlyerRenderSpec(layout, {
  eyebrow: "VISUAL 4D STUDIO",
  headline: "Assets con procedencia antes del render",
  body: ["Binding controlado", "Raster seguro", "Reglas MASTER/documentales preservadas"],
  footer: "Sprint 3.2 — referencia técnica"
});

const spec = bindRasterAsset(base, {
  elementId: "hero",
  assetId: "asset_ci_reference",
  sourceType: "INSTITUTIONAL_ASSET",
  generatedByAI: false,
  documentary: false,
  approved: true,
  approvedAt: "2026-08-30T00:00:00.000Z",
  mediaType: "image/png",
  dataUri: PNG_1PX
});

const outDir = path.resolve("certification/samples");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "sprint3_2_asset_reference.svg");
fs.writeFileSync(outPath, renderSvg(spec), "utf8");
console.log(outPath);
