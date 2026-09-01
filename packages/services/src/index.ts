import { createHash, randomUUID } from "node:crypto";
import {
  assertMasterAssetUsable,
  assertOwnerMatchesInstitution,
  assertSameInstitution,
  requirePortraitNineSixteen
} from "../../domain/src/index.js";
import { transition, type ApprovalSnapshot, type ProjectStage } from "../../state-machine/src/index.js";
import type { ActorContext, ArtifactKind, ProjectRecord, ProjectRepository } from "../../repositories/src/index.js";

export class ServiceError extends Error {
  constructor(public readonly code: string, message?: string) {
    super(message ?? code);
    this.name = "ServiceError";
  }
}

export interface MutationContext {
  actor: ActorContext;
  requestId: string;
  expectedProjectRevision?: number;
}

function v(currentVersionId: string | null, approvedVersionId: string | null) { return { currentVersionId, approvedVersionId }; }

export class ProjectWorkflowService {
  constructor(private readonly repo: ProjectRepository) {}

  private assertWrite(actor: ActorContext) {
    if (!actor.permissions.includes("visual4d:write")) throw new ServiceError("VISUAL4D_WRITE_PERMISSION_REQUIRED");
  }

  private assertActor(actor: ActorContext, ownerUserId: string) {
    this.assertWrite(actor);
    if (actor.userId !== ownerUserId) throw new ServiceError("FORBIDDEN_PROJECT_OWNER_MISMATCH");
  }

  private async ensurePersistentActor(actor: ActorContext) {
    const postgresLike = this.repo as ProjectRepository & { pool?: { query(sql:string, params?:unknown[]): Promise<unknown> } };
    if (postgresLike.pool) await postgresLike.pool.query("INSERT INTO users(id) VALUES($1) ON CONFLICT(id) DO NOTHING", [actor.userId]);
  }

  private personalIds(userId: string) {
    const digest = createHash("sha256").update(userId).digest("hex").slice(0, 24);
    return { institutionId: `personal_${digest}`, identityVersionId: `identity_${digest}_v1` };
  }

  async createProject(title: string, ctx: MutationContext, projectType: ProjectRecord["projectType"] = "FLYER") {
    return this.once(ctx, `project-create:${projectType}`, async () => {
      this.assertWrite(ctx.actor);
      await this.ensurePersistentActor(ctx.actor);
      const { institutionId, identityVersionId } = this.personalIds(ctx.actor.userId);
      let institution = await this.repo.getInstitution(institutionId);
      if (institution && institution.ownerUserId !== ctx.actor.userId) throw new ServiceError("FORBIDDEN_PROJECT_OWNER_MISMATCH");
      if (!institution) {
        await this.repo.saveInstitution({ id: institutionId, ownerUserId: ctx.actor.userId, name: "Personal Visual 4D Studio", activeIdentityVersionId: null, status: "ACTIVE" });
        institution = await this.repo.getInstitution(institutionId);
      }
      if (!institution) throw new ServiceError("INSTITUTION_BOOTSTRAP_FAILED");
      let identity = institution.activeIdentityVersionId ? await this.repo.getIdentityVersion(institution.activeIdentityVersionId) : null;
      if (!identity) {
        identity = await this.repo.getIdentityVersion(identityVersionId);
        if (!identity) await this.repo.saveIdentityVersion({ id: identityVersionId, institutionId, versionNumber: 1, status: "ACTIVE" });
        await this.repo.activateIdentityVersion(institutionId, identityVersionId);
        identity = await this.repo.getIdentityVersion(identityVersionId);
      }
      if (!identity || identity.institutionId !== institutionId) throw new ServiceError("IDENTITY_BOOTSTRAP_FAILED");
      const project: ProjectRecord = {
        id: `project_${randomUUID()}`,
        ownerUserId: ctx.actor.userId,
        institutionId,
        identityVersionId: identity.id,
        projectType,
        title,
        width: 1080,
        height: 1920,
        orientation: "PORTRAIT",
        currentStage: "DRAFT",
        status: "DRAFT",
        revision: 0,
        finalDesignVersionId: null
      };
      await this.repo.saveProject(project);
      const saved = await this.repo.getProject(project.id);
      if (!saved) throw new ServiceError("PROJECT_NOT_FOUND_AFTER_SAVE");
      return { projectId: saved.id, name: saved.title, projectType: saved.projectType, status: saved.status, currentStage: saved.currentStage, width: saved.width, height: saved.height, orientation: saved.orientation };
    });
  }

