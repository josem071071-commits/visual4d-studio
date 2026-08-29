import { assertMasterAssetUsable, assertOwnerMatchesInstitution, assertSameInstitution, requirePortraitNineSixteen } from "../../domain/src/index.js";
import { transition } from "../../state-machine/src/index.js";
export class ServiceError extends Error {
    code;
    constructor(code, message) {
        super(message ?? code);
        this.code = code;
        this.name = "ServiceError";
    }
}
function v(currentVersionId, approvedVersionId) { return { currentVersionId, approvedVersionId }; }
export class ProjectWorkflowService {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    assertActor(actor, ownerUserId) {
        if (!actor.permissions.includes("visual4d:write"))
            throw new ServiceError("VISUAL4D_WRITE_PERMISSION_REQUIRED");
        if (actor.userId !== ownerUserId)
            throw new ServiceError("FORBIDDEN_PROJECT_OWNER_MISMATCH");
    }
    async loadProjectContext(projectId, actor) {
        const project = await this.repo.getProject(projectId);
        if (!project)
            throw new ServiceError("PROJECT_NOT_FOUND");
        this.assertActor(actor, project.ownerUserId);
        const institution = await this.repo.getInstitution(project.institutionId);
        if (!institution)
            throw new ServiceError("INSTITUTION_NOT_FOUND");
        this.assertActor(actor, institution.ownerUserId);
        const identity = await this.repo.getIdentityVersion(project.identityVersionId);
        if (!identity)
            throw new ServiceError("IDENTITY_VERSION_NOT_FOUND");
        assertSameInstitution(project.institutionId, identity.institutionId);
        assertOwnerMatchesInstitution(project.ownerUserId, institution.ownerUserId);
        requirePortraitNineSixteen(project.width, project.height);
        if (project.orientation !== "PORTRAIT")
            throw new ServiceError("FORMAT_NOT_PORTRAIT");
        return { project, institution, identity };
    }
    async once(ctx, operation, action) {
        return this.repo.runIdempotentMutation({ requestId: ctx.requestId, actorUserId: ctx.actor.userId, operation }, action);
    }
    async snapshot(projectId) {
        const kinds = ["ANALYSIS", "STRUCTURE", "RESOURCES", "ART_DIRECTION", "VERIFICATION"];
        const latest = new Map();
        const approved = new Map();
        for (const kind of kinds) {
            latest.set(kind, (await this.repo.getLatestArtifact(projectId, kind))?.id ?? null);
            approved.set(kind, await this.repo.getApprovedVersion(projectId, kind));
        }
        const verification = await this.repo.getLatestArtifact(projectId, "VERIFICATION");
        const payload = verification?.payload;
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
    async move(project, to) {
        const approvals = await this.snapshot(project.id);
        const next = transition(project.currentStage, to, approvals);
        const updated = { ...project, currentStage: next, status: next === "FINAL" ? "FINAL" : next === "APPROVED" ? "APPROVED" : next === "ARCHIVED" ? "ARCHIVED" : "ACTIVE" };
        await this.repo.saveProject(updated, project.revision);
        const reread = await this.repo.getProject(project.id);
        if (!reread)
            throw new ServiceError("PROJECT_NOT_FOUND_AFTER_SAVE");
        return reread;
    }
    async startAnalysis(projectId, sourceContent, ctx) {
        return this.once(ctx, `analysis:${projectId}`, async () => {
            const { project } = await this.loadProjectContext(projectId, ctx.actor);
            let p = project;
            if (p.currentStage === "DRAFT")
                p = await this.move(p, "ANALYZING");
            if (p.currentStage !== "ANALYZING")
                throw new ServiceError("ANALYSIS_STAGE_REQUIRED");
            const artifact = await this.repo.createArtifactVersion({ projectId, kind: "ANALYSIS", payload: { sourceContent, objective: null, essentialInformation: [], missingInformation: [] } });
            await this.move(p, "ANALYSIS_REVIEW");
            return artifact;
        });
    }
    async validateApprovalCandidate(projectId, kind, artifactVersionId, actor) {
        const { project } = await this.loadProjectContext(projectId, actor);
        const artifact = await this.repo.getArtifactVersion(artifactVersionId);
        if (!artifact || artifact.projectId !== projectId || artifact.kind !== kind)
            throw new ServiceError("ARTIFACT_VERSION_MISMATCH");
        const latest = await this.repo.getLatestArtifact(projectId, kind);
        if (!latest || latest.id !== artifactVersionId)
            throw new ServiceError("STALE_ARTIFACT_CANNOT_BE_APPROVED");
        const expectedStage = {
            ANALYSIS: "ANALYSIS_REVIEW", STRUCTURE: "STRUCTURE_REVIEW", RESOURCES: "RESOURCES_REVIEW", ART_DIRECTION: "ART_DIRECTION_REVIEW", VERIFICATION: "VERIFICATION_REVIEW"
        };
        const stage = expectedStage[kind];
        if (stage && project.currentStage !== stage)
            throw new ServiceError("ARTIFACT_NOT_AWAITING_APPROVAL");
        return { project, artifact };
    }
    async approve(projectId, kind, artifactVersionId, ctx) {
        return this.once(ctx, `approve:${projectId}:${kind}:${artifactVersionId}`, async () => {
            const { project } = await this.loadProjectContext(projectId, ctx.actor);
            const artifact = await this.repo.getArtifactVersion(artifactVersionId);
            if (!artifact || artifact.projectId !== projectId || artifact.kind !== kind)
                throw new ServiceError("ARTIFACT_VERSION_MISMATCH");
            const latest = await this.repo.getLatestArtifact(projectId, kind);
            if (!latest || latest.id !== artifactVersionId)
                throw new ServiceError("STALE_ARTIFACT_CANNOT_BE_APPROVED");
            await this.repo.saveApproval({ projectId, artifactKind: kind, artifactVersionId, decision: "APPROVED", origin: "USER_APPROVED", approvedByUserId: ctx.actor.userId, approvedAt: new Date().toISOString() });
            return { approved: true, projectId, kind, artifactVersionId, projectRevision: project.revision };
        });
    }
    async structure(projectId, payload, ctx) {
        return this.once(ctx, `structure:${projectId}`, async () => {
            const { project } = await this.loadProjectContext(projectId, ctx.actor);
            const moved = await this.move(project, "STRUCTURING");
            const artifact = await this.repo.createArtifactVersion({ projectId, kind: "STRUCTURE", payload });
            await this.move(moved, "STRUCTURE_REVIEW");
            return artifact;
        });
    }
    requiredResourceTypes(projectType) {
        if (projectType === "FLYER")
            return ["LOGO", "BANNER", "HERO_MEDIA"];
        return ["LOGO", "BANNER"];
    }
    async resolveResources(projectId, ctx) {
        return this.once(ctx, `resources:${projectId}`, async () => {
            const { project, institution } = await this.loadProjectContext(projectId, ctx.actor);
            const moved = await this.move(project, "RESOLVING_RESOURCES");
            const assets = await this.repo.listAssets(institution.id);
            const selected = [];
            for (const asset of assets) {
                assertSameInstitution(project.institutionId, asset.institutionId);
                assertOwnerMatchesInstitution(asset.ownerUserId, institution.ownerUserId);
                if (asset.isMaster) {
                    assertMasterAssetUsable({ isMaster: true, status: asset.status });
                    const current = await this.repo.getAssetVersion(asset.currentVersionId);
                    if (!current || current.assetId !== asset.id || current.status !== "ACTIVE")
                        throw new ServiceError("MASTER_ASSET_CURRENT_VERSION_NOT_ACTIVE");
                }
                if (asset.status === "ACTIVE")
                    selected.push({ id: asset.id, type: asset.type, isMaster: asset.isMaster });
            }
            const requirements = this.requiredResourceTypes(project.projectType);
            const found = new Set(selected.map(x => x.type));
            const hasHero = selected.some(x => ["PHOTO_DOCUMENTARY", "PHOTO_INSTITUTIONAL", "GENERATED_IMAGE", "ILLUSTRATION"].includes(x.type));
            const missingResources = requirements.filter(r => r === "HERO_MEDIA" ? !hasHero : !found.has(r)).map(type => ({ type, reason: `Required for ${project.projectType}` }));
            const artifact = await this.repo.createArtifactVersion({ projectId, kind: "RESOURCES", payload: { selectedAssets: selected, missingResources } });
            await this.move(moved, "RESOURCES_REVIEW");
            return artifact;
        });
    }
    async artDirect(projectId, payload, ctx) {
        return this.once(ctx, `artdirect:${projectId}`, async () => {
            const { project } = await this.loadProjectContext(projectId, ctx.actor);
            const resources = await this.repo.getLatestArtifact(projectId, "RESOURCES");
            const rp = resources?.payload;
            if ((rp?.missingResources?.length ?? 0) > 0)
                throw new ServiceError("REQUIRED_RESOURCES_MISSING");
            const moved = await this.move(project, "ART_DIRECTING");
            const artifact = await this.repo.createArtifactVersion({ projectId, kind: "ART_DIRECTION", payload });
            await this.move(moved, "ART_DIRECTION_REVIEW");
            return artifact;
        });
    }
    async createDesignVersion(projectId, payload, ctx) {
        return this.once(ctx, `design:${projectId}`, async () => {
            const { project } = await this.loadProjectContext(projectId, ctx.actor);
            let p = project;
            if (p.currentStage === "ART_DIRECTION_REVIEW")
                p = await this.move(p, "GENERATING");
            if (p.currentStage !== "GENERATING")
                throw new ServiceError("GENERATING_STAGE_REQUIRED");
            const artifact = await this.repo.createArtifactVersion({ projectId, kind: "DESIGN", payload });
            await this.move(p, "GENERATED");
            return artifact;
        });
    }
    async saveVerification(projectId, payload, ctx) {
        return this.once(ctx, `verification:${projectId}:${payload.designVersionId}`, async () => {
            const { project } = await this.loadProjectContext(projectId, ctx.actor);
            const design = await this.repo.getArtifactVersion(payload.designVersionId);
            const latestDesign = await this.repo.getLatestArtifact(projectId, "DESIGN");
            if (!design || design.kind !== "DESIGN" || design.projectId !== projectId || latestDesign?.id !== payload.designVersionId)
                throw new ServiceError("DESIGN_VERSION_MISMATCH");
            if (project.currentStage !== "GENERATED")
                throw new ServiceError("GENERATED_STAGE_REQUIRED");
            const verifying = await this.move(project, "VERIFYING");
            const artifact = await this.repo.createArtifactVersion({ projectId, kind: "VERIFICATION", payload });
            await this.move(verifying, "VERIFICATION_REVIEW");
            return artifact;
        });
    }
    async approveDesign(projectId, verificationVersionId, ctx) {
        return this.once(ctx, `final:${projectId}:${verificationVersionId}`, async () => {
            const approvedVerification = await this.repo.getApprovedVersion(projectId, "VERIFICATION");
            if (approvedVerification !== verificationVersionId)
                throw new ServiceError("EXPLICIT_VERIFICATION_APPROVAL_REQUIRED");
            const verification = await this.repo.getArtifactVersion(verificationVersionId);
            const vp = verification?.payload;
            if (!vp?.designVersionId)
                throw new ServiceError("VERIFICATION_DESIGN_REFERENCE_REQUIRED");
            const design = await this.repo.getArtifactVersion(vp.designVersionId);
            if (!design || design.kind !== "DESIGN" || design.projectId !== projectId)
                throw new ServiceError("VERIFIED_DESIGN_NOT_FOUND");
            const { project } = await this.loadProjectContext(projectId, ctx.actor);
            const approved = await this.move(project, "APPROVED");
            const final = await this.move(approved, "FINAL");
            await this.repo.saveProject({ ...final, finalDesignVersionId: design.id }, final.revision);
            return this.repo.getProject(projectId);
        });
    }
    async activateIdentity(institutionId, identityVersionId, ctx) {
        return this.once(ctx, `identity-activate:${institutionId}:${identityVersionId}`, async () => {
            const institution = await this.repo.getInstitution(institutionId);
            if (!institution)
                throw new ServiceError("INSTITUTION_NOT_FOUND");
            this.assertActor(ctx.actor, institution.ownerUserId);
            const identity = await this.repo.getIdentityVersion(identityVersionId);
            if (!identity || identity.institutionId !== institutionId)
                throw new ServiceError("IDENTITY_ACTIVATION_MISMATCH");
            await this.repo.activateIdentityVersion(institutionId, identityVersionId);
            return { institutionId, activeIdentityVersionId: identityVersionId };
        });
    }
}
