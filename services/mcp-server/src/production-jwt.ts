import { createPublicKey, verify as verifySignature, type JsonWebKey } from "node:crypto";
import {
  ProductionAuthError,
  VISUAL4D_PRODUCTION_SCOPES,
  type ProductionTokenVerifier,
  type VerifiedAccessToken,
  type Visual4DProductionScope
} from "./production-auth.js";

interface JwtHeader { alg?: string; kid?: string; typ?: string; }
interface JwtClaims {
  sub?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  scope?: string;
  scp?: string[];
  sid?: string;
}
interface Jwk extends JsonWebKey { kid?: string; use?: string; alg?: string; }
interface JwksDocument { keys?: Jwk[]; }

export interface JwksJwtVerifierOptions {
  issuer: string;
  /** Optional for DCR clients whose OAuth client_id (and therefore aud) is dynamic. */
  audience?: string;
  jwksUri: string;
  cacheTtlMs?: number;
  fetchJson?: (url:string)=>Promise<unknown>;
}

function decodeSegment<T>(segment:string):T {
  try { return JSON.parse(Buffer.from(segment,"base64url").toString("utf8")) as T; }
  catch { throw new ProductionAuthError(401,"MALFORMED_JWT"); }
}

function parseScopes(claims:JwtClaims):Visual4DProductionScope[] {
  const raw = claims.scope?.split(/\s+/).filter(Boolean) ?? claims.scp ?? [];
  const allowed = new Set<string>(VISUAL4D_PRODUCTION_SCOPES);
  return raw.filter((scope):scope is Visual4DProductionScope=>allowed.has(scope));
}

function normalizeAudience(aud:JwtClaims["aud"]):string[] {
  return typeof aud === "string" ? [aud] : Array.isArray(aud) ? aud : [];
}

export class Rs256JwksTokenVerifier implements ProductionTokenVerifier {
  private cache: { expiresAt:number; keys:Jwk[] } | undefined;
  private readonly fetchJson:(url:string)=>Promise<unknown>;
  private readonly cacheTtlMs:number;

  constructor(private readonly options:JwksJwtVerifierOptions) {
    this.cacheTtlMs = options.cacheTtlMs ?? 5*60_000;
    this.fetchJson = options.fetchJson ?? (async(url:string)=>{
      const response = await fetch(url,{headers:{accept:"application/json"}});
      if(!response.ok) throw new ProductionAuthError(401,"JWKS_FETCH_FAILED");
      return response.json();
    });
  }

  private async keys():Promise<Jwk[]> {
    const now=Date.now();
    if(this.cache && this.cache.expiresAt>now) return this.cache.keys;
    const doc=await this.fetchJson(this.options.jwksUri) as JwksDocument;
    if(!Array.isArray(doc.keys)) throw new ProductionAuthError(401,"INVALID_JWKS");
    this.cache={expiresAt:now+this.cacheTtlMs,keys:doc.keys};
    return doc.keys;
  }

  async verify(token:string):Promise<VerifiedAccessToken> {
    const parts=token.split(".");
    if(parts.length!==3) throw new ProductionAuthError(401,"MALFORMED_JWT");
    const [encodedHeader,encodedClaims,encodedSignature]=parts;
    if(!encodedHeader||!encodedClaims||!encodedSignature) throw new ProductionAuthError(401,"MALFORMED_JWT");
    const header=decodeSegment<JwtHeader>(encodedHeader);
    const claims=decodeSegment<JwtClaims>(encodedClaims);
    if(header.alg!=="RS256") throw new ProductionAuthError(401,"UNSUPPORTED_JWT_ALG");
    if(!header.kid) throw new ProductionAuthError(401,"JWT_KID_REQUIRED");
    const jwk=(await this.keys()).find(key=>key.kid===header.kid&&key.kty==="RSA"&&(key.use===undefined||key.use==="sig"));
    if(!jwk) throw new ProductionAuthError(401,"JWKS_KEY_NOT_FOUND");
    const key=createPublicKey({key:jwk,format:"jwk"});
    const valid=verifySignature("RSA-SHA256",Buffer.from(`${encodedHeader}.${encodedClaims}`),key,Buffer.from(encodedSignature,"base64url"));
    if(!valid) throw new ProductionAuthError(401,"INVALID_JWT_SIGNATURE");
    if(claims.iss!==this.options.issuer) throw new ProductionAuthError(401,"INVALID_TOKEN_ISSUER");
    const audience=normalizeAudience(claims.aud);
    if(this.options.audience!==undefined&&!audience.includes(this.options.audience)) throw new ProductionAuthError(401,"INVALID_TOKEN_AUDIENCE");
    if(typeof claims.sub!=="string"||claims.sub.trim()==="") throw new ProductionAuthError(401,"TOKEN_SUBJECT_REQUIRED");
    if(typeof claims.exp!=="number") throw new ProductionAuthError(401,"TOKEN_EXP_REQUIRED");
    const now=Math.floor(Date.now()/1000);
    if(claims.exp<=now) throw new ProductionAuthError(401,"TOKEN_EXPIRED");
    if(claims.nbf!==undefined&&typeof claims.nbf!=="number") throw new ProductionAuthError(401,"INVALID_TOKEN_NBF");
    if(typeof claims.nbf==="number"&&claims.nbf>now) throw new ProductionAuthError(401,"TOKEN_NOT_YET_VALID");
    return {
      subject:claims.sub,
      issuer:claims.iss,
      audience,
      expiresAt:claims.exp,
      ...(claims.nbf===undefined?{}:{notBefore:claims.nbf}),
      scopes:parseScopes(claims),
      ...(typeof claims.sid==="string"?{sessionId:claims.sid}:{})
    };
  }
}
