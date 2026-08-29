import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { ActorContext } from "../../../packages/repositories/src/index.js";

export interface LocalAuthIdentity { userId:string; sessionId?:string; permissions?:readonly string[]; }
export interface LocalAuthConfig {
  token?: string;
  userId?: string;
  sessionId?: string;
  permissions?: readonly string[];
  tokenIdentities?: ReadonlyArray<{token:string;identity:LocalAuthIdentity}>;
}
export class LocalAuthError extends Error { constructor(public readonly statusCode:401|403,public readonly code:string){super(code);this.name="LocalAuthError";} }
function safeEqual(a:string,b:string){const ab=Buffer.from(a),bb=Buffer.from(b);return ab.length===bb.length&&timingSafeEqual(ab,bb);}
function actor(identity:LocalAuthIdentity):ActorContext{return{userId:identity.userId,sessionId:identity.sessionId??"local-mcp",permissions:identity.permissions??["visual4d:write"]};}
export function authenticateLocalBearer(header:string|undefined,config:LocalAuthConfig):ActorContext{
  if(!header?.startsWith("Bearer "))throw new LocalAuthError(401,"BEARER_TOKEN_REQUIRED");
  const supplied=header.slice(7);
  for(const item of config.tokenIdentities??[]){if(safeEqual(supplied,item.token))return actor(item.identity);}
  if(config.token&&config.userId&&safeEqual(supplied,config.token))return actor({userId:config.userId,sessionId:config.sessionId,permissions:config.permissions});
  throw new LocalAuthError(403,"INVALID_BEARER_TOKEN");
}
export function actorFromRequest(req:IncomingMessage,config:LocalAuthConfig){const raw=req.headers.authorization;return authenticateLocalBearer(Array.isArray(raw)?raw[0]:raw,config);}