  private async loadProjectContext(projectId: string, actor: ActorContext) {
    const project = await this.repo.getProject(projectId);
    if (!project) throw new ServiceError("PROJECT_NOT_FOUND");
    this.assertActor(actor, project.ownerUserId);
    const institution = await this.repo.getInstitution(project.institutionId);
    if (!institution) throw new ServiceError("INSTITUTION_NOT_FOUND");
    this.assertActor(actor, institution.ownerUserId);
    const identity = await this.repo.getIdentityVersion(project.identityVersionId);
    if (!identity) throw new ServiceError("IDENTITY_VERSION_NOT_FOUND");
    assertSameInstitution(project.institutionId, identity.institutionId);
    assertOwnerMatchesInstitution(project.ownerUserId, institution.ownerUserId);
    requirePortraitNineSixteen(project.width, project.height);
    if (project.orientation !== "PORTRAIT") throw new ServiceError("FORMAT_NOT_PORTRAIT");
    return { project, institution, identity };
  }

  private async once<T>(ctx: MutationContext, operation: string, action: () => Promise<T>): Promise<T> {
    return this.repo.runIdempotentMutation({ requestId: ctx.requestId, actorUserId: ctx.actor.userId, operation }, action);
  }

  private async snapshot(projectId: string): Promise<ApprovalSnapshot> {
    const kinds: ArtifactKind[] = ["ANALYSIS", "STRUCTURE", "RESOURCES", "ART_DIRECTION", "VERIFICATION"];
    const latest = new Map<ArtifactKind, string | null>();
    const approved = new Map<ArtifactKind, string | null>();
    for (const kind of kinds) {
      latest.set(kind, (await this.repo.getLatestArtifact(projectId, kind))?.id ?? null);
      approved.set(kind, await this.repo.getApprovedVersion(projectId, kind));
    }
    const verification = await this.repo.getLatestArtifact(projectId, "VERIFICATION");
    const payload = verification?.payload as { passed?: boolean; criticalErrors?: string[]; designVersionId?: string } | undefined;
    return {
      analysis: v(latest.get("ANALYSIS") ?? null, approved.get("ANALYSIS") ?? null),
      structure: v(latest.get("STRUCTURE") ?? null, approved.get("STRUCTURE") ?? null),
      resources: v(latest.get("RESOURCES") ?? null, approved.get("RESOURCES") ?? null),
      artDirection: v(latest.get("ART_DIRECTION") ?? null, approved.get("ART_DIRECTION") ?? null),
      verification: v(latest.get("VERIFICATION") ?? null, approved.get("VERIFICATION") ?? null),
      verificationPassed: payload?.passed === true,
      criticalErrors: payload?.criticalErrors ?? []
    };
  }

  private async move(project: ProjectRecord, to: ProjectStage): Promise<ProjectRecord> {
    const approvals = await this.snapshot(project.id);
    const next = transition(project.currentStage as ProjectStage, to, approvals);
    const updated: ProjectRecord = { ...project, currentStage: next, status: next === "FINAL" ? "FINAL" : next === "APPROVED" ? "APPROVED" : next === "ARCHIVED" ? "ARCHIVED" : "ACTIVE" };
    await this.repo.saveProject(updated, project.revision);
    const reread = await this.repo.getProject(project.id);
    if (!reread) throw new ServiceError("PROJECT_NOT_FOUND_AFTER_SAVE");
    return reread;
  }

  async startAnalysis(projectId: string, sourceContent: string, ctx: MutationContext) {
    return this.once(ctx, `analysis:${projectId}`, async () => {
      const { project } = await this.loadProjectContext(projectId, ctx.actor);
      let p = project;
      if (p.currentStage === "DRAFT") p = await this.move(p, "ANALYZING");
      if (p.currentStage !== "ANALYZING") throw new ServiceError("ANALYSIS_STAGE_REQUIRED");
      const artifact = await this.repo.createArtifactVersion({ projectId, kind: "ANALYSIS", payload: { sourceContent, objective: null, essentialInformation: [], missingInformation: [] } });
      await this.move(p, "ANALYSIS_REVIEW");
      return artifact;
    });
  }

