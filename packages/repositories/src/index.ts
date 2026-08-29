export type ArtifactKind = "ANALYSIS" | "STRUCTURE" | "RESOURCES" | "ART_DIRECTION" | "VERIFICATION" | "DESIGN";
export type Decision = "APPROVED" | "REJECTED" | "REVISION_REQUESTED";
export type ApprovalOrigin = "USER_APPROVED" | "AI_PROPOSED" | "SYSTEM_VALIDATED";

export interface ActorContext {
  userId: string;
  sessionId: string;
  permissions: readonly string[];
}

export interface InstitutionRecord {
  id: string;
  ownerUserId: string;
  name: string;
  activeIdentityVersionId: string | null;
  status: "ACTIVE" | "ARCHIVED";
}

export interface IdentityVersionRecord {
  id: string;
  institutionId: string;
  versionNumber: number;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
}

export interface AssetRecord {
  id: string;
  institutionId: string;
  ownerUserId: string;
  type: string;
  isMaster: boolean;
  generativeEditAllowed: boolean;
  currentVersionId: string;
  status: "ACTIVE" | "ARCHIVED" | "REVOKED";
}

export interface AssetVersionRecord {
  id: string;
  assetId: string;
  status: "ACTIVE" | "ARCHIVED" | "REVOKED";
  checksumSha256: string;
}

export interface ProjectRecord {
  id: string;
  ownerUserId: string;
  institutionId: string;
  identityVersionId: string;
  projectType: "FLYER" | "CAROUSEL" | "BANNER" | "COVER" | "INFOGRAPHIC" | "DOCUMENT";
  title: string;
  width: number;
  height: number;
  orientation: "PORTRAIT" | "LANDSCAPE";
  currentStage: string;
  status: "DRAFT" | "ACTIVE" | "APPROVED" | "FINAL" | "ARCHIVED";
  revision: number;
  finalDesignVersionId: string | null;
}

export interface ArtifactVersionRecord {
  id: string;
  projectId: string;
  kind: ArtifactKind;
  versionNumber: number;
  payload: unknown;
}

export interface DesignVersionRecord extends ArtifactVersionRecord {
  kind: "DESIGN";
  payload: {
    renderUri: string;
    layoutSpecId?: string;
    checksumSha256?: string;
  };
}

export interface ApprovalRecord {
  projectId: string;
  artifactKind: ArtifactKind;
  artifactVersionId: string;
  decision: Decision;
  origin: ApprovalOrigin;
  approvedByUserId: string | null;
  approvedAt: string | null;
}

export type IdempotencyStatus = "IN_PROGRESS" | "COMPLETED" | "FAILED_RETRYABLE";

export interface IdempotencyRecord {
  requestId: string;
  actorUserId: string;
  operation: string;
  status: IdempotencyStatus;
  result: unknown | null;
  errorCode?: string | null;
}

export interface IdempotentMutationInput {
  requestId: string;
  actorUserId: string;
  operation: string;
}

export interface ProjectRepository {
  getInstitution(id: string): Promise<InstitutionRecord | null>;
  saveInstitution(record: InstitutionRecord): Promise<void>;
  getIdentityVersion(id: string): Promise<IdentityVersionRecord | null>;
  listIdentityVersions(institutionId: string): Promise<IdentityVersionRecord[]>;
  saveIdentityVersion(record: IdentityVersionRecord): Promise<void>;
  activateIdentityVersion(institutionId: string, identityVersionId: string): Promise<void>;
  getProject(id: string): Promise<ProjectRecord | null>;
  saveProject(project: ProjectRecord, expectedRevision?: number): Promise<void>;
  listAssets(institutionId: string): Promise<AssetRecord[]>;
  getAssetVersion(id: string): Promise<AssetVersionRecord | null>;
  createArtifactVersion(input: Omit<ArtifactVersionRecord, "id" | "versionNumber">): Promise<ArtifactVersionRecord>;
  getArtifactVersion(id: string): Promise<ArtifactVersionRecord | null>;
  getLatestArtifact(projectId: string, kind: ArtifactKind): Promise<ArtifactVersionRecord | null>;
  saveApproval(approval: ApprovalRecord): Promise<void>;
  getApprovedVersion(projectId: string, kind: ArtifactKind): Promise<string | null>;
  getIdempotency(requestId: string, actorUserId: string, operation: string): Promise<IdempotencyRecord | null>;
  saveIdempotency(record: IdempotencyRecord): Promise<void>;
  runIdempotentMutation<T>(input: IdempotentMutationInput, action: () => Promise<T>): Promise<T>;
}

export class MemoryProjectRepository implements ProjectRepository {
  private institutions = new Map<string, InstitutionRecord>();
  private identities = new Map<string, IdentityVersionRecord>();
  private projects = new Map<string, ProjectRecord>();
  private assets = new Map<string, AssetRecord>();
  private assetVersions = new Map<string, AssetVersionRecord>();
  private artifacts = new Map<string, ArtifactVersionRecord>();
  private approvals = new Map<string, ApprovalRecord>();
  private counters = new Map<string, number>();
  private idempotency = new Map<string, IdempotencyRecord>();
  private inFlight = new Map<string, Promise<unknown>>();

