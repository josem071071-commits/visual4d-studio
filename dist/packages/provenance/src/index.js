export function validateProvenance(record) {
    const errors = [];
    if (record.generatedByAI && record.documentary) {
        errors.push("GENERATED_CANNOT_BE_DOCUMENTARY");
    }
    if (record.sourceType === "MASTER_ASSET" && record.generatedByAI) {
        errors.push("MASTER_ASSET_CANNOT_BE_GENERATED");
    }
    if (record.sourceType === "DOCUMENTARY_ASSET" && record.generatedByAI) {
        errors.push("DOCUMENTARY_ASSET_CANNOT_BE_GENERATED");
    }
    return errors;
}