  async validateApprovalCandidate(projectId: string, kind: ArtifactKind, artifactVersionId: string, actor: ActorContext) {
    const { project } = await this.loadProjectContext(projectId, actor);
    const artifact = await this.repo.getArtifactVersion(artifactVersionId);
    if (!artifact || artifact.projectId !== projectId || artifact.kind !== kind) throw new ServiceError("ARTIFACT_VERSION_MISMATCH");
    const latest = await this.repo.getLatestArtifact(projectId, kind);
    if (!latest || latest.id !== artifactVersionId) throw new ServiceError("STALE_ARTIFACT_CANNOT_BE_APPROVED");
    const expectedStage: Partial<Record<ArtifactKind,string>> = {
      ANALYSIS:"ANALYSIS_REVIEW", STRUCTURE:"STRUCTURE_REVIEW", RESOURCES:"RESOURCES_REVIEW", ART_DIRECTION:"ART_DIRECTION_REVIEW", VERIFICATION:"VERIFICATION_REVIEW"
    };
    const stage=expectedStage[kind];
    if(stage && project.currentStage!==stage) throw new ServiceError("ARTIFACT_NOT_AWAITING_APPROVAL");
    return {project,artifact};
  }

  async approve(projectId: string, kind: ArtifactKind, artifactVersionId: string, ctx: MutationContext) {
    return this.once(ctx, `approve:${projectId}:${kind}:${artifactVersionId}`, async () => {
      const { project } = await this.loadProjectContext(projectId, ctx.actor);
      const artifact = await this.repo.getArtifactVersion(artifactVersionId);
      if (!artifact || artifact.projectId !== projectId || artifact.kind !== kind) throw new ServiceError("ARTIFACT_VERSION_MISMATCH");
      const latest = await this.repo.getLatestArtifact(projectId, kind);
      if (!latest || latest.id !== artifactVersionId) throw new ServiceError("STALE_ARTIFACT_CANNOT_BE_APPROVED");
      await this.repo.saveApproval({ projectId, artifactKind: kind, artifactVersionId, decision: "APPROVED", origin: "USER_APPROVED", approvedByUserId: ctx.actor.userId, approvedAt: new Date().toISOString() });
      return { approved: true, projectId, kind, artifactVersionId, projectRevision: project.revision };
    });
  }

  async structure(projectId: string, payload: unknown, ctx: MutationContext) {
    return this.once(ctx, `structure:${projectId}`, async () => {
      const { project } = await this.loadProjectContext(projectId, ctx.actor);
      const moved = await this.move(project, "STRUCTURING");
      const artifact = await this.repo.createArtifactVersion({ projectId, kind: "STRUCTURE", payload });
      await this.move(moved, "STRUCTURE_REVIEW");
      return artifact;
    });
  }

  private requiredResourceTypes(projectType: ProjectRecord["projectType"]) {
    if (projectType === "FLYER") return ["LOGO", "BANNER", "HERO_MEDIA"] as const;
    return ["LOGO", "BANNER"] as const;
  }

  async resolveResources(projectId: string, ctx: MutationContext) {
    return this.once(ctx, `resources:${projectId}`, async () => {
      const { project, institution } = await this.loadProjectContext(projectId, ctx.actor);
      const moved = await this.move(project, "RESOLVING_RESOURCES");
      const assets = await this.repo.listAssets(institution.id);
      const selected: { id: string; type: string; isMaster: boolean }[] = [];
      for (const asset of assets) {
        assertSameInstitution(project.institutionId, asset.institutionId);
        assertOwnerMatchesInstitution(asset.ownerUserId, institution.ownerUserId);
        if (asset.isMaster) {
          assertMasterAssetUsable({ isMaster: true, status: asset.status });
          const current = await this.repo.getAssetVersion(asset.currentVersionId);
          if (!current || current.assetId !== asset.id || current.status !== "ACTIVE") throw new ServiceError("MASTER_ASSET_CURRENT_VERSION_NOT_ACTIVE");
        }
        if (asset.status === "ACTIVE") selected.push({ id: asset.id, type: asset.type, isMaster: asset.isMaster });
      }
      const requirements = this.requiredResourceTypes(project.projectType);
      const found = new Set(selected.map(x => x.type));
      const hasHero = selected.some(x => ["PHOTO_DOCUMENTARY","PHOTO_INSTITUTIONAL","GENERATED_IMAGE","ILLUSTRATION"].includes(x.type));
      const missingResources = requirements.filter(r => r === "HERO_MEDIA" ? !hasHero : !found.has(r)).map(type => ({ type, reason: `Required for ${project.projectType}` }));
      const artifact = await this.repo.createArtifactVersion({ projectId, kind: "RESOURCES", payload: { selectedAssets: selected, missingResources } });
      await this.move(moved, "RESOURCES_REVIEW");
      return artifact;
    });
  }

