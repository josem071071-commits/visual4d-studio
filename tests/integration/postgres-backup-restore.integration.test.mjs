import test from "node:test";
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {mkdtemp,rm} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const execFileAsync=promisify(execFile);
const databaseUrl=process.env.VISUAL4D_TEST_DATABASE_URL;
const reset=process.env.VISUAL4D_CERTIFICATION_ALLOW_SCHEMA_RESET==="true";
const skip=!databaseUrl||!reset;

test("V4D-SAT: logical PostgreSQL backup restores project, ledger and idempotency",{skip},async()=>{
  const {Pool}=await import("pg");
  const {ensureProductionSchema}=await import("../../dist-integration/services/mcp-server/src/ensure-production-schema.js");
  const {PostgresProjectRepository}=await import("../../dist-integration/packages/postgres-repository/src/index.js");
  const {ProjectWorkflowService}=await import("../../dist-integration/packages/services/src/index.js");

  const resetPool=new Pool({connectionString:databaseUrl});
  await resetPool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  await resetPool.end();
  await ensureProductionSchema(databaseUrl);

  const actor={userId:"usr_recovery",sessionId:"recovery",permissions:["visual4d:write"]};
  const title="V4D-SAT Recovery Certification";
  const projectType="FLYER";
  const requestId="recovery-create-1";
  const ctx={actor,requestId};
  const repo=new PostgresProjectRepository({connectionString:databaseUrl});
  const workflow=new ProjectWorkflowService(repo);
  const created=await workflow.createProject(title,ctx,projectType);
  await repo.close();

  const dir=await mkdtemp(path.join(os.tmpdir(),"visual4d-recovery-"));
  const dump=path.join(dir,"visual4d.dump");
  try{
    await execFileAsync("pg_dump",["--dbname",databaseUrl,"--format=custom","--no-owner","--no-privileges","--file",dump]);

    const destroy=new Pool({connectionString:databaseUrl});
    await destroy.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
    await destroy.end();

    await execFileAsync("pg_restore",["--dbname",databaseUrl,"--no-owner","--no-privileges","--exit-on-error",dump]);

    const verify=new Pool({connectionString:databaseUrl});
    const project=(await verify.query("SELECT id,title,current_stage,status FROM projects WHERE id=$1",[created.projectId])).rows[0];
    assert.equal(project.id,created.projectId);
    assert.equal(project.title,title);
    assert.equal(project.current_stage,"DRAFT");
    assert.equal(project.status,"DRAFT");

    const ledger=Number((await verify.query("SELECT count(*)::int AS n FROM visual4d_schema_migrations")).rows[0]?.n??0);
    assert.equal(ledger,6);

    const idempotency=(await verify.query(
      "SELECT status,result_json FROM idempotency_keys WHERE actor_user_id=$1 AND operation=$2 AND request_id=$3",
      [actor.userId,`project-create:${projectType}`,requestId]
    )).rows[0];
    assert.equal(idempotency.status,"COMPLETED");
    assert.equal(idempotency.result_json.projectId,created.projectId);
    await verify.end();

    const bootstrap=await ensureProductionSchema(databaseUrl);
    assert.deepEqual(bootstrap.applied,[]);

    const recoveredRepo=new PostgresProjectRepository({connectionString:databaseUrl});
    const recoveredWorkflow=new ProjectWorkflowService(recoveredRepo);
    const replay=await recoveredWorkflow.createProject(title,ctx,projectType);
    assert.equal(replay.projectId,created.projectId);
    await recoveredRepo.close();
  }finally{
    await rm(dir,{recursive:true,force:true});
  }
});
