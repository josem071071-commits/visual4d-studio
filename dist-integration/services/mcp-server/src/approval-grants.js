import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
function hashToken(token) { return createHash("sha256").update(token).digest("hex"); }
function safeFindToken(map, token) {
    for (const k of map.keys()) {
        const a = Buffer.from(k);
        const b = Buffer.from(token);
        if (a.length === b.length && timingSafeEqual(a, b))
            return k;
    }
}
export class MemoryApprovalGrantStore {
    grants = new Map();
    async issue(input, ttlMs = 5 * 60_000) { const token = randomBytes(32).toString("hex"); this.grants.set(token, { ...input, expiresAt: Date.now() + ttlMs, state: "ISSUED" }); return token; }
    async withClaim(token, expected, action) {
        const key = safeFindToken(this.grants, token);
        if (!key)
            throw new Error("INVALID_OR_EXPIRED_APPROVAL_GRANT");
        const c = this.grants.get(key);
        if (c.expiresAt < Date.now() || c.state !== "ISSUED" || c.userId !== expected.userId || c.projectId !== expected.projectId || c.kind !== expected.kind || c.artifactVersionId !== expected.artifactVersionId)
            throw new Error("INVALID_OR_EXPIRED_APPROVAL_GRANT");
        this.grants.set(key, { ...c, state: "CLAIMED" });
        try {
            const result = await action();
            this.grants.set(key, { ...c, state: "CONSUMED" });
            return result;
        }
        catch (error) {
            this.grants.set(key, { ...c, state: "ISSUED" });
            throw error;
        }
    }
}
export class PostgresApprovalGrantStore {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async issue(input, ttlMs = 5 * 60_000) {
        const token = randomBytes(32).toString("hex");
        await this.pool.query(`INSERT INTO approval_grants(token_hash,user_id,project_id,artifact_kind,artifact_version_id,state,expires_at)
      VALUES($1,$2,$3,$4,$5,'ISSUED',now()+($6::bigint * interval '1 millisecond'))`, [hashToken(token), input.userId, input.projectId, input.kind, input.artifactVersionId, ttlMs]);
        return token;
    }
    async withClaim(token, expected, action) {
        const client = await this.pool.connect();
        try {
            await client.query("BEGIN");
            const q = await client.query(`UPDATE approval_grants SET state='CLAIMED',claimed_at=now()
        WHERE token_hash=$1 AND user_id=$2 AND project_id=$3 AND artifact_kind=$4 AND artifact_version_id=$5
          AND state='ISSUED' AND expires_at>=now() RETURNING id`, [hashToken(token), expected.userId, expected.projectId, expected.kind, expected.artifactVersionId]);
            if (q.rowCount !== 1)
                throw new Error("INVALID_OR_EXPIRED_APPROVAL_GRANT");
            await client.query("COMMIT");
        }
        catch (error) {
            await client.query("ROLLBACK");
            client.release();
            throw error;
        }
        client.release();
        try {
            const result = await action();
            await this.pool.query(`UPDATE approval_grants SET state='CONSUMED',consumed_at=now() WHERE token_hash=$1 AND state='CLAIMED'`, [hashToken(token)]);
            return result;
        }
        catch (error) {
            await this.pool.query(`UPDATE approval_grants SET state='ISSUED',claimed_at=NULL WHERE token_hash=$1 AND state='CLAIMED' AND expires_at>=now()`, [hashToken(token)]);
            throw error;
        }
    }
}
