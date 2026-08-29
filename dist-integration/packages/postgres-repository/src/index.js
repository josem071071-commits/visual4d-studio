import pg from "pg";
import { AsyncLocalStorage } from "node:async_hooks";
const { Pool } = pg;
const artifactTables = {
    ANALYSIS: "analysis_versions",
    STRUCTURE: "structure_versions",
    RESOURCES: "resource_versions",
    ART_DIRECTION: "art_direction_versions",
    VERIFICATION: "verification_versions",
    DESIGN: "design_versions"
};
function artifactStage(kind) {
    return {
        ANALYSIS: "ANALYSIS_REVIEW",
        STRUCTURE: "STRUCTURE_REVIEW",
        RESOURCES: "RESOURCES_REVIEW",
        ART_DIRECTION: "ART_DIRECTION_REVIEW",
        VERIFICATION: "VERIFICATION_REVIEW",
        DESIGN: "GENERATED"
    }[kind];
}
function rowInstitution(r) {
    return { id: r.id, ownerUserId: r.owner_user_id, name: r.name, activeIdentityVersionId: r.active_identity_version_id, status: r.status };
}
function rowIdentity(r) {
    return { id: r.id, institutionId: r.institution_id, versionNumber: r.version_number, status: r.status };
}
function rowProject(r) {
    return {
        id: r.id, ownerUserId: r.owner_user_id, institutionId: r.institution_id, identityVersionId: r.identity_version_id,
        projectType: r.project_type, title: r.title, width: r.format_width, height: r.format_height, orientation: r.orientation,
        currentStage: r.current_stage, status: r.status, revision: r.revision, finalDesignVersionId: r.final_design_version_id
    };
}
function rowAsset(r) {
    return { id: r.id, institutionId: r.institution_id, ownerUserId: r.owner_user_id, type: r.type, isMaster: r.is_master,
        generativeEditAllowed: r.generative_edit_allowed, currentVersionId: r.current_version_id, status: r.status };
}
function rowAssetVersion(r) {
    return { id: r.id, assetId: r.asset_id, status: r.status, checksumSha256: r.checksum_sha256 };
}
function rowArtifact(r, kind) {
    return { id: r.id, projectId: r.project_id, kind, versionNumber: r.version_number, payload: r.payload };
}
export class PostgresProjectRepository {
    pool;
    ownsPool;
    txStorage = new AsyncLocalStorage();
    db() { return this.txStorage.getStore() ?? this.pool; }
    async inTransaction(action) {
        const active = this.txStorage.getStore();
        if (active)
            return action(active);
        const client = await this.pool.connect();
        try {
            await client.query("BEGIN");
            const result = await this.txStorage.run(client, () => action(client));
            await client.query("COMMIT");
            return result;
        }
        catch (error) {
            await client.query("ROLLBACK");
            throw error;
        }
        finally {
            client.release();
        }
    }
    constructor(options = {}) {
        if (options.pool) {
            this.pool = options.pool;
            this.ownsPool = false;
        }
        else {
            if (!options.connectionString)
                throw new Error("DATABASE_URL_REQUIRED");
            this.pool = new Pool({ connectionString: options.connectionString, max: 10, idleTimeoutMillis: 10_000 });
            this.ownsPool = true;
        }
    }
    async close() { if (this.ownsPool)
        await this.pool.end(); }
    async getInstitution(id) {
        const q = await this.db().query("SELECT * FROM institutions WHERE id=$1", [id]);
        return q.rows[0] ? rowInstitution(q.rows[0]) : null;
    }
    async saveInstitution(r) {
        await this.db().query(`INSERT INTO institutions(id,owner_user_id,name,status,active_identity_version_id)
      VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,status=EXCLUDED.status,active_identity_version_id=EXCLUDED.active_identity_version_id,updated_at=now()`, [r.id, r.ownerUserId, r.name, r.status, r.activeIdentityVersionId]);
    }
    async getIdentityVersion(id) {
        const q = await this.db().query("SELECT * FROM identity_versions WHERE id=$1", [id]);
        return q.rows[0] ? rowIdentity(q.rows[0]) : null;
    }
    async listIdentityVersions(institutionId) {
        const q = await this.db().query("SELECT * FROM identity_versions WHERE institution_id=$1 ORDER BY version_number", [institutionId]);
        return q.rows.map(rowIdentity);
    }
    async saveIdentityVersion(r) {
        await this.db().query(`INSERT INTO identity_versions(id,institution_id,version_number,name,status)
      VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(id) DO UPDATE SET status=EXCLUDED.status`, [r.id, r.institutionId, r.versionNumber, `Identity v${r.versionNumber}`, r.status]);
    }
    async activateIdentityVersion(institutionId, identityVersionId) {
        return this.inTransaction(async (c) => {
            const inst = await c.query("SELECT id FROM institutions WHERE id=$1 FOR UPDATE", [institutionId]);
            if (!inst.rowCount)
                throw new Error("INSTITUTION_NOT_FOUND");
            const target = await c.query("SELECT id FROM identity_versions WHERE id=$1 AND institution_id=$2 FOR UPDATE", [identityVersionId, institutionId]);
            if (!target.rowCount)
                throw new Error("IDENTITY_ACTIVATION_MISMATCH");
            await c.query("UPDATE identity_versions SET status='ARCHIVED', archived_at=COALESCE(archived_at,now()) WHERE institution_id=$1 AND status='ACTIVE' AND id<>$2", [institutionId, identityVersionId]);
            await c.query("UPDATE identity_versions SET status='ACTIVE', activated_at=COALESCE(activated_at,now()), archived_at=NULL WHERE id=$1", [identityVersionId]);
            await c.query("UPDATE institutions SET active_identity_version_id=$2,updated_at=now() WHERE id=$1", [institutionId, identityVersionId]);
        });
    }
    async getProject(id) { const q = await this.db().query("SELECT * FROM projects WHERE id=$1", [id]); return q.rows[0] ? rowProject(q.rows[0]) : null; }
    async saveProject(p, expectedRevision) {
        if (expectedRevision === undefined) {
            await this.db().query(`INSERT INTO projects(id,owner_user_id,institution_id,identity_version_id,project_type,title,format_width,format_height,orientation,current_stage,status,revision,final_design_version_id)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT(id) DO UPDATE SET current_stage=EXCLUDED.current_stage,status=EXCLUDED.status,final_design_version_id=EXCLUDED.final_design_version_id,updated_at=now()`, [p.id, p.ownerUserId, p.institutionId, p.identityVersionId, p.projectType, p.title, p.width, p.height, p.orientation, p.currentStage, p.status, p.revision, p.finalDesignVersionId]);
            return;
        }
        const q = await this.db().query(`UPDATE projects SET current_stage=$2,status=$3,final_design_version_id=$4,revision=revision+1,updated_at=now()
      WHERE id=$1 AND revision=$5`, [p.id, p.currentStage, p.status, p.finalDesignVersionId, expectedRevision]);
        if (q.rowCount !== 1)
            throw new Error("PROJECT_REVISION_CONFLICT");
    }
    async listAssets(institutionId) { const q = await this.db().query("SELECT * FROM assets WHERE institution_id=$1 ORDER BY id", [institutionId]); return q.rows.map(rowAsset); }
    async getAssetVersion(id) { const q = await this.db().query("SELECT * FROM asset_versions WHERE id=$1", [id]); return q.rows[0] ? rowAssetVersion(q.rows[0]) : null; }
    async artifactFromTable(db, id, kind) {
        const table = artifactTables[kind];
        const q = await db.query(`SELECT id,project_id,version_number,payload FROM ${table} WHERE id=$1`, [id]);
        return q.rows[0] ? rowArtifact(q.rows[0], kind) : null;
    }
    async createArtifactVersion(input) {
        return this.inTransaction(async (c) => {
            const table = artifactTables[input.kind];
            await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${input.projectId}:${input.kind}`]);
            const v = await c.query(`SELECT COALESCE(MAX(version_number),0)+1 AS next FROM ${table} WHERE project_id=$1`, [input.projectId]);
            const versionNumber = Number(v.rows[0].next);
            const id = `${input.kind.toLowerCase()}_${input.projectId}_v${versionNumber}`;
            if (input.kind === "VERIFICATION") {
                const designVersionId = input.payload?.designVersionId ?? null;
                await c.query(`INSERT INTO ${table}(id,project_id,version_number,payload,design_version_id) VALUES($1,$2,$3,$4::jsonb,$5)`, [id, input.projectId, versionNumber, JSON.stringify(input.payload), designVersionId]);
            }
            else {
                await c.query(`INSERT INTO ${table}(id,project_id,version_number,payload) VALUES($1,$2,$3,$4::jsonb)`, [id, input.projectId, versionNumber, JSON.stringify(input.payload)]);
            }
            return { ...input, id, versionNumber };
        });
    }
    async getArtifactVersion(id) {
        for (const kind of Object.keys(artifactTables)) {
            const a = await this.artifactFromTable(this.db(), id, kind);
            if (a)
                return a;
        }
        return null;
    }
    async getLatestArtifact(projectId, kind) {
        const table = artifactTables[kind];
        const q = await this.db().query(`SELECT id,project_id,version_number,payload FROM ${table} WHERE project_id=$1 ORDER BY version_number DESC LIMIT 1`, [projectId]);
        return q.rows[0] ? rowArtifact(q.rows[0], kind) : null;
    }
    async saveApproval(a) {
        await this.db().query(`INSERT INTO approvals(project_id,stage,artifact_type,artifact_version_id,decision,origin,approved_by_user_id,approved_at,decided_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,now())
      ON CONFLICT(project_id,artifact_type,artifact_version_id,decision) DO UPDATE SET origin=EXCLUDED.origin,approved_by_user_id=EXCLUDED.approved_by_user_id,approved_at=EXCLUDED.approved_at,decided_at=now()`, [a.projectId, artifactStage(a.artifactKind), a.artifactKind, a.artifactVersionId, a.decision, a.origin, a.approvedByUserId, a.approvedAt]);
    }
    async getApprovedVersion(projectId, kind) {
        const q = await this.db().query(`SELECT artifact_version_id FROM approvals WHERE project_id=$1 AND artifact_type=$2 AND decision='APPROVED' AND origin='USER_APPROVED' ORDER BY id DESC LIMIT 1`, [projectId, kind]);
        return q.rows[0]?.artifact_version_id ?? null;
    }
    async getIdempotency(requestId, actorUserId, operation) {
        const q = await this.db().query("SELECT status,result_json,error_code FROM idempotency_keys WHERE actor_user_id=$1 AND operation=$2 AND request_id=$3", [actorUserId, operation, requestId]);
        if (!q.rows[0])
            return null;
        return { requestId, actorUserId, operation, status: q.rows[0].status, result: q.rows[0].result_json ?? null, errorCode: q.rows[0].error_code ?? null };
    }
    async saveIdempotency(r) {
        await this.db().query(`INSERT INTO idempotency_keys(actor_user_id,operation,request_id,status,result_json,error_code,updated_at) VALUES($1,$2,$3,$4,$5::jsonb,$6,now())
      ON CONFLICT(actor_user_id,operation,request_id) DO UPDATE SET status=EXCLUDED.status,result_json=EXCLUDED.result_json,error_code=EXCLUDED.error_code,updated_at=now()`, [r.actorUserId, r.operation, r.requestId, r.status, JSON.stringify(r.result), r.errorCode ?? null]);
    }
    async runIdempotentMutation(input, action) {
        return this.inTransaction(async (c) => {
            const reserve = await c.query(`INSERT INTO idempotency_keys(actor_user_id,operation,request_id,status,result_json,updated_at)
        VALUES($1,$2,$3,'IN_PROGRESS',NULL,now()) ON CONFLICT DO NOTHING RETURNING request_id`, [input.actorUserId, input.operation, input.requestId]);
            if (reserve.rowCount === 0) {
                const existing = await c.query(`SELECT status,result_json,error_code FROM idempotency_keys WHERE actor_user_id=$1 AND operation=$2 AND request_id=$3 FOR UPDATE`, [input.actorUserId, input.operation, input.requestId]);
                const row = existing.rows[0];
                if (row?.status === 'COMPLETED')
                    return row.result_json;
                if (row?.status === 'IN_PROGRESS')
                    throw new Error('IDEMPOTENCY_REQUEST_IN_PROGRESS');
                await c.query(`UPDATE idempotency_keys SET status='IN_PROGRESS',result_json=NULL,error_code=NULL,updated_at=now() WHERE actor_user_id=$1 AND operation=$2 AND request_id=$3`, [input.actorUserId, input.operation, input.requestId]);
            }
            try {
                const result = await action();
                await c.query(`UPDATE idempotency_keys SET status='COMPLETED',result_json=$4::jsonb,error_code=NULL,updated_at=now() WHERE actor_user_id=$1 AND operation=$2 AND request_id=$3`, [input.actorUserId, input.operation, input.requestId, JSON.stringify(result)]);
                await c.query(`INSERT INTO audit_events(event_type,event_payload) VALUES('MUTATION_COMPLETED',$1::jsonb)`, [JSON.stringify({ actorUserId: input.actorUserId, operation: input.operation, requestId: input.requestId })]);
                return result;
            }
            catch (error) {
                // The surrounding transaction rolls back every domain side effect. Failure is intentionally not persisted in the same transaction.
                throw error;
            }
        });
    }
}
