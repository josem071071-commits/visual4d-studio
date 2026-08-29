import { timingSafeEqual } from "node:crypto";
export class LocalAuthError extends Error {
    statusCode;
    code;
    constructor(statusCode, code) {
        super(code);
        this.statusCode = statusCode;
        this.code = code;
        this.name = "LocalAuthError";
    }
}
function safeEqual(a, b) { const ab = Buffer.from(a), bb = Buffer.from(b); return ab.length === bb.length && timingSafeEqual(ab, bb); }
function actor(identity) { return { userId: identity.userId, sessionId: identity.sessionId ?? "local-mcp", permissions: identity.permissions ?? ["visual4d:write"] }; }
export function authenticateLocalBearer(header, config) {
    if (!header?.startsWith("Bearer "))
        throw new LocalAuthError(401, "BEARER_TOKEN_REQUIRED");
    const supplied = header.slice(7);
    for (const item of config.tokenIdentities ?? []) {
        if (safeEqual(supplied, item.token))
            return actor(item.identity);
    }
    if (config.token && config.userId && safeEqual(supplied, config.token))
        return actor({ userId: config.userId, sessionId: config.sessionId, permissions: config.permissions });
    throw new LocalAuthError(403, "INVALID_BEARER_TOKEN");
}
export function actorFromRequest(req, config) { const raw = req.headers.authorization; return authenticateLocalBearer(Array.isArray(raw) ? raw[0] : raw, config); }
