import test from "node:test";
import assert from "node:assert/strict";

const databaseUrl=process.env.VISUAL4D_TEST_DATABASE_URL;
const reset=process.env.VISUAL4D_CERTIFICATION_ALLOW_SCHEMA_RESET==="true";
const skip=!databaseUrl||!reset;

test("V4D-SAT: health stays live while readiness reflects PostgreSQL schema state",{skip},async()=>{
  const {Pool}=await import("pg");
  const {ensureProductionSchema}=await import("../../dist-integration/services/mcp-server/src/ensure-production-schema.js");
  const {createProductionMcpHttpServer}=await import("../../dist-integration/services/mcp-server/src/production-server.js");

  const resetPool=new Pool({connectionString:databaseUrl});
  await resetPool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  await resetPool.end();

  const verifier={verify:async()=>{throw new Error("NOT_USED_BY_READINESS");}};
  const app=createProductionMcpHttpServer({
    databaseUrl,
    verifier,
    issuer:"https://issuer.example/",
    resourceUri:"https://mcp.example/mcp",
    host:"127.0.0.1",
    port:0
  });
  const {baseUrl}=await app.listen();

  try{
    const liveBefore=await fetch(`${baseUrl}/healthz`);
    assert.equal(liveBefore.status,200);
    assert.equal((await liveBefore.json()).ok,true);

    const notReady=await fetch(`${baseUrl}/readyz`);
    assert.equal(notReady.status,503);
    assert.equal((await notReady.json()).code,"SCHEMA_LEDGER_MISSING");

    await ensureProductionSchema(databaseUrl);
    const ready=await fetch(`${baseUrl}/readyz`);
    assert.equal(ready.status,200);
    const readyBody=await ready.json();
    assert.equal(readyBody.ok,true);
    assert.equal(readyBody.migrations,6);
    assert.equal(readyBody.tables,17);

    await app.repo.pool.query("DROP TABLE approval_grants");
    const degraded=await fetch(`${baseUrl}/readyz`);
    assert.equal(degraded.status,503);
    assert.equal((await degraded.json()).code,"SCHEMA_TABLES_INCOMPLETE");

    const liveAfter=await fetch(`${baseUrl}/healthz`);
    assert.equal(liveAfter.status,200);
  }finally{
    await app.close();
  }
});
