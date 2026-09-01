import test from "node:test";
import assert from "node:assert/strict";
import { MemoryProjectRepository } from "../packages/repositories/src/index.js";
import { ProjectWorkflowService } from "../packages/services/src/index.js";
import { authenticateProductionBearer, ProductionAuthError, type ProductionTokenVerifier, type VerifiedAccessToken } from "../services/mcp-server/src/production-auth.js";
import { resolveOAuthScopes } from "../services/mcp-server/src/oauth-broker.js";
import { createVisual4DToolRegistry } from "../services/mcp-server/src/tool-registry.js";
import { requiredScopesForTool } from "../services/mcp-server/src/tool-scope-policy.js";
import { canonicalMcpResourceUri, protectedResourceMetadataUrl, visual4DBearerChallenge, visual4DProtectedResourceMetadata } from "../services/mcp-server/src/protected-resource-metadata.js";

const now=()=>Math.floor(Date.now()/1000);
function verified(subject:string,scopes:VerifiedAccessToken["scopes"]):VerifiedAccessToken{return{subject,issuer:"https://issuer.example",audience:["visual4d-mcp"],expiresAt:now()+300,scopes};}
function verifier(value:VerifiedAccessToken):ProductionTokenVerifier{return{async verify(){return value;}};}

const visualScopes=["visual4d:read","visual4d:render","visual4d:write","visual4d:approve","visual4d:identity"] as const;

test("production identity is always derived from token sub",async()=>{const a=await authenticateProductionBearer("Bearer a",verifier(verified("user-a",["visual4d:render"])));const b=await authenticateProductionBearer("Bearer b",verifier(verified("user-b",["visual4d:render"])));assert.equal(a.userId,"user-a");assert.equal(b.userId,"user-b");assert.notEqual(a.userId,b.userId);});
test("render preview requires only render scope",()=>assert.deepEqual(requiredScopesForTool("generation.render_preview"),["visual4d:render"]));
test("project creation requires write scope",()=>assert.deepEqual(requiredScopesForTool("projects.create"),["visual4d:write"]));
test("write scope cannot approve",()=>assert.deepEqual(requiredScopesForTool("approvals.approve_stage"),["visual4d:approve"]));
test("identity activation has independent scope",()=>assert.deepEqual(requiredScopesForTool("identity.activate_version"),["visual4d:identity"]));
test("unknown tools fail closed",()=>assert.throws(()=>requiredScopesForTool("unknown.tool"),/PRODUCTION_SCOPE_POLICY_MISSING/));
test("expired production token returns 401",async()=>{await assert.rejects(()=>authenticateProductionBearer("Bearer x",verifier({...verified("user-a",["visual4d:render"]),expiresAt:1})),(e:unknown)=>e instanceof ProductionAuthError&&e.statusCode===401);});
test("missing scope returns 403",async()=>{await assert.rejects(()=>authenticateProductionBearer("Bearer x",verifier(verified("user-a",["visual4d:read"])),["visual4d:render"]),(e:unknown)=>e instanceof ProductionAuthError&&e.statusCode===403);});
test("canonical resource requires https MCP path",()=>{assert.equal(canonicalMcpResourceUri("https://api.example.com/mcp/"),"https://api.example.com/mcp");assert.throws(()=>canonicalMcpResourceUri("http://api.example.com/mcp"),/HTTPS_REQUIRED/);});
test("RFC9728 metadata binds resource to authorization server",()=>{const metadata=visual4DProtectedResourceMetadata("https://api.example.com/mcp","https://issuer.example");assert.equal(metadata.resource,"https://api.example.com/mcp");assert.deepEqual(metadata.authorization_servers,["https://issuer.example"]);assert.ok(metadata.scopes_supported.includes("visual4d:render"));});
test("resource metadata discovery URL is path scoped",()=>assert.equal(protectedResourceMetadataUrl("https://api.example.com/mcp"),"https://api.example.com/.well-known/oauth-protected-resource/mcp"));
test("401 bearer challenge advertises RFC9728 metadata",()=>assert.equal(visual4DBearerChallenge("https://api.example.com/mcp"),'Bearer resource_metadata="https://api.example.com/.well-known/oauth-protected-resource/mcp"'));

test("projects.create bootstraps an owner-bound draft and is idempotent",async()=>{
  const repo=new MemoryProjectRepository();
  const workflow=new ProjectWorkflowService(repo);
  const ctx={actor:{userId:"user-cert",sessionId:"session-cert",permissions:["visual4d:write"]},requestId:"create-cert-1"};
  const first=await workflow.createProject("Certificación MCP Visual 4D",ctx);
  const second=await workflow.createProject("Certificación MCP Visual 4D",ctx);
  assert.equal(first.projectId,second.projectId);
  assert.equal(first.name,"Certificación MCP Visual 4D");
  assert.equal(first.status,"DRAFT");
  assert.equal(first.currentStage,"DRAFT");
  assert.equal(first.width,1080);
  assert.equal(first.height,1920);
  const saved=await repo.getProject(first.projectId);
  assert.equal(saved?.ownerUserId,"user-cert");
  assert.equal(saved?.identityVersionId.startsWith("identity_"),true);
});

test("projects.create refuses actors without visual4d:write",async()=>{
  const workflow=new ProjectWorkflowService(new MemoryProjectRepository());
  await assert.rejects(()=>workflow.createProject("Denied",{actor:{userId:"user-read",sessionId:"session-read",permissions:["visual4d:read"]},requestId:"create-denied"}),/VISUAL4D_WRITE_PERMISSION_REQUIRED/);
});

test("tool registry exposes projects.create as idempotent write operation",()=>{
  const workflow=new ProjectWorkflowService(new MemoryProjectRepository());
  const registry=createVisual4DToolRegistry(workflow,()=>({userId:"user-cert",sessionId:"session-cert",permissions:["visual4d:write"]}));
  const tool=registry.find(item=>item.name==="projects.create");
  assert.ok(tool);
  assert.equal(tool.annotations?.idempotentHint,true);
  assert.equal(tool.annotations?.readOnlyHint,false);
});

test("DCR without scope assigns only broker-advertised Visual 4D scopes",()=>{
  assert.equal(resolveOAuthScopes(undefined,visualScopes),visualScopes.join(" "));
});

test("DCR preserves an explicit valid Visual 4D scope subset",()=>{
  assert.equal(resolveOAuthScopes("visual4d:read   visual4d:render",visualScopes),"visual4d:read visual4d:render");
});

test("authorization scope resolution matches the registered Visual 4D set",()=>{
  const registered=resolveOAuthScopes(undefined,visualScopes);
  const authorized=resolveOAuthScopes(registered,visualScopes);
  assert.equal(authorized,registered);
});

test("duplicate scopes are normalized without widening privileges",()=>{
  assert.equal(resolveOAuthScopes("visual4d:read visual4d:read visual4d:render",visualScopes),"visual4d:read visual4d:render");
});

test("unknown OAuth scopes are rejected before upstream registration or authorization",()=>{
  assert.throws(()=>resolveOAuthScopes("visual4d:read admin:all",visualScopes),/UNSUPPORTED_SCOPE/);
});
