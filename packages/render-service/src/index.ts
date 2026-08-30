import type { LayoutIntent, LayoutSpec } from "../../layout-engine/src/index.js";
import { solveNineSixteenFlyer } from "../../layout-engine/src/index.js";
import type { FlyerRenderContent, RenderSpec } from "../../renderer/src/index.js";
import { createFlyerRenderSpec, renderSvg, validateRenderSpec } from "../../renderer/src/index.js";
import type { RasterAssetBinding } from "../../asset-binding/src/index.js";
import { bindRasterAsset } from "../../asset-binding/src/index.js";
import type { VisualIdentityTokens } from "../../identity-style/src/index.js";
import { applyIdentityTokens } from "../../identity-style/src/index.js";

export interface Visual4DRenderRequest {
  intent: LayoutIntent;
  content: FlyerRenderContent;
  identity: VisualIdentityTokens;
  heroAsset?: RasterAssetBinding;
}

export interface RenderedAssetSummary {
  elementId: string;
  assetId: string;
  sourceType: string;
  generatedByAI: boolean;
  documentary: boolean;
  approved: boolean;
}

export interface Visual4DRenderResult {
  version: "visual4d.render-service.v1";
  layout: LayoutSpec;
  renderSpec: RenderSpec;
  svg: string;
  assets: readonly RenderedAssetSummary[];
}

export class Visual4DRenderService {
  render(request: Visual4DRenderRequest): Visual4DRenderResult {
    const layout = solveNineSixteenFlyer(request.intent);
    let renderSpec = createFlyerRenderSpec(layout, request.content);
    const assets: RenderedAssetSummary[] = [];

    if (request.heroAsset !== undefined) {
      renderSpec = bindRasterAsset(renderSpec, request.heroAsset);
      assets.push({
        elementId: request.heroAsset.elementId,
        assetId: request.heroAsset.assetId,
        sourceType: request.heroAsset.sourceType,
        generatedByAI: request.heroAsset.generatedByAI,
        documentary: request.heroAsset.documentary,
        approved: request.heroAsset.approved
      });
    }

    renderSpec = applyIdentityTokens(renderSpec, request.identity);
    const validation = validateRenderSpec(renderSpec);
    if (!validation.valid) throw new Error(`RENDER_SERVICE_INVALID_SPEC:${validation.errors.join(",")}`);

    return {
      version: "visual4d.render-service.v1",
      layout,
      renderSpec,
      svg: renderSvg(renderSpec),
      assets
    };
  }
}

export function renderVisual4DFlyer(request: Visual4DRenderRequest): Visual4DRenderResult {
  return new Visual4DRenderService().render(request);
}
