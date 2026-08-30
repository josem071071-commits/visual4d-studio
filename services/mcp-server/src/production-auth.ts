import type { ActorContext } from "../../../packages/repositories/src/index.js";

export const VISUAL4D_PRODUCTION_SCOPES = [
  "visual4d:read",
  "visual4d:render",
  "visual4d:write",
  "visual4d:approve",
  "visual4d:identity"
] as const;

export type Visual4DProductionScope = typeof VISUAL4D_PRODUCTION_SCOPES[number];

export interface VerifiedAccessToken {
  subject: string;
  issuer: string;
  audience: readonly string[];
  expiresAt: number;
  notBefore?: number;
  scopes: readonly Visual4DProductionScope[];
  sessionId?: string;
}

export interface ProductionTokenVerifier {
  verify(token: string): Promise<VerifiedAccessToken>;
}

export class ProductionAuthError extends Error {
  constructor(public readonly statusCode: 401 | 403, public readonly code: string) {
    super(code);
    this.name = "ProductionAuthError";
  }
}

export function parseBearerToken(header: string | undefined): string {
  if (!header?.startsWith("Bearer ")) throw new ProductionAuthError(401, "BEARER_TOKEN_REQUIRED");
  const token = header.slice(7).trim();
  if (!token) throw new ProductionAuthError(401, "BEARER_TOKEN_REQUIRED");
  return token;
}

export function requireScopes(token: VerifiedAccessToken, required: readonly Visual4DProductionScope[]): void {
  const granted = new Set(token.scopes);
  for (const scope of required) {
    if (!granted.has(scope)) throw new ProductionAuthError(403, "INSUFFICIENT_SCOPE");
  }
}

export function actorFromVerifiedAccessToken(token: VerifiedAccessToken): ActorContext {
  if (!token.subject.trim()) throw new ProductionAuthError(401, "TOKEN_SUBJECT_REQUIRED");
  return {
    userId: token.subject,
    sessionId: token.sessionId ?? "oauth-mcp",
    permissions: token.scopes
  };
}

export async function authenticateProductionBearer(
  header: string | undefined,
  verifier: ProductionTokenVerifier,
  requiredScopes: readonly Visual4DProductionScope[] = []
): Promise<ActorContext> {
  const token = parseBearerToken(header);
  const verified = await verifier.verify(token);
  const now = Math.floor(Date.now() / 1000);
  if (verified.expiresAt <= now) throw new ProductionAuthError(401, "TOKEN_EXPIRED");
  if (verified.notBefore !== undefined && verified.notBefore > now) throw new ProductionAuthError(401, "TOKEN_NOT_ACTIVE");
  requireScopes(verified, requiredScopes);
  return actorFromVerifiedAccessToken(verified);
}
