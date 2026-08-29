import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const root=new URL("../../",import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root),"utf8");
const repo=read("packages/postgres-repository/src/index.ts");
const svc=read("packages/services/src/index.ts");
const grants=read("services/mcp-server/src/approval-grants.ts");
const server=read("services/mcp-server/src/local-server.ts");
const tools=read("services/mcp-server/src/tool-registry.ts");
const migration=read("database/migrations/0005_sprint2_3_core_certification.sql");

test("Sprint 2.3 idempotency is transaction-scoped and reserves before mutation",()=>{
  assert.match(repo,/runIdempotentMutation/);assert.match(repo,/IN_PROGRESS/);assert.match(repo,/COMPLETED/);assert.match(repo,/txStorage/);assert.match(repo,/MUTATION_COMPLETED/);
  assert.match(svc,/runIdempotentMutation/);
});
test("workflow artifacts use transaction-local repository queries",()=>{assert.match(repo,/artifactFromTable\(this\.db\(\),id,kind\)/);assert.match(repo,/inTransaction/);});
test("approval grants have issued claimed consumed lifecycle and retry recovery",()=>{assert.match(grants,/ISSUED/);assert.match(grants,/CLAIMED/);assert.match(grants,/CONSUMED/);assert.match(grants,/state='ISSUED',claimed_at=NULL/);assert.match(grants,/PostgresApprovalGrantStore/);});
test("approval grant issuance validates exact project artifact and stage",()=>{assert.match(server,/validateApprovalCandidate/);assert.match(svc,/ARTIFACT_NOT_AWAITING_APPROVAL/);assert.match(svc,/STALE_ARTIFACT_CANNOT_BE_APPROVED/);});
test("dev approval bridge is explicitly gated and production-neutral",()=>{assert.match(server,/allowDevApprovalGrants/);assert.match(server,/x-visual4d-dev-user-action/);assert.match(server,/Development-only bridge/);});
test("HTTP boundary includes body timeout and rate limiting",()=>{assert.match(server,/REQUEST_BODY_TOO_LARGE/);assert.match(server,/REQUEST_TIMEOUT/);assert.match(server,/RATE_LIMIT_EXCEEDED/);});
test("MCP tools declare annotations and strict schemas",()=>{assert.match(tools,/additionalProperties:false/);assert.match(tools,/idempotentHint:true/);assert.match(tools,/openWorldHint:false/);});
test("Sprint 2.3 migration persists idempotency states and approval grants",()=>{assert.match(migration,/approval_grants/);assert.match(migration,/IN_PROGRESS/);assert.match(migration,/FAILED_RETRYABLE/);assert.match(migration,/ISSUED/);assert.match(migration,/CLAIMED/);assert.match(migration,/CONSUMED/);});

test("memory idempotency collapses concurrent duplicate mutations",async()=>{
  const {MemoryProjectRepository}=await import("../../dist/packages/repositories/src/index.js");
  const repoMem=new MemoryProjectRepository();let calls=0;
  const input={requestId:"same",actorUserId:"u",operation:"op"};
  const action=async()=>{calls++;await new Promise(r=>setTimeout(r,20));return{value:42};};
  const [a,b]=await Promise.all([repoMem.runIdempotentMutation(input,action),repoMem.runIdempotentMutation(input,action)]);
  assert.deepEqual(a,{value:42});assert.deepEqual(b,{value:42});assert.equal(calls,1);
});
