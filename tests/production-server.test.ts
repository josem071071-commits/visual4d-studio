import test from "node:test";
import assert from "node:assert/strict";
import { authenticateProductionBearer, ProductionAuthError, type ProductionTokenVerifier, type VerifiedAccessToken } from "../services/mcp-server/src/production-auth.js";
import { requiredScopesForTool } from "../services/mcp-server/src/tool-scope-policy.js";
import { canonicalMcpResourceUri, protectedResourceMetadataUrl, visual4DBearerChallenge, visual4DProtectedResourceMetadata } from "../services/mcp-server/src/protected-resource-metadata.js";

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
test("canonical resource requires https MCP path",()=>{assert.equal(canonicalMcpResourceUri("https://api.example.com/mcp/"),"https://api.example.com/mcp");assert.throws(()=>canonicalMcpResourceUri("http://api.example.com/mcp"),/HTTPS_REQUIRED/);});
test("RFC9728 metadata binds resource to authorization server",()=>{const metadata=visual4DProtectedResourceMetadata("https://api.example.com/mcp","https://issuer.example");assert.equal(metadata.resource,"https://api.example.com/mcp");assert.deepEqual(metadata.authorization_servers,["https://issuer.example"]);assert.ok(metadata.scopes_supported.includes("visual4d:render"));});
test("resource metadata discovery URL is path scoped",()=>assert.equal(protectedResourceMetadataUrl("https://api.example.com/mcp"),"https://api.example.com/.well-known/oauth-protected-resource/mcp"));
test("401 bearer challenge advertises RFC9728 metadata",()=>assert.equal(visual4DBearerChallenge("https://api.example.com/mcp"),'Bearer resource_metadata="https://api.example.com/.well-known/oauth-protected-resource/mcp"'));
