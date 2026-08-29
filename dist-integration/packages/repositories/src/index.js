export class MemoryProjectRepository {
    institutions = new Map();
    identities = new Map();
    projects = new Map();
    assets = new Map();
    assetVersions = new Map();
    artifacts = new Map();
    approvals = new Map();
    counters = new Map();
    idempotency = new Map();
    inFlight = new Map();
    seed(input) {
        for (const r of input.institutions ?? [])
            this.institutions.set(r.id, structuredClone(r));
        for (const r of input.identities ?? [])
            this.identities.set(r.id, structuredClone(r));
        for (const r of input.projects ?? [])
            this.projects.set(r.id, structuredClone({ ...r, revision: r.revision ?? 0, finalDesignVersionId: r.finalDesignVersionId ?? null }));
        for (const r of input.assets ?? [])
            this.assets.set(r.id, structuredClone(r));
        for (const r of input.assetVersions ?? [])
            this.assetVersions.set(r.id, structuredClone(r));
    }
    async getInstitution(id) { return structuredClone(this.institutions.get(id) ?? null); }
    async saveInstitution(record) { this.institutions.set(record.id, structuredClone(record)); }
    async getIdentityVersion(id) { return structuredClone(this.identities.get(id) ?? null); }
    async listIdentityVersions(institutionId) { return [...this.identities.values()].filter(x => x.institutionId === institutionId).map(x => structuredClone(x)); }
    async saveIdentityVersion(record) { this.identities.set(record.id, structuredClone(record)); }
    async activateIdentityVersion(institutionId, identityVersionId) {
        const institution = this.institutions.get(institutionId);
        const target = this.identities.get(identityVersionId);
        if (!institution || !target || target.institutionId !== institutionId)
            throw new Error("IDENTITY_ACTIVATION_MISMATCH");
        for (const [id, item] of this.identities) {
            if (item.institutionId === institutionId)
                this.identities.set(id, { ...item, status: id === identityVersionId ? "ACTIVE" : item.status === "ACTIVE" ? "ARCHIVED" : item.status });
        }
        this.institutions.set(institutionId, { ...institution, activeIdentityVersionId: identityVersionId });
    }
    async getProject(id) { return structuredClone(this.projects.get(id) ?? null); }
    async saveProject(project, expectedRevision) {
        const current = this.projects.get(project.id);
        if (current && expectedRevision !== undefined && current.revision !== expectedRevision)
            throw new Error("PROJECT_REVISION_CONFLICT");
        const next = current ? { ...project, revision: current.revision + 1 } : project;
        this.projects.set(project.id, structuredClone(next));
    }
    async listAssets(institutionId) { return [...this.assets.values()].filter(a => a.institutionId === institutionId).map(a => structuredClone(a)); }
    async getAssetVersion(id) { return structuredClone(this.assetVersions.get(id) ?? null); }
    async createArtifactVersion(input) {
        const key = `${input.projectId}:${input.kind}`;
        const versionNumber = (this.counters.get(key) ?? 0) + 1;
        this.counters.set(key, versionNumber);
        const id = `${input.kind.toLowerCase()}_${input.projectId}_v${versionNumber}`;
        const record = { ...input, id, versionNumber };
        this.artifacts.set(id, structuredClone(record));
        return structuredClone(record);
    }
    async getArtifactVersion(id) { return structuredClone(this.artifacts.get(id) ?? null); }
    async getLatestArtifact(projectId, kind) {
        const items = [...this.artifacts.values()].filter(a => a.projectId === projectId && a.kind === kind).sort((a, b) => b.versionNumber - a.versionNumber);
        return structuredClone(items[0] ?? null);
    }
    async saveApproval(approval) { this.approvals.set(`${approval.projectId}:${approval.artifactKind}`, structuredClone(approval)); }
    async getApprovedVersion(projectId, kind) {
        const a = this.approvals.get(`${projectId}:${kind}`);
        return a?.decision === "APPROVED" && a.origin === "USER_APPROVED" ? a.artifactVersionId : null;
    }
    ik(requestId, actorUserId, operation) { return `${actorUserId}:${operation}:${requestId}`; }
    async getIdempotency(requestId, actorUserId, operation) {
        return structuredClone(this.idempotency.get(this.ik(requestId, actorUserId, operation)) ?? null);
    }
    async saveIdempotency(record) {
        this.idempotency.set(this.ik(record.requestId, record.actorUserId, record.operation), structuredClone(record));
    }
    async runIdempotentMutation(input, action) {
        const key = this.ik(input.requestId, input.actorUserId, input.operation);
        const existing = this.idempotency.get(key);
        if (existing?.status === "COMPLETED")
            return structuredClone(existing.result);
        const active = this.inFlight.get(key);
        if (active)
            return structuredClone(await active);
        const promise = (async () => {
            this.idempotency.set(key, { ...input, status: "IN_PROGRESS", result: null });
            try {
                const result = await action();
                this.idempotency.set(key, { ...input, status: "COMPLETED", result: structuredClone(result) });
                return result;
            }
            catch (error) {
                const code = error instanceof Error ? error.message : String(error);
                this.idempotency.set(key, { ...input, status: "FAILED_RETRYABLE", result: null, errorCode: code });
                throw error;
            }
            finally {
                this.inFlight.delete(key);
            }
        })();
        this.inFlight.set(key, promise);
        return structuredClone(await promise);
    }
}
