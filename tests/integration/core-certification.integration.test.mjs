import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const url=process.env.VISUAL4D_TEST_DATABASE_URL;
const reset=process.env.VISUAL4D_CERTIFICATION_ALLOW_SCHEMA_RESET==="true";
const skip=!url||!reset;
const migrations=["0001_core.sql","0002_sprint2_hardening.sql","0003_sprint2_1_security.sql","0004_sprint2_2_pg_mcp.sql","0005_sprint2_3_core_certification.sql"];

async function applyMigrations(pool){for(const f of migrations)await pool.query(await fs.readFile(new URL(`../../database/migrations/${f}`,import.meta.url),"utf8"));}
async function seed(pool){
  await pool.query("INSERT INTO users(id) VALUES('usr_a'),('usr_b')");
  await pool.query("INSERT INTO institutions(id,owner_user_id,name,status) VALUES('inst_a','usr_a','A','ACTIVE'),('inst_b','usr_b','B','ACTIVE')");
  await pool.query("INSERT INTO identity_versions(id,institution_id,version_number,name,status) VALUES('idv_a','inst_a',1,'v1','ACTIVE'),('idv_b','inst_b',1,'v1','ACTIVE')");
  await pool.query("UPDATE institutions SET active_identity_version_id=CASE id WHEN 'inst_a' THEN 'idv_a' ELSE 'idv_b' END");
  await pool.query(`INSERT INTO projects(id,owner_user_id,institution_id,identity_version_id,project_type,title,format_width,format_height,orientation,current_stage,status)
    VALUES('proj_a','usr_a','inst_a','idv_a','FLYER','A Flyer',1080,1920,'PORTRAIT','DRAFT','DRAFT'),('proj_b','usr_b','inst_b','idv_b','FLYER','B Flyer',1080,1920,'PORTRAIT','DRAFT','DRAFT')`);
  for(const [id,type,vid,hash] of [['logo_a','LOGO','vlogo_a','a'],['banner_a','BANNER','vbanner_a','b'],['photo_a','PHOTO_DOCUMENTARY','vphoto_a','c']]){
    await pool.query("INSERT INTO assets(id,institution_id,owner_user_id,type,name,is_master,generative_edit_allowed,status) VALUES($1,'inst_a','usr_a',$2,$1,$3,false,'ACTIVE')",[id,type,type!=='PHOTO_DOCUMENTARY']);
    await pool.query("INSERT INTO asset_versions(id,asset_id,version_number,storage_key,mime_type,checksum_sha256,status) VALUES($1,$2,1,$1,'image/png',$3,'ACTIVE')",[vid,id,hash.repeat(64)]);
    await pool.query("UPDATE assets SET current_version_id=$2 WHERE id=$1",[id,vid]);
  }
}

