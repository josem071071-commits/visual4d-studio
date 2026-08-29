import test from "node:test";
import assert from "node:assert/strict";
import { MemoryProjectRepository } from "../../dist/packages/repositories/src/index.js";
import { ProjectWorkflowService, ServiceError } from "../../dist/packages/services/src/index.js";
import { createVisual4DToolRegistry } from "../../dist/services/mcp-server/src/tool-registry.js";
import { TransitionError } from "../../dist/packages/state-machine/src/index.js";

const actor = { userId: "usr_demo", sessionId: "sess_1", permissions: ["visual4d:write"] };
const otherActor = { userId: "usr_other", sessionId: "sess_2", permissions: ["visual4d:write"] };
let seq = 0;
const ctx = (a=actor) => ({ actor:a, requestId:`req_${++seq}` });

function fixture({ badMasterVersion = false, includeHero = true } = {}) {
  const repo = new MemoryProjectRepository();
  repo.seed({
    institutions: [{ id: "inst_demo", ownerUserId: "usr_demo", name: "Demo", activeIdentityVersionId: "idv_1", status: "ACTIVE" }],
    identities: [
      { id: "idv_1", institutionId: "inst_demo", versionNumber: 1, status: "ACTIVE" },
      { id: "idv_2", institutionId: "inst_demo", versionNumber: 2, status: "DRAFT" }
    ],
    projects: [{
      id: "proj_1", ownerUserId: "usr_demo", institutionId: "inst_demo", identityVersionId: "idv_1",
      projectType: "FLYER", title: "Demo flyer", width: 1080, height: 1920, orientation: "PORTRAIT",
      currentStage: "DRAFT", status: "DRAFT", revision:0, finalDesignVersionId:null
    }],
    assets: [
      { id: "asset_logo", institutionId: "inst_demo", ownerUserId: "usr_demo", type: "LOGO", isMaster: true, generativeEditAllowed: false, currentVersionId: "av_logo_1", status: "ACTIVE" },
      { id: "asset_banner", institutionId: "inst_demo", ownerUserId: "usr_demo", type: "BANNER", isMaster: true, generativeEditAllowed: false, currentVersionId: "av_banner_1", status: "ACTIVE" },
      ...(includeHero ? [{ id: "asset_photo", institutionId: "inst_demo", ownerUserId: "usr_demo", type: "PHOTO_DOCUMENTARY", isMaster: false, generativeEditAllowed: false, currentVersionId: "av_photo_1", status: "ACTIVE" }] : [])
    ],
    assetVersions: [
      { id: "av_logo_1", assetId: "asset_logo", status: badMasterVersion ? "ARCHIVED" : "ACTIVE", checksumSha256: "a".repeat(64) },
      { id: "av_banner_1", assetId: "asset_banner", status: "ACTIVE", checksumSha256: "b".repeat(64) },
      ...(includeHero ? [{ id: "av_photo_1", assetId: "asset_photo", status: "ACTIVE", checksumSha256: "c".repeat(64) }] : [])
    ]
  });
  return { repo, service: new ProjectWorkflowService(repo) };
}

async function happyPathUntilArtDirection(service) {
  const analysis = await service.startAnalysis("proj_1", "Source content", ctx());
  await service.approve("proj_1", "ANALYSIS", analysis.id, ctx());
  const structure = await service.structure("proj_1", { headline: "Headline" }, ctx());
  await service.approve("proj_1", "STRUCTURE", structure.id, ctx());
  const resources = await service.resolveResources("proj_1", ctx());
  await service.approve("proj_1", "RESOURCES", resources.id, ctx());
  const art = await service.artDirect("proj_1", { layoutFamily: "editorial_modular" }, ctx());
  return { analysis, structure, resources, art };
}

test("Sprint 2.1 completes gated workflow with exact DesignVersion to FINAL", async () => {
  const { repo, service } = fixture();
  const { art } = await happyPathUntilArtDirection(service);
  await service.approve("proj_1", "ART_DIRECTION", art.id, ctx());
  const design = await service.createDesignVersion("proj_1", { renderUri:"memory://render.png" }, ctx());
  const verification = await service.saveVerification("proj_1", { designVersionId:design.id, passed:true, criticalErrors:[], score:97 }, ctx());
  await service.approve("proj_1", "VERIFICATION", verification.id, ctx());
  const final = await service.approveDesign("proj_1", verification.id, ctx());
  assert.equal(final.currentStage, "FINAL");
  assert.equal(final.finalDesignVersionId, design.id);
  assert.equal((await repo.getProject("proj_1"))?.finalDesignVersionId, design.id);
});

test("unauthorized actor cannot access project", async () => {
  const { service } = fixture();
  await assert.rejects(() => service.startAnalysis("proj_1", "x", ctx(otherActor)), e => e instanceof ServiceError && e.code === "FORBIDDEN_PROJECT_OWNER_MISMATCH");
});

