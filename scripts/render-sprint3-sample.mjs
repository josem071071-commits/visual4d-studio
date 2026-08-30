import fs from "node:fs";
import path from "node:path";
import { solveNineSixteenFlyer } from "../dist/packages/layout-engine/src/index.js";
import { createFlyerRenderSpec, renderSvg } from "../dist/packages/renderer/src/index.js";

const layout = solveNineSixteenFlyer({
  headlineProminence: "VERY_HIGH",
  headlineZone: "UPPER_LEFT",
  heroZone: "CENTER",
  negativeSpace: "HIGH",
  textDensity: "LOW",
  alignment: "LEFT_DOMINANT"
});

const spec = createFlyerRenderSpec(layout, {
  eyebrow: "VISUAL 4D STUDIO",
  headline: "Del método a una pieza visual verificable",
  body: ["Layout Solver determinista", "RenderSpec versionado", "Renderer SVG de referencia"],
  heroLabel: "Visual 4D — Sprint 3.1",
  footer: "Referencia técnica generada automáticamente por CI"
});

const outDir = path.resolve("certification/samples");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "sprint3_1_reference.svg");
fs.writeFileSync(outPath, renderSvg(spec), "utf8");
console.log(outPath);
