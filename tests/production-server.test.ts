import test from "node:test";
import assert from "node:assert/strict";
import { authenticateProductionBearer, ProductionAuthError, type ProductionTokenVerifier, type VerifiedAccessToken } from "../services/mcp-server/src/production-auth.js";
import { requiredScopesForTool } from "../services/mcp-server/src/tool-scope-policy.js";

const now=()=>Math.floor(Date.now()/1000);
function verified(subject:string,scopes:VerifiedAccessToken["scopes"]):VerifiedAccessToken{return{subject,issuer:"https://issuer.example",audience:["visual4d-mcp"],expiresAt:now()+300,scopes};}
function verifier(value:VerifiedAccessToken):ProductionTokenVerifier{return{async verify(){return value;}};}

test("production identity is always derived from token sub",async()=>{const a=await authenticateProductionBearer("Bearer a",verifier(verified("user-a",["visual4d:render"])));const b=await authenticateProductionBearer("Bearer b",verifier(verified("user-b",["visual4d:render"])));assert.equal(a.userId,"user-a");assert.equal(b.userId,"user-b");assert.notEqual(a.userId,b.userId);});
test("render preview requires only render scope",()=>assert.deepEqual(requiredScopesForTool("generation.render_preview"),["visual4d:render"]));
test("write scope cannot approve",()=>assert.deepEqual(requiredScopesForTool("approvals.approve_stage"),["visual4d:approve"]));
test("identity activation has independent scope",()=>assert.deepEqual(requiredScopesForTool("identity.activate_version"),["visual4d:identity"]));
test("unknown tools fail closed",()=>assert.throws(()=>requiredScopesForTool("unknown.tool"),/PRODUCTION_SCOPE_POLICY_MISSING/));
test("expired production token returns 401",async()=>{await assert.rejects(()=>authenticateProductionBearer("Bearer x",verifier({...verified("user-a",["visual4d:render"]),expiresAt:1})),(e:unknown)=>e instanceof ProductionAuthError&&e.statusCode===401);});
test("missing scope returns 403",async()=>{await assert.rejects(()=>authenticateProductionBearer("Bearer x",verifier(verified("user-a",["visual4d:read"])),["visual4d:render"]),(e:unknown)=>e instanceof ProductionAuthError&&e.statusCode===403);});
