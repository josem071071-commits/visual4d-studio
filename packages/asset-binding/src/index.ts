import type { ProvenanceRecord, ProvenanceSource } from "../../provenance/src/index.js";
import { validateProvenance } from "../../provenance/src/index.js";
import type { RenderElement, RenderSpec, SafeRasterMediaType } from "../../renderer/src/index.js";
import { isSafeRasterDataUri } from "../../renderer/src/index.js";

export interface RasterAssetBinding {
  elementId: string;
  assetId: string;
  sourceType: ProvenanceSource;
  generatedByAI: boolean;
  documentary: boolean;
  approved: boolean;
  approvedAt: string | null;
  mediaType: SafeRasterMediaType;
  dataUri: string;
}

export interface AssetBindingValidationResult {
  valid: boolean;
  errors: readonly string[];
}

function provenanceFromBinding(binding: RasterAssetBinding): ProvenanceRecord {
  return {
    elementId: binding.elementId,
    sourceType: binding.sourceType,
    sourceId: binding.assetId,
    generatedByAI: binding.generatedByAI,
    documentary: binding.documentary,
    approved: binding.approved,
    approvedAt: binding.approvedAt
  };
}

export function validateRasterAssetBinding(binding: RasterAssetBinding): AssetBindingValidationResult {
  const errors = [...validateProvenance(provenanceFromBinding(binding))];
  if (!binding.elementId.trim()) errors.push("ELEMENT_ID_REQUIRED");
  if (!binding.assetId.trim()) errors.push("ASSET_ID_REQUIRED");
  if (!isSafeRasterDataUri(binding.mediaType, binding.dataUri)) errors.push("UNSAFE_OR_MISMATCHED_RASTER_DATA_URI");
  if (binding.approvedAt !== null && Number.isNaN(Date.parse(binding.approvedAt))) errors.push("INVALID_APPROVED_AT");
  if (binding.approved && binding.approvedAt === null) errors.push("APPROVED_AT_REQUIRED");
  if (!binding.approved && binding.approvedAt !== null) errors.push("APPROVED_AT_WITHOUT_APPROVAL");
  return { valid: errors.length === 0, errors };
}

export function bindRasterAsset(spec: RenderSpec, binding: RasterAssetBinding): RenderSpec {
  const validation = validateRasterAssetBinding(binding);
  if (!validation.valid) throw new Error(`INVALID_ASSET_BINDING:${validation.errors.join(",")}`);

  const target = spec.elements.find((element) => element.id === binding.elementId);
  if (!target) throw new Error(`RENDER_ELEMENT_NOT_FOUND:${binding.elementId}`);
  if (target.kind !== "rect" || target.role !== "HERO_PLACEHOLDER") throw new Error(`RENDER_ELEMENT_NOT_BINDABLE:${binding.elementId}`);

  const image: RenderElement = {
    kind: "image",
    id: binding.elementId,
    box: target.box,
    role: "HERO_IMAGE",
    mediaType: binding.mediaType,
    dataUri: binding.dataUri,
    assetId: binding.assetId,
    provenance: {
      sourceType: binding.sourceType,
      generatedByAI: binding.generatedByAI,
      documentary: binding.documentary
    }
  };

  return {
    ...spec,
    elements: spec.elements.map((element) => element.id === binding.elementId ? image : element)
  };
}