test("Core Certification: PostgreSQL atomicity, concurrency, authorization, grants and MCP E2E",{skip},async()=>{
  const {Pool}=await import("pg");
  const {PostgresProjectRepository}=await import("../../dist-integration/packages/postgres-repository/src/index.js");
  const {ProjectWorkflowService}=await import("../../dist-integration/packages/services/src/index.js");
  const {PostgresApprovalGrantStore}=await import("../../dist-integration/services/mcp-server/src/approval-grants.js");
  const {createLocalMcpHttpServer}=await import("../../dist-integration/services/mcp-server/src/local-server.js");
  const {Client,StreamableHTTPClientTransport}=await import("@modelcontextprotocol/client");
  const pool=new Pool({connectionString:url});
  try{
    await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
    await applyMigrations(pool);await seed(pool);
    const repo=new PostgresProjectRepository({pool});const svc=new ProjectWorkflowService(repo);
    const actorA={userId:"usr_a",sessionId:"cert",permissions:["visual4d:write"]},actorB={userId:"usr_b",sessionId:"cert",permissions:["visual4d:write"]};

    // Cross-user isolation.
    await assert.rejects(()=>svc.startAnalysis("proj_a","x",{actor:actorB,requestId:"b-attack"}),/FORBIDDEN_PROJECT_OWNER_MISMATCH/);

    // Transaction rollback: artifact + stage changes vanish together.
    await assert.rejects(()=>repo.runIdempotentMutation({requestId:"rollback",actorUserId:"usr_a",operation:"cert-rollback"},async()=>{
      await repo.createArtifactVersion({projectId:"proj_a",kind:"ANALYSIS",payload:{forced:true}});throw new Error("FORCED_FAILURE");
    }),/FORCED_FAILURE/);
    assert.equal(await repo.getLatestArtifact("proj_a","ANALYSIS"),null);

    // Concurrent duplicate idempotency produces one side effect.
    let calls=0;
    const duplicate=()=>repo.runIdempotentMutation({requestId:"same",actorUserId:"usr_a",operation:"cert-concurrent"},async()=>{calls++;await new Promise(r=>setTimeout(r,30));return{ok:true};});
    const [c1,c2]=await Promise.all([duplicate(),duplicate()]);assert.deepEqual(c1,{ok:true});assert.deepEqual(c2,{ok:true});assert.equal(calls,1);

    // Grant retry lifecycle.
    const analysis=await svc.startAnalysis("proj_a","source",{actor:actorA,requestId:"a1"});
    await svc.validateApprovalCandidate("proj_a","ANALYSIS",analysis.id,actorA);
    const grantStore=new PostgresApprovalGrantStore(pool);const token=await grantStore.issue({userId:"usr_a",projectId:"proj_a",kind:"ANALYSIS",artifactVersionId:analysis.id},60000);
    await assert.rejects(()=>grantStore.withClaim(token,{userId:"usr_a",projectId:"proj_a",kind:"ANALYSIS",artifactVersionId:analysis.id},async()=>{throw new Error("TRANSIENT");}),/TRANSIENT/);
    const state1=await pool.query("SELECT state FROM approval_grants");assert.equal(state1.rows[0].state,"ISSUED");
    await grantStore.withClaim(token,{userId:"usr_a",projectId:"proj_a",kind:"ANALYSIS",artifactVersionId:analysis.id},()=>svc.approve("proj_a","ANALYSIS",analysis.id,{actor:actorA,requestId:"a-approve"}));
    const state2=await pool.query("SELECT state FROM approval_grants");assert.equal(state2.rows[0].state,"CONSUMED");

    // Reset project A for full MCP E2E while preserving schema.
    await pool.query("DELETE FROM approvals; DELETE FROM approval_grants; DELETE FROM idempotency_keys; DELETE FROM verification_versions; DELETE FROM design_versions; DELETE FROM art_direction_versions; DELETE FROM resource_versions; DELETE FROM structure_versions; DELETE FROM analysis_versions; UPDATE projects SET current_stage='DRAFT',status='DRAFT',revision=0,final_design_version_id=NULL WHERE id='proj_a'");

    const app=createLocalMcpHttpServer({databaseUrl:url,auth:{tokenIdentities:[{token:"token-a",identity:{userId:"usr_a"}},{token:"token-b",identity:{userId:"usr_b"}}]},allowDevApprovalGrants:true,port:0,rateLimitPerMinute:500});
    const {url:mcpUrl,baseUrl}=await app.listen();
    const clientA=new Client({name:"cert-a",version:"0.2.3"});const clientB=new Client({name:"cert-b",version:"0.2.3"});
    await clientA.connect(new StreamableHTTPClientTransport(new URL(mcpUrl),{requestInit:{headers:{Authorization:"Bearer token-a"}}}));
    await clientB.connect(new StreamableHTTPClientTransport(new URL(mcpUrl),{requestInit:{headers:{Authorization:"Bearer token-b"}}}));
    let seq=0;const call=async(client,name,args)=>{const r=await client.callTool({name,arguments:args});const t=r.content.find(x=>x.type==="text");const data=JSON.parse(t?.text??"{}");if(r.isError)throw new Error(data.error??"MCP_TOOL_ERROR");return data;};
    const grant=async(kind,id)=>{const r=await fetch(`${baseUrl}/local/approval-grants`,{method:"POST",headers:{Authorization:"Bearer token-a","content-type":"application/json","x-visual4d-dev-user-action":"approve"},body:JSON.stringify({projectId:"proj_a",kind,artifactVersionId:id})});assert.equal(r.status,201);return(await r.json()).approvalGrant;};
    const approve=async(kind,id)=>call(clientA,"approvals.approve_stage",{projectId:"proj_a",kind,artifactVersionId:id,approvalGrant:await grant(kind,id),requestId:`m${++seq}`});

    const ma=await call(clientA,"method.analyze",{projectId:"proj_a",sourceContent:"cert",requestId:`m${++seq}`});
    await assert.rejects(()=>call(clientB,"method.structure",{projectId:"proj_a",payload:{headline:"attack"},requestId:"attack"}),/FORBIDDEN/);
    await approve("ANALYSIS",ma.id);
    const ms=await call(clientA,"method.structure",{projectId:"proj_a",payload:{headline:"H"},requestId:`m${++seq}`});await approve("STRUCTURE",ms.id);
    const mr=await call(clientA,"method.resolve_resources",{projectId:"proj_a",requestId:`m${++seq}`});await approve("RESOURCES",mr.id);
    const md=await call(clientA,"method.art_direct",{projectId:"proj_a",payload:{layout:"editorial"},requestId:`m${++seq}`});await approve("ART_DIRECTION",md.id);
    const design=await call(clientA,"generation.create_design",{projectId:"proj_a",renderUri:"memory://cert.png",requestId:`m${++seq}`});
    const ver=await call(clientA,"verification.save",{projectId:"proj_a",designVersionId:design.id,passed:true,criticalErrors:[],score:99,requestId:`m${++seq}`});await approve("VERIFICATION",ver.id);
    const final=await call(clientA,"versions.mark_final",{projectId:"proj_a",verificationVersionId:ver.id,requestId:`m${++seq}`});assert.equal(final.currentStage,"FINAL");assert.equal(final.finalDesignVersionId,design.id);
    await clientA.close();await clientB.close();await app.close();

    // Migration round trip is executed against a real database.
    for(const f of [...migrations].reverse()){
      const down=f.replace(/\.sql$/,".down.sql");await pool.query(await fs.readFile(new URL(`../../database/migrations/${down}`,import.meta.url),"utf8"));
    }
    for(const f of migrations)await pool.query(await fs.readFile(new URL(`../../database/migrations/${f}`,import.meta.url),"utf8"));
  } finally {await pool.end();}
});
