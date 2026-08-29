import { z } from "zod";

export const ProjectTypeSchema = z.enum([
  "FLYER",
  "CAROUSEL",
  "BANNER",
  "COVER",
  "INFOGRAPHIC",
  "DOCUMENT"
]);

export const AssetTypeSchema = z.enum([
  "LOGO",
  "BANNER",
  "PHOTO_DOCUMENTARY",
  "PHOTO_INSTITUTIONAL",
  "GENERATED_IMAGE",
  "ILLUSTRATION",
  "DECORATIVE",
  "ICON",
  "BACKGROUND",
  "SOURCE_DOCUMENT",
  "REFERENCE_DESIGN"
]);

export const AssetStatusSchema = z.enum(["ACTIVE", "ARCHIVED", "REVOKED"]);
export const InstitutionStatusSchema = z.enum(["ACTIVE", "ARCHIVED"]);
export const IdentityStatusSchema = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);
export const MemoryScopeSchema = z.enum(["PROJECT_ONLY", "PROJECT_TYPE_RULE", "INSTITUTION_RULE"]);

export const ProjectStageSchema = z.enum([
  "DRAFT",
  "ANALYZING",
  "ANALYSIS_REVIEW",
  "STRUCTURING",
  "STRUCTURE_REVIEW",
  "RESOLVING_RESOURCES",
  "RESOURCES_REVIEW",
  "ART_DIRECTING",
  "ART_DIRECTION_REVIEW",
  "GENERATING",
  "GENERATED",
  "VERIFYING",
  "VERIFICATION_REVIEW",
  "APPROVED",
  "FINAL",
  "ARCHIVED"
]);

export const ProvenanceSchema = z.object({
  sourceType: z.enum([
    "USER_INPUT",
    "SOURCE_DOCUMENT",
    "MASTER_ASSET",
    "DOCUMENTARY_ASSET",
    "INSTITUTIONAL_ASSET",
    "GENERATED_ASSET",
    "APPROVED_STRUCTURE",
    "SYSTEM_DERIVED"
  ]),
  sourceId: z.string().nullable(),
  generatedByAI: z.boolean(),
  documentary: z.boolean(),
  approved: z.boolean(),
  approvedAt: z.string().datetime().nullable()
}).superRefine((p, ctx) => {
  if (p.approved !== (p.approvedAt !== null)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["approvedAt"], message: "PROVENANCE_APPROVAL_TIMESTAMP_MISMATCH" });
  }
  if (["MASTER_ASSET","DOCUMENTARY_ASSET","INSTITUTIONAL_ASSET","GENERATED_ASSET","SOURCE_DOCUMENT","APPROVED_STRUCTURE"].includes(p.sourceType) && !p.sourceId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["sourceId"], message: "PROVENANCE_SOURCE_ID_REQUIRED" });
  }
  if (p.generatedByAI && p.documentary) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["documentary"], message: "GENERATED_CANNOT_BE_DOCUMENTARY" });
  }
});

export const InstitutionSchema = z.object({
  id: z.string(),
  ownerUserId: z.string(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable(),
  status: InstitutionStatusSchema,
  activeIdentityVersionId: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const IdentityVersionSchema = z.object({
  id: z.string(),
  institutionId: z.string(),
  versionNumber: z.number().int().positive(),
  name: z.string().min(1).max(200),
  status: IdentityStatusSchema,
  createdAt: z.string().datetime(),
  activatedAt: z.string().datetime().nullable(),
  archivedAt: z.string().datetime().nullable()
});

export const AssetSchema = z.object({
  id: z.string(),
  institutionId: z.string(),
  ownerUserId: z.string(),
  type: AssetTypeSchema,
  name: z.string().min(1),
  isMaster: z.boolean(),
  generativeEditAllowed: z.boolean(),
  currentVersionId: z.string(),
  status: AssetStatusSchema
}).superRefine((asset: any, ctx: any) => {
  if (asset.isMaster && asset.generativeEditAllowed) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["generativeEditAllowed"],
      message: "MASTER_ASSET_GENERATIVE_EDIT_FORBIDDEN"
    });
  }
});

export const AssetVersionSchema = z.object({
  id: z.string(),
  assetId: z.string(),
  versionNumber: z.number().int().positive(),
  storageKey: z.string().min(1),
  mimeType: z.string().min(1),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  status: AssetStatusSchema,
  createdAt: z.string().datetime()
});

export const ProjectSchema = z.object({
  id: z.string(),
  ownerUserId: z.string(),
  institutionId: z.string(),
  identityVersionId: z.string(),
  type: ProjectTypeSchema,
  title: z.string().min(1).max(300),
  objective: z.string().nullable(),
  audience: z.string().nullable(),
  format: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    orientation: z.enum(["PORTRAIT", "LANDSCAPE"])
  }),
  currentStage: ProjectStageSchema,
  status: z.enum(["DRAFT", "ACTIVE", "APPROVED", "FINAL", "ARCHIVED"])
});

export const ApprovalSchema = z.object({
  projectId: z.string(),
  stage: ProjectStageSchema,
  artifactType: z.enum(["ANALYSIS", "STRUCTURE", "RESOURCES", "ART_DIRECTION", "VERIFICATION", "DESIGN"]),
  artifactVersionId: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED", "REVISION_REQUESTED"]),
  decidedAt: z.string().datetime()
});

export const LayoutIntentSchema = z.object({
  headline: z.object({
    prominence: z.enum(["LOW", "MEDIUM", "HIGH", "VERY_HIGH"]),
    preferredZone: z.enum(["UPPER_LEFT", "UPPER_CENTER", "UPPER_RIGHT", "CENTER_LEFT", "CENTER", "CENTER_RIGHT"])
  }),
  heroMedia: z.object({
    prominence: z.enum(["LOW", "MEDIUM", "HIGH", "VERY_HIGH"]),
    preferredZone: z.enum(["UPPER", "CENTER", "LOWER", "LEFT", "RIGHT"])
  }).nullable(),
  negativeSpace: z.enum(["LOW", "MEDIUM", "HIGH"]),
  textDensity: z.enum(["LOW", "MEDIUM", "HIGH"]),
  alignment: z.enum(["LEFT_DOMINANT", "CENTERED", "RIGHT_DOMINANT", "BALANCED"]),
  finish: z.enum(["CLEAN_DIGITAL", "PREMIUM_EDITORIAL_SUBTLE_GLOSS"])
});

export type Institution = ReturnType<typeof InstitutionSchema["parse"]>;
export type IdentityVersion = ReturnType<typeof IdentityVersionSchema["parse"]>;
export type Asset = ReturnType<typeof AssetSchema["parse"]>;
export type AssetVersion = ReturnType<typeof AssetVersionSchema["parse"]>;
export type Project = ReturnType<typeof ProjectSchema["parse"]>;
export type Provenance = ReturnType<typeof ProvenanceSchema["parse"]>;
export type LayoutIntent = ReturnType<typeof LayoutIntentSchema["parse"]>;
export type ProjectStage = ReturnType<typeof ProjectStageSchema["parse"]>;
export type Approval = ReturnType<typeof ApprovalSchema["parse"]>;
