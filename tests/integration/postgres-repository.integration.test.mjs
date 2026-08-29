import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const url=process.env.VISUAL4D_TEST_DATABASE_URL;

test("PostgresProjectRepository persists a full gated workflow",{skip:!url},async()=>{
  const {Pool}=await import("pg");
  const {PostgresProjectRepository}=await import("../../dist-integration/packages/postgres-repository/src/index.js");
  const {ProjectWorkflowService}=await import("../../dist-integration/packages/services/src/index.js");
  const pool=new Pool({connectionString:url});
  try{
    for(const f of ["0001_core.sql","0002_sprint2_hardening.sql","0003_sprint2_1_security.sql","0004_sprint2_2_pg_mcp.sql"]){await pool.query(await fs.readFile(new URL(`../../database/migrations/${f}`,import.meta.url),"utf8"));}
    await pool.query("INSERT INTO users(id) VALUES('usr_pg')");
    await pool.query("INSERT INTO institutions(id,owner_user_id,name,status) VALUES('inst_pg','usr_pg','PG Demo','ACTIVE')");
    await pool.query("INSERT INTO identity_versions(id,institution_id,version_number,name,status) VALUES('idv_pg','inst_pg',1,'v1','ACTIVE')");
    await pool.query("UPDATE institutions SET active_identity_version_id='idv_pg' WHERE id='inst_pg'");
    await pool.query(`INSERT INTO projects(id,owner_user_id,institution_id,identity_version_id,project_type,title,format_width,format_height,orientation,current_stage,status)
      VALUES('proj_pg','usr_pg','inst_pg','idv_pg','FLYER','PG Flyer',1080,1920,'PORTRAIT','DRAFT','DRAFT')`);
    for(const [id,type,vid,hash] of [['logo','LOGO','vlogo','a'],['banner','BANNER','vbanner','b'],['photo','PHOTO_DOCUMENTARY','vphoto','c']]){
      await pool.query("INSERT INTO assets(id,institution_id,owner_user_id,type,name,is_master,generative_edit_allowed,status) VALUES($1,'inst_pg','usr_pg',$2,$1,$3,false,'ACTIVE')",[id,type,type!=='PHOTO_DOCUMENTARY']);
      await pool.query("INSERT INTO asset_versions(id,asset_id,version_number,storage_key,mime_type,checksum_sha256,status) VALUES($1,$2,1,$1,'image/png',$3,'ACTIVE')",[vid,id,hash.repeat(64)]);
      await pool.query("UPDATE assets SET current_version_id=$2 WHERE id=$1",[id,vid]);
    }
    const repo=new PostgresProjectRepository({pool}); const svc=new ProjectWorkflowService(repo); let n=0; const ctx=()=>({actor:{userId:'usr_pg',sessionId:'it',permissions:['visual4d:write']},requestId:`r${++n}`});
    const a=await svc.startAnalysis('proj_pg','source',ctx()); await svc.approve('proj_pg','ANALYSIS',a.id,ctx());
    const s=await svc.structure('proj_pg',{headline:'H'},ctx()); await svc.approve('proj_pg','STRUCTURE',s.id,ctx());
    const r=await svc.resolveResources('proj_pg',ctx()); await svc.approve('proj_pg','RESOURCES',r.id,ctx());
    const art=await svc.artDirect('proj_pg',{layout:'editorial'},ctx()); await svc.approve('proj_pg','ART_DIRECTION',art.id,ctx());
    const d=await svc.createDesignVersion('proj_pg',{renderUri:'memory://pg.png'},ctx());
    const v=await svc.saveVerification('proj_pg',{designVersionId:d.id,passed:true,criticalErrors:[],score:96},ctx());
    await assert.rejects(()=>svc.approveDesign('proj_pg',v.id,ctx()),/EXPLICIT_VERIFICATION_APPROVAL_REQUIRED/);
    await svc.approve('proj_pg','VERIFICATION',v.id,ctx()); const final=await svc.approveDesign('proj_pg',v.id,ctx());
    assert.equal(final?.currentStage,'FINAL'); assert.equal(final?.finalDesignVersionId,d.id);
  } finally { await pool.end(); }
});
