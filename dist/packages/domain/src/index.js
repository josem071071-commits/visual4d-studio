export class DomainRuleError extends Error {
    code;
    constructor(code, message) {
        super(message ?? code);
        this.code = code;
        this.name = "DomainRuleError";
    }
}
export function enforceAssetPolicy(asset) {
    if (asset.isMaster && asset.generativeEditAllowed) {
        throw new DomainRuleError("MASTER_ASSET_GENERATIVE_EDIT_FORBIDDEN", "A master asset cannot be sent to generative editing.");
    }
    if (asset.generatedByAI && asset.documentary) {
        throw new DomainRuleError("GENERATED_CANNOT_BE_DOCUMENTARY", "An AI-generated image cannot be classified as documentary evidence.");
    }
    if (asset.type === "PHOTO_DOCUMENTARY" && asset.generatedByAI) {
        throw new DomainRuleError("DOCUMENTARY_PHOTO_MUST_NOT_BE_AI_GENERATED", "A documentary photograph must originate from a real source asset.");
    }
}
export function assertMasterAssetUsable(input) {
    if (input.isMaster && input.status !== "ACTIVE") {
        throw new DomainRuleError("MASTER_ASSET_NOT_ACTIVE", "An archived or revoked master asset cannot be selected as the active institutional master.");
    }
}
export function assertSameInstitution(...institutionIds) {
    const unique = new Set(institutionIds);
    if (unique.size > 1) {
        throw new DomainRuleError("CROSS_INSTITUTION_ASSET_ACCESS_FORBIDDEN", "Resources from different institutions cannot be mixed without an explicit migration/import workflow.");
    }
}
export function assertOwnerMatchesInstitution(resourceOwnerUserId, institutionOwnerUserId) {
    if (resourceOwnerUserId !== institutionOwnerUserId) {
        throw new DomainRuleError("OWNER_INSTITUTION_MISMATCH", "The resource owner must match the institution owner in the private-library MVP.");
    }
}
export function requirePortraitNineSixteen(width, height) {
    if (height <= width) {
        throw new DomainRuleError("FORMAT_NOT_PORTRAIT", "Prototype v0.1 requires portrait orientation.");
    }
    const ratio = width / height;
    const expected = 9 / 16;
    if (Math.abs(ratio - expected) > 0.002) {
        throw new DomainRuleError("FORMAT_NOT_9_16", "Prototype v0.1 requires a 9:16 canvas.");
    }
}