  seed(input: {
    institutions?: InstitutionRecord[];
    identities?: IdentityVersionRecord[];
    projects?: ProjectRecord[];
    assets?: AssetRecord[];
    assetVersions?: AssetVersionRecord[];
  }): void {
    for (const r of input.institutions ?? []) this.institutions.set(r.id, structuredClone(r));
    for (const r of input.identities ?? []) this.identities.set(r.id, structuredClone(r));
    for (const r of input.projects ?? []) this.projects.set(r.id, structuredClone({ ...r, revision: r.revision ?? 0, finalDesignVersionId: r.finalDesignVersionId ?? null }));
    for (const r of input.assets ?? []) this.assets.set(r.id, structuredClone(r));
    for (const r of input.assetVersions ?? []) this.assetVersions.set(r.id, structuredClone(r));
  }

  async getInstitution(id: string) { return structuredClone(this.institutions.get(id) ?? null); }
  async saveInstitution(record: InstitutionRecord) { this.institutions.set(record.id, structuredClone(record)); }
  async getIdentityVersion(id: string) { return structuredClone(this.identities.get(id) ?? null); }
  async listIdentityVersions(institutionId: string) { return [...this.identities.values()].filter(x => x.institutionId === institutionId).map(x => structuredClone(x)); }
  async saveIdentityVersion(record: IdentityVersionRecord) { this.identities.set(record.id, structuredClone(record)); }

  async activateIdentityVersion(institutionId: string, identityVersionId: string) {
    const institution = this.institutions.get(institutionId);
    const target = this.identities.get(identityVersionId);
    if (!institution || !target || target.institutionId !== institutionId) throw new Error("IDENTITY_ACTIVATION_MISMATCH");
    for (const [id, item] of this.identities) {
      if (item.institutionId === institutionId) this.identities.set(id, { ...item, status: id === identityVersionId ? "ACTIVE" : item.status === "ACTIVE" ? "ARCHIVED" : item.status });
    }
    this.institutions.set(institutionId, { ...institution, activeIdentityVersionId: identityVersionId });
  }

  async getProject(id: string) { return structuredClone(this.projects.get(id) ?? null); }
  async saveProject(project: ProjectRecord, expectedRevision?: number) {
    const current = this.projects.get(project.id);
    if (current && expectedRevision !== undefined && current.revision !== expectedRevision) throw new Error("PROJECT_REVISION_CONFLICT");
    const next = current ? { ...project, revision: current.revision + 1 } : project;
    this.projects.set(project.id, structuredClone(next));
  }
  async listAssets(institutionId: string) { return [...this.assets.values()].filter(a => a.institutionId === institutionId).map(a => structuredClone(a)); }
  async getAssetVersion(id: string) { return structuredClone(this.assetVersions.get(id) ?? null); }

  async createArtifactVersion(input: Omit<ArtifactVersionRecord, "id" | "versionNumber">) {
    const key = `${input.projectId}:${input.kind}`;
    const versionNumber = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, versionNumber);
    const id = `${input.kind.toLowerCase()}_${input.projectId}_v${versionNumber}`;
    const record: ArtifactVersionRecord = { ...input, id, versionNumber };
    this.artifacts.set(id, structuredClone(record));
    return structuredClone(record);
  }
  async getArtifactVersion(id: string) { return structuredClone(this.artifacts.get(id) ?? null); }
  async getLatestArtifact(projectId: string, kind: ArtifactKind) {
    const items = [...this.artifacts.values()].filter(a => a.projectId === projectId && a.kind === kind).sort((a,b) => b.versionNumber - a.versionNumber);
    return structuredClone(items[0] ?? null);
  }
  async saveApproval(approval: ApprovalRecord) { this.approvals.set(`${approval.projectId}:${approval.artifactKind}`, structuredClone(approval)); }
  async getApprovedVersion(projectId: string, kind: ArtifactKind) {
    const a = this.approvals.get(`${projectId}:${kind}`);
    return a?.decision === "APPROVED" && a.origin === "USER_APPROVED" ? a.artifactVersionId : null;
  }
  private ik(requestId: string, actorUserId: string, operation: string) { return `${actorUserId}:${operation}:${requestId}`; }
  async getIdempotency(requestId: string, actorUserId: string, operation: string) {
    return structuredClone(this.idempotency.get(this.ik(requestId, actorUserId, operation)) ?? null);
  }
  async saveIdempotency(record: IdempotencyRecord) {
    this.idempotency.set(this.ik(record.requestId, record.actorUserId, record.operation), structuredClone(record));
  }
  async runIdempotentMutation<T>(input: IdempotentMutationInput, action: () => Promise<T>): Promise<T> {
    const key=this.ik(input.requestId,input.actorUserId,input.operation);
    const existing=this.idempotency.get(key);
    if(existing?.status==="COMPLETED") return structuredClone(existing.result) as T;
    const active=this.inFlight.get(key);
    if(active) return structuredClone(await active) as T;
    const promise=(async()=>{
      this.idempotency.set(key,{...input,status:"IN_PROGRESS",result:null});
      try{
        const result=await action();
        this.idempotency.set(key,{...input,status:"COMPLETED",result:structuredClone(result)});
        return result;
      }catch(error){
        const code=error instanceof Error?error.message:String(error);
        this.idempotency.set(key,{...input,status:"FAILED_RETRYABLE",result:null,errorCode:code});
        throw error;
      }finally{this.inFlight.delete(key);}
    })();
    this.inFlight.set(key,promise);
    return structuredClone(await promise) as T;
  }
}
