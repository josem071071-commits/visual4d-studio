import test from "node:test";
import assert from "node:assert/strict";

const databaseUrl=process.env.VISUAL4D_TEST_DATABASE_URL;
const reset=process.env.VISUAL4D_CERTIFICATION_ALLOW_SCHEMA_RESET==="true";
const skip=!databaseUrl||!reset;

const EXPECTED_TOOLS=[
  "projects.create",
  "method.analyze",
  "method.structure",
  "method.resolve_resources",
  "method.art_direct",
  "generation.render_preview",
  "generation.create_design",
  "verification.save",
  "approvals.approve_stage",
  "versions.mark_final",
  "identity.activate_version"
].sort();

const renderInput={
  intent:{headlineProminence:"HIGH",headlineZone:"UPPER_LEFT",heroZone:"CENTER",negativeSpace:"HIGH",textDensity:"LOW",alignment:"LEFT_DOMINANT"},
  content:{headline:"V4D-SAT Certification",body:["11 herramientas","flujo integral"],footer:"release candidate"},
  identity:{version:"visual4d.identity.v1",colors:{background:"#FFFFFF",primary:"#173B57",text:"#111827",mutedText:"#4B5563",heroSurface:"#E8EDF2"},typography:{family:"SYSTEM_SANS"}}
};