  async artDirect(projectId: string, payload: unknown, ctx: MutationContext) {
    return this.once(ctx, `artdirect:${projectId}`, async () => {
      const { project } = await this.loadProjectContext(projectId, ctx.actor);
      const resources = await this.repo.getLatestArtifact(projectId, "RESOURCES");
      const rp = resources?.payload as { missingResources?: unknown[] } | undefined;
      if ((rp?.missingResources?.length ?? 0) > 0) throw new ServiceError("REQUIRED_RESOURCES_MISSING");
      const moved = await this.move(project, "ART_DIRECTING");
      const artifact = await this.repo.createArtifactVersion({ projectId, kind: "ART_DIRECTION", payload });
      await this.move(moved, "ART_DIRECTION_REVIEW");
      return artifact;
    });
  }

  async createDesignVersion(projectId: string, payload: { renderUri: string; layoutSpecId?: string; checksumSha256?: string }, ctx: MutationContext) {
    return this.once(ctx, `design:${projectId}`, async () => {
      const { project } = await this.loadProjectContext(projectId, ctx.actor);
      let p = project;
      if (p.currentStage === "ART_DIRECTION_REVIEW") p = await this.move(p, "GENERATING");
      if (p.currentStage !== "GENERATING") throw new ServiceError("GENERATING_STAGE_REQUIRED");
      const artifact = await this.repo.createArtifactVersion({ projectId, kind: "DESIGN", payload });
      await this.move(p, "GENERATED");
      return artifact;
    });
  }

  async saveVerification(projectId: string, payload: { designVersionId: string; passed: boolean; criticalErrors: string[]; score: number }, ctx: MutationContext) {
    return this.once(ctx, `verification:${projectId}:${payload.designVersionId}`, async () => {
      const { project } = await this.loadProjectContext(projectId, ctx.actor);
      const design = await this.repo.getArtifactVersion(payload.designVersionId);
      const latestDesign = await this.repo.getLatestArtifact(projectId, "DESIGN");
      if (!design || design.kind !== "DESIGN" || design.projectId !== projectId || latestDesign?.id !== payload.designVersionId) throw new ServiceError("DESIGN_VERSION_MISMATCH");
      if (project.currentStage !== "GENERATED") throw new ServiceError("GENERATED_STAGE_REQUIRED");
      const verifying = await this.move(project, "VERIFYING");
      const artifact = await this.repo.createArtifactVersion({ projectId, kind: "VERIFICATION", payload });
      await this.move(verifying, "VERIFICATION_REVIEW");
      return artifact;
    });
  }

  async approveDesign(projectId: string, verificationVersionId: string, ctx: MutationContext) {
    return this.once(ctx, `final:${projectId}:${verificationVersionId}`, async () => {
      const approvedVerification = await this.repo.getApprovedVersion(projectId, "VERIFICATION");
      if (approvedVerification !== verificationVersionId) throw new ServiceError("EXPLICIT_VERIFICATION_APPROVAL_REQUIRED");
      const verification = await this.repo.getArtifactVersion(verificationVersionId);
      const vp = verification?.payload as { designVersionId?: string; passed?: boolean; criticalErrors?: string[] } | undefined;
      if (!vp?.designVersionId) throw new ServiceError("VERIFICATION_DESIGN_REFERENCE_REQUIRED");
      const design = await this.repo.getArtifactVersion(vp.designVersionId);
      if (!design || design.kind !== "DESIGN" || design.projectId !== projectId) throw new ServiceError("VERIFIED_DESIGN_NOT_FOUND");
      const { project } = await this.loadProjectContext(projectId, ctx.actor);
      const approved = await this.move(project, "APPROVED");
      const final = await this.move(approved, "FINAL");
      await this.repo.saveProject({ ...final, finalDesignVersionId: design.id }, final.revision);
      return this.repo.getProject(projectId);
    });
  }

  async activateIdentity(institutionId: string, identityVersionId: string, ctx: MutationContext) {
    return this.once(ctx, `identity-activate:${institutionId}:${identityVersionId}`, async () => {
      const institution = await this.repo.getInstitution(institutionId);
      if (!institution) throw new ServiceError("INSTITUTION_NOT_FOUND");
      this.assertActor(ctx.actor, institution.ownerUserId);
      const identity = await this.repo.getIdentityVersion(identityVersionId);
      if (!identity || identity.institutionId !== institutionId) throw new ServiceError("IDENTITY_ACTIVATION_MISMATCH");
      await this.repo.activateIdentityVersion(institutionId, identityVersionId);
      return { institutionId, activeIdentityVersionId: identityVersionId };
    });
  }
}
