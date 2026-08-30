import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { Rs256JwksTokenVerifier } from "../../dist-integration/services/mcp-server/src/production-jwt.js";
import { authenticateProductionBearer, ProductionAuthError } from "../../dist-integration/services/mcp-server/src/production-auth.js";
import { requiredScopesForTool } from "../../dist-integration/services/mcp-server/src/tool-scope-policy.js";

const {publicKey,privateKey}=generateKeyPairSync("rsa",{modulusLength:2048});
const jwk=publicKey.export({format:"jwk"});
Object.assign(jwk,{kid:"test-key",use:"sig",alg:"RS256"});
const now=()=>Math.floor(Date.now()/1000);

function token(claims={},header={}){
  const h=Buffer.from(JSON.stringify({alg:"RS256",typ:"JWT",kid:"test-key",...header})).toString("base64url");
  const p=Buffer.from(JSON.stringify({sub:"user-1",iss:"https://issuer.example",aud:"visual4d-mcp",exp:now()+300,scope:"visual4d:read visual4d:render",...claims})).toString("base64url");
  const s=sign("RSA-SHA256",Buffer.from(`${h}.${p}`),privateKey).toString("base64url");
  return `${h}.${p}.${s}`;
}
function verifier(){return new Rs256JwksTokenVerifier({issuer:"https://issuer.example",audience:"visual4d-mcp",jwksUri:"https://issuer.example/.well-known/jwks.json",fetchJson:async()=>({keys:[jwk]})});}

test("RS256 JWKS verifier authenticates subject and scopes",async()=>{
  const actor=await authenticateProductionBearer(`Bearer ${token()}`,verifier(),["visual4d:render"]);
  assert.equal(actor.userId,"user-1");
  assert.ok(actor.permissions?.includes("visual4d:render"));
});

test("issuer and audience are enforced",async()=>{
  await assert.rejects(()=>authenticateProductionBearer(`Bearer ${token({iss:"https://evil.example"})}`,verifier()),e=>e instanceof ProductionAuthError&&e.code==="INVALID_TOKEN_ISSUER");
  await assert.rejects(()=>authenticateProductionBearer(`Bearer ${token({aud:"other-api"})}`,verifier()),e=>e instanceof ProductionAuthError&&e.code==="INVALID_TOKEN_AUDIENCE");
});

test("signature and algorithm fail closed",async()=>{
  const broken=token().slice(0,-2)+"aa";
  await assert.rejects(()=>authenticateProductionBearer(`Bearer ${broken}`,verifier()),e=>e instanceof ProductionAuthError&&e.code==="INVALID_JWT_SIGNATURE");
  await assert.rejects(()=>authenticateProductionBearer(`Bearer ${token({}, {alg:"none"})}`,verifier()),e=>e instanceof ProductionAuthError&&e.code==="UNSUPPORTED_JWT_ALG");
});

test("scope policy enforces least privilege",()=>{
  assert.deepEqual(requiredScopesForTool("generation.render_preview"),["visual4d:render"]);
  assert.deepEqual(requiredScopesForTool("approvals.approve_stage"),["visual4d:approve"]);
  assert.deepEqual(requiredScopesForTool("identity.activate_version"),["visual4d:identity"]);
  assert.throws(()=>requiredScopesForTool("unknown.tool"),/PRODUCTION_SCOPE_POLICY_MISSING/);
});
