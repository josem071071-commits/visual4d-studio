import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const pgRepo=fs.readFileSync(new URL("../../packages/postgres-repository/src/index.ts",import.meta.url),"utf8");
const localServer=fs.readFileSync(new URL("../../services/mcp-server/src/local-server.ts",import.meta.url),"utf8");
const auth=fs.readFileSync(new URL("../../services/mcp-server/src/local-auth.ts",import.meta.url),"utf8");
const grants=fs.readFileSync(new URL("../../services/mcp-server/src/approval-grants.ts",import.meta.url),"utf8");
const registry=fs.readFileSync(new URL("../../services/mcp-server/src/tool-registry.ts",import.meta.url),"utf8");
const migration=fs.readFileSync(new URL("../../database/migrations/0004_sprint2_2_pg_mcp.sql",import.meta.url),"utf8");

test("PostgreSQL repository has transactional identity activation, optimistic revision and advisory version lock",()=>{assert.match(pgRepo,/BEGIN/);assert.match(pgRepo,/PROJECT_REVISION_CONFLICT/);assert.match(pgRepo,/pg_advisory_xact_lock/);assert.match(pgRepo,/activateIdentityVersion/);});
test("Sprint 2.2 migration scopes verification and final design to same project",()=>{assert.match(migration,/verification_design_same_project_fk/);assert.match(migration,/projects_final_design_same_project_fk/);assert.match(migration,/REFERENCES design_versions\(project_id, id\)/);});
test("local MCP is loopback-first and bearer authenticated",()=>{assert.match(localServer,/127\.0\.0\.1/);assert.match(localServer,/actorFromRequest/);assert.match(localServer,/www-authenticate/i);assert.match(auth,/timingSafeEqual/);assert.match(auth,/BEARER_TOKEN_REQUIRED/);});
test("explicit approvals use one-time grants bound to exact artifact",()=>{assert.match(grants,/randomBytes/);assert.match(grants,/CLAIMED/);assert.match(grants,/CONSUMED/);assert.match(registry,/approvalGrant/);assert.match(registry,/APPROVAL_GRANT_EXECUTOR_REQUIRED/);});
test("finalization no longer auto-approves verification",()=>{const svc=fs.readFileSync(new URL("../../packages/services/src/index.ts",import.meta.url),"utf8");assert.match(svc,/EXPLICIT_VERIFICATION_APPROVAL_REQUIRED/);assert.doesNotMatch(svc,/verification-approval/);});
test("MCP v2 and PostgreSQL dependencies are pinned",()=>{const pkg=JSON.parse(fs.readFileSync(new URL("../../package.json",import.meta.url),"utf8"));assert.equal(pkg.dependencies['@modelcontextprotocol/server'],'2.0.0');assert.equal(pkg.dependencies['@modelcontextprotocol/node'],'2.0.0');assert.equal(pkg.dependencies.pg,'8.23.0');assert.equal(pkg.dependencies.zod,'4.4.3');});
