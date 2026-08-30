import test from "node:test";
import assert from "node:assert/strict";
import { Visual4DRenderService, renderVisual4DFlyer } from "../../dist/packages/render-service/src/index.js";

const PNG_1PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlZ4QAAAABJRU5ErkJggg==";
const request = {
  intent: { headlineProminence:"VERY_HIGH", headlineZone:"UPPER_LEFT", heroZone:"CENTER", negativeSpace:"HIGH", textDensity:"LOW", alignment:"LEFT_DOMINANT" },
  content: { eyebrow:"VISUAL 4D STUDIO", headline:"Servicio de render determinista", body:["Layout","Asset binding","Identidad","SVG"], footer:"Sprint 3.4" },
  identity: { version:"visual4d.identity.v1", colors:{ background:"#FFFFFF", primary:"#173B57", text:"#111827", mutedText:"#4B5563", heroSurface:"#E8EDF2" }, typography:{ family:"SYSTEM_SANS" } },
  heroAsset: { elementId:"hero", assetId:"asset_service_001", sourceType:"INSTITUTIONAL_ASSET", generatedByAI:false, documentary:false, approved:true, approvedAt:"2026-08-30T00:00:00.000Z", mediaType:"image/png", dataUri:PNG_1PX }
};

test("Sprint 3.4 render service is deterministic",()=>{const a=renderVisual4DFlyer(request),b=renderVisual4DFlyer(request);assert.deepEqual(a,b);assert.equal(a.version,"visual4d.render-service.v1");});
test("Sprint 3.4 composes all visual pipeline layers",()=>{const result=new Visual4DRenderService().render(request);assert.equal(result.layout.canvas.width,1080);assert.equal(result.renderSpec.version,"visual4d.render.v1");assert.match(result.svg,/data-asset-id="asset_service_001"/);assert.match(result.svg,/fill="#173B57"/);assert.equal(result.assets[0]?.assetId,"asset_service_001");});
test("Sprint 3.4 supports safe no-image render",()=>{const {heroAsset,...withoutAsset}=request;const result=renderVisual4DFlyer(withoutAsset);assert.deepEqual(result.assets,[]);assert.doesNotMatch(result.svg,/data-asset-id=/);});
test("Sprint 3.4 propagates provenance failures",()=>{const bad={...request,heroAsset:{...request.heroAsset,sourceType:"GENERATED_ASSET",generatedByAI:true,documentary:true}};assert.throws(()=>renderVisual4DFlyer(bad),/GENERATED_CANNOT_BE_DOCUMENTARY/);});
test("Sprint 3.4 propagates accessibility failures",()=>{const bad={...request,identity:{...request.identity,colors:{...request.identity.colors,primary:"#EEEEEE"}}};assert.throws(()=>renderVisual4DFlyer(bad),/PRIMARY_BACKGROUND_CONTRAST_LOW/);});
test("Sprint 3.4 rejects missing headline",()=>{const bad={...request,content:{...request.content,headline:"   "}};assert.throws(()=>renderVisual4DFlyer(bad),/HEADLINE_REQUIRED/);});