test("structure is blocked without exact analysis approval", async () => {
  const { service } = fixture();
  await service.startAnalysis("proj_1", "Source content", ctx());
  await assert.rejects(() => service.structure("proj_1", { headline: "No" }, ctx()), e => e instanceof TransitionError && e.code === "ANALYSIS_APPROVAL_REQUIRED");
});

test("resource resolver reports missing hero media and blocks art direction", async () => {
  const { service } = fixture({ includeHero:false });
  const analysis = await service.startAnalysis("proj_1", "Source", ctx());
  await service.approve("proj_1", "ANALYSIS", analysis.id, ctx());
  const structure = await service.structure("proj_1", {headline:"H"}, ctx());
  await service.approve("proj_1", "STRUCTURE", structure.id, ctx());
  const resources = await service.resolveResources("proj_1", ctx());
  assert.equal(resources.payload.missingResources[0].type, "HERO_MEDIA");
  await service.approve("proj_1", "RESOURCES", resources.id, ctx());
  await assert.rejects(() => service.artDirect("proj_1", {}, ctx()), e => e instanceof ServiceError && e.code === "REQUIRED_RESOURCES_MISSING");
});

test("inactive current version blocks MASTER ASSET resource resolution", async () => {
  const { service } = fixture({ badMasterVersion:true });
  const analysis = await service.startAnalysis("proj_1", "Source", ctx());
  await service.approve("proj_1", "ANALYSIS", analysis.id, ctx());
  const structure = await service.structure("proj_1", {headline:"H"}, ctx());
  await service.approve("proj_1", "STRUCTURE", structure.id, ctx());
  await assert.rejects(() => service.resolveResources("proj_1", ctx()), e => e instanceof ServiceError && e.code === "MASTER_ASSET_CURRENT_VERSION_NOT_ACTIVE");
});

test("verification requires exact current DesignVersion", async () => {
  const { service } = fixture();
  const { art } = await happyPathUntilArtDirection(service);
  await service.approve("proj_1", "ART_DIRECTION", art.id, ctx());
  const design = await service.createDesignVersion("proj_1", {renderUri:"memory://one.png"}, ctx());
  await assert.rejects(() => service.saveVerification("proj_1", {designVersionId:design.id+"x",passed:true,criticalErrors:[],score:90}, ctx()), e => e instanceof ServiceError && e.code === "DESIGN_VERSION_MISMATCH");
});

test("critical verification error blocks FINAL", async () => {
  const { service } = fixture();
  const { art } = await happyPathUntilArtDirection(service);
  await service.approve("proj_1", "ART_DIRECTION", art.id, ctx());
  const design = await service.createDesignVersion("proj_1", {renderUri:"memory://one.png"}, ctx());
  const verification = await service.saveVerification("proj_1", {designVersionId:design.id,passed:true,criticalErrors:["WRONG_DATE"],score:96}, ctx());
  await service.approve("proj_1", "VERIFICATION", verification.id, ctx());
  await assert.rejects(() => service.approveDesign("proj_1", verification.id, ctx()), e => e instanceof TransitionError && e.code === "CRITICAL_ERRORS_BLOCK_APPROVAL");
});

test("idempotent mutation returns same analysis version", async () => {
  const { service } = fixture();
  const c = {actor, requestId:"same-request"};
  const a = await service.startAnalysis("proj_1", "Source", c);
  const b = await service.startAnalysis("proj_1", "Source", c);
  assert.equal(a.id,b.id);
});

test("identity activation archives old ACTIVE and updates institution pointer", async () => {
  const { repo, service } = fixture();
  await service.activateIdentity("inst_demo","idv_2",ctx());
  assert.equal((await repo.getInstitution("inst_demo"))?.activeIdentityVersionId,"idv_2");
  assert.equal((await repo.getIdentityVersion("idv_1"))?.status,"ARCHIVED");
  assert.equal((await repo.getIdentityVersion("idv_2"))?.status,"ACTIVE");
});

test("MCP registry injects actor and rejects permissive boolean coercion", async () => {
  const { service } = fixture();
  const tools = createVisual4DToolRegistry(service, () => actor);
  const names = tools.map(t=>t.name);
  assert.ok(names.includes("generation.create_design"));
  assert.ok(names.includes("identity.activate_version"));
  const analyze = tools.find(t=>t.name === "method.analyze");
  const artifact = await analyze.execute({projectId:"proj_1",sourceContent:"MCP",requestId:"mcp-1"});
  assert.equal(artifact.kind,"ANALYSIS");
  const verification = tools.find(t=>t.name === "verification.save");
  await assert.rejects(() => verification.execute({projectId:"proj_1",designVersionId:"d",passed:"false",criticalErrors:[],score:90,requestId:"bad"}), /INVALID_PASSED/);
});
