export type ProvenanceSource =
  | "USER_INPUT"
  | "SOURCE_DOCUMENT"
  | "MASTER_ASSET"
  | "DOCUMENTARY_ASSET"
  | "INSTITUTIONAL_ASSET"
  | "GENERATED_ASSET"
  | "APPROVED_STRUCTURE"
  | "SYSTEM_DERIVED";

export interface ProvenanceRecord {
  elementId: string;
  sourceType: ProvenanceSource;
  sourceId: string | null;
  generatedByAI: boolean;
  documentary: boolean;
  approved: boolean;
  approvedAt: string | null;
}

export function validateProvenance(record: ProvenanceRecord): string[] {
  const errors: string[] = [];
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
