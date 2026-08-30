import fs from "node:fs";
import path from "node:path";
import { renderVisual4DFlyer } from "../dist/packages/render-service/src/index.js";

const PNG_1PX="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlZ4QAAAABJRU5ErkJggg==";
const result=renderVisual4DFlyer({
 intent:{headlineProminence:"VERY_HIGH",headlineZone:"UPPER_LEFT",heroZone:"CENTER",negativeSpace:"HIGH",textDensity:"LOW",alignment:"LEFT_DOMINANT"},
 content:{eyebrow:"VISUAL 4D STUDIO",headline:"Una frontera única para producir la pieza",body:["Layout","Assets","Identidad","Render"],footer:"Sprint 3.4 — servicio de aplicación"},
 identity:{version:"visual4d.identity.v1",colors:{background:"#FFFFFF",primary:"#173B57",text:"#111827",mutedText:"#4B5563",heroSurface:"#E8EDF2"},typography:{family:"SYSTEM_SANS"}},
 heroAsset:{elementId:"hero",assetId:"asset_render_service_reference",sourceType:"INSTITUTIONAL_ASSET",generatedByAI:false,documentary:false,approved:true,approvedAt:"2026-08-30T00:00:00.000Z",mediaType:"image/png",dataUri:PNG_1PX}
});
const outDir=path.resolve("certification/samples");fs.mkdirSync(outDir,{recursive:true});
fs.writeFileSync(path.join(outDir,"sprint3_4_service_reference.svg"),result.svg,"utf8");
fs.writeFileSync(path.join(outDir,"sprint3_4_service_reference.json"),JSON.stringify({version:result.version,canvas:result.layout.canvas,renderVersion:result.renderSpec.version,assets:result.assets,svgBytes:Buffer.byteLength(result.svg,"utf8")},null,2)+"\n","utf8");
