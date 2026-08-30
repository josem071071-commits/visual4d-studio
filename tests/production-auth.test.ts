import test from "node:test";
import assert from "node:assert/strict";
import {
  authenticateProductionBearer,
  actorFromVerifiedAccessToken,
  ProductionAuthError,
  type ProductionTokenVerifier,
  type VerifiedAccessToken
} from "../services/mcp-server/src/production-auth.js";

function valid(overrides: Partial<VerifiedAccessToken> = {}): VerifiedAccessToken {
  return {
    subject: "user-a",
    issuer: "https://issuer.example",
    audience: ["visual4d-mcp"],
    expiresAt: Math.floor(Date.now()/1000)+300,
    scopes: ["visual4d:read","visual4d:render"],
    ...overrides
  };
}

function verifier(result: VerifiedAccessToken): ProductionTokenVerifier {
  return { async verify(token:string){ assert.equal(token,"token-value"); return result; } };
}

test("production bearer derives actor only from verified subject", async()=>{
  const actor=await authenticateProductionBearer("Bearer token-value",verifier(valid()),["visual4d:render"]);
  assert.equal(actor.userId,"user-a");
  assert.ok(actor.permissions?.includes("visual4d:render"));
});

test("missing bearer fails closed",async()=>{
  await assert.rejects(()=>authenticateProductionBearer(undefined,verifier(valid())),(error:unknown)=>error instanceof ProductionAuthError&&error.code==="BEARER_TOKEN_REQUIRED");
});

test("expired token fails closed",async()=>{
  await assert.rejects(()=>authenticateProductionBearer("Bearer token-value",verifier(valid({expiresAt:1}))), (error:unknown)=>error instanceof ProductionAuthError&&error.code==="TOKEN_EXPIRED");
});

test("future nbf fails closed",async()=>{
  await assert.rejects(()=>authenticateProductionBearer("Bearer token-value",verifier(valid({notBefore:Math.floor(Date.now()/1000)+300}))), (error:unknown)=>error instanceof ProductionAuthError&&error.code==="TOKEN_NOT_ACTIVE");
});

test("missing required scope is forbidden",async()=>{
  await assert.rejects(()=>authenticateProductionBearer("Bearer token-value",verifier(valid()),["visual4d:write"]), (error:unknown)=>error instanceof ProductionAuthError&&error.statusCode===403&&error.code==="INSUFFICIENT_SCOPE");
});

test("empty verified subject cannot become actor",()=>{
  assert.throws(()=>actorFromVerifiedAccessToken(valid({subject:"  "})),(error:unknown)=>error instanceof ProductionAuthError&&error.code==="TOKEN_SUBJECT_REQUIRED");
});

test("two verified subjects remain distinct actors",()=>{
  const a=actorFromVerifiedAccessToken(valid({subject:"user-a"}));
  const b=actorFromVerifiedAccessToken(valid({subject:"user-b"}));
  assert.notEqual(a.userId,b.userId);
});