test("V4D-SAT: all 11 MCP tools execute in one real PostgreSQL workflow",{skip},async()=>{
  const {Pool}=await import("pg");
  const {ensureProductionSchema}=await import("../../dist-integration/services/mcp-server/src/ensure-production-schema.js");
  const {createLocalMcpHttpServer}=await import("../../dist-integration/services/mcp-server/src/local-server.js");
  const {Client,StreamableHTTPClientTransport}=await import("@modelcontextprotocol/client");

  const bootstrapPool=new Pool({connectionString:databaseUrl});
  await bootstrapPool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  await bootstrapPool.end();
  await ensureProductionSchema(databaseUrl);

  const pool=new Pool({connectionString:databaseUrl});
  const app=createLocalMcpHttpServer({
    databaseUrl,
    auth:{tokenIdentities:[{token:"v4d-sat-token",identity:{userId:"usr_v4d_sat"}}]},
    allowDevApprovalGrants:true,
    port:0,
    rateLimitPerMinute:500
  });

  const {url:mcpUrl,baseUrl}=await app.listen();
  const client=new Client({name:"v4d-sat-certifier",version:"0.9.0-rc"});
  await client.connect(new StreamableHTTPClientTransport(new URL(mcpUrl),{requestInit:{headers:{Authorization:"Bearer v4d-sat-token"}}}));

  let seq=0;
  const callRaw=(name,args)=>client.callTool({name,arguments:args});
  const call=async(name,args)=>{
    const response=await callRaw(name,args);
    const text=response.content.find(x=>x.type==="text");
    const data=JSON.parse(text?.text??"{}");
    if(response.isError)throw new Error(data.error??"MCP_TOOL_ERROR");
    return data;
  };
  const grant=async(projectId,kind,artifactVersionId)=>{
    const response=await fetch(`${baseUrl}/local/approval-grants`,{
      method:"POST",
      headers:{Authorization:"Bearer v4d-sat-token","content-type":"application/json","x-visual4d-dev-user-action":"approve"},
      body:JSON.stringify({projectId,kind,artifactVersionId})
    });
    assert.equal(response.status,201);
    return (await response.json()).approvalGrant;
  };
  const approve=async(projectId,kind,id)=>call("approvals.approve_stage",{
    projectId,kind,artifactVersionId:id,approvalGrant:await grant(projectId,kind,id),requestId:`sat-${++seq}`
  });

  try{
    // Catalog contract: exactly the 11 user-facing tools expected by V4D-SAT.
    const listed=await client.listTools();
    assert.deepEqual(listed.tools.map(t=>t.name).sort(),EXPECTED_TOOLS);

    // 1) projects.create — real owner/institution/identity bootstrap + idempotent replay.
    const createArgs={name:"V4D-SAT Full Workflow Certification",projectType:"FLYER",requestId:"sat-create-1"};
    const project=await call("projects.create",createArgs);
    assert.match(project.projectId,/^project_/);
    assert.equal(project.currentStage,"DRAFT");
    assert.equal(project.status,"DRAFT");
    const replay=await call("projects.create",createArgs);
    assert.equal(replay.projectId,project.projectId);

    const projectRow=(await pool.query("SELECT * FROM projects WHERE id=$1",[project.projectId])).rows[0];
    assert.ok(projectRow);
    const institutionId=projectRow.institution_id;
    const originalIdentityId=projectRow.identity_version_id;

    // Seed the resource contract required by a FLYER after project bootstrap.
    for(const [id,type,versionId,hash,isMaster] of [
      ["sat_logo","LOGO","sat_logo_v1","a",true],
      ["sat_banner","BANNER","sat_banner_v1","b",true],
      ["sat_photo","PHOTO_DOCUMENTARY","sat_photo_v1","c",false]
    ]){
      await pool.query(
        "INSERT INTO assets(id,institution_id,owner_user_id,type,name,is_master,generative_edit_allowed,status) VALUES($1,$2,'usr_v4d_sat',$3,$1,$4,false,'ACTIVE')",
        [id,institutionId,type,isMaster]
      );
      await pool.query(
        "INSERT INTO asset_versions(id,asset_id,version_number,storage_key,mime_type,checksum_sha256,status) VALUES($1,$2,1,$1,'image/png',$3,'ACTIVE')",
        [versionId,id,hash.repeat(64)]
      );
      await pool.query("UPDATE assets SET current_version_id=$2 WHERE id=$1",[id,versionId]);
    }

    // 2) generation.render_preview — read-only deterministic renderer through MCP.
    const preview=await call("generation.render_preview",renderInput);
    assert.equal(preview.version,"visual4d.render-service.v1");
    assert.match(preview.svg,/<svg/);

    // State-machine guard: structure cannot be skipped ahead before analysis approval.
    const premature=await callRaw("method.structure",{projectId:project.projectId,payload:{headline:"invalid"},requestId:"sat-premature"});
    assert.equal(premature.isError,true);

    // 3) method.analyze + 4) approvals.approve_stage.
    const analysis=await call("method.analyze",{projectId:project.projectId,sourceContent:"Documento fuente V4D-SAT",requestId:`sat-${++seq}`});
    await approve(project.projectId,"ANALYSIS",analysis.id);

    // 5) method.structure.
    const structure=await call("method.structure",{projectId:project.projectId,payload:{headline:"Certificación integral",sections:["evidencia","acción"]},requestId:`sat-${++seq}`});
    await approve(project.projectId,"STRUCTURE",structure.id);

    // 6) method.resolve_resources.
    const resources=await call("method.resolve_resources",{projectId:project.projectId,requestId:`sat-${++seq}`});
    assert.deepEqual(resources.payload?.missingResources??[],[]);
    await approve(project.projectId,"RESOURCES",resources.id);

    // 7) method.art_direct.
    const artDirection=await call("method.art_direct",{projectId:project.projectId,payload:{layout:"editorial",priority:"clarity"},requestId:`sat-${++seq}`});
    await approve(project.projectId,"ART_DIRECTION",artDirection.id);

    // 8) generation.create_design.
    const design=await call("generation.create_design",{projectId:project.projectId,renderUri:"memory://v4d-sat-certification.svg",requestId:`sat-${++seq}`});

    // 9) verification.save.
    const verification=await call("verification.save",{projectId:project.projectId,designVersionId:design.id,passed:true,criticalErrors:[],score:100,requestId:`sat-${++seq}`});
    await approve(project.projectId,"VERIFICATION",verification.id);

    // 10) versions.mark_final.
    const finalProject=await call("versions.mark_final",{projectId:project.projectId,verificationVersionId:verification.id,requestId:`sat-${++seq}`});
    assert.equal(finalProject.currentStage,"FINAL");
    assert.equal(finalProject.finalDesignVersionId,design.id);

    // 11) identity.activate_version — activate a second owner-bound identity atomically.
    const secondIdentity="sat_identity_v2";
    await pool.query(
      "INSERT INTO identity_versions(id,institution_id,version_number,name,status) VALUES($1,$2,2,'V4D-SAT v2','ACTIVE')",
      [secondIdentity,institutionId]
    );
    const identityResult=await call("identity.activate_version",{institutionId,identityVersionId:secondIdentity,requestId:`sat-${++seq}`});
    assert.equal(identityResult.activeIdentityVersionId,secondIdentity);
    const institution=(await pool.query("SELECT active_identity_version_id FROM institutions WHERE id=$1",[institutionId])).rows[0];
    assert.equal(institution.active_identity_version_id,secondIdentity);
    assert.notEqual(secondIdentity,originalIdentityId);

    // Persistence/audit assertions survive reread from PostgreSQL.
    const persisted=(await pool.query("SELECT current_stage,status,final_design_version_id FROM projects WHERE id=$1",[project.projectId])).rows[0];
    assert.equal(persisted.current_stage,"FINAL");
    assert.equal(persisted.status,"FINAL");
    assert.equal(persisted.final_design_version_id,design.id);
    const auditCount=Number((await pool.query("SELECT count(*)::int AS n FROM audit_events WHERE project_id=$1",[project.projectId])).rows[0]?.n??0);
    assert.ok(auditCount>0);
  } finally {
    await client.close();
    await app.close();
    await pool.end();
  }
});
