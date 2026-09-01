import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const databaseUrl=process.env.VISUAL4D_TEST_DATABASE_URL;
const reset=process.env.VISUAL4D_CERTIFICATION_ALLOW_SCHEMA_RESET==="true";
const skip=!databaseUrl||!reset;

async function fkState(pool){
  const result=await pool.query(`
    SELECT condeferrable, condeferred
      FROM pg_constraint
     WHERE conname='idempotency_keys_actor_user_id_fkey'
  `);
  assert.equal(result.rows.length,1);
  return result.rows[0];
}

test("V4D-SAT: migration 0006 is reversible and re-applicable",{skip},async()=>{
  const {Pool}=await import("pg");
  const {ensureProductionSchema}=await import("../../dist-integration/services/mcp-server/src/ensure-production-schema.js");
  const resetPool=new Pool({connectionString:databaseUrl});
  await resetPool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  await resetPool.end();

  await ensureProductionSchema(databaseUrl);
  const pool=new Pool({connectionString:databaseUrl});
  try{
    let state=await fkState(pool);
    assert.equal(state.condeferrable,true);
    assert.equal(state.condeferred,true);

    const down=await fs.readFile(new URL("../../database/migrations/0006_idempotency_actor_fk_deferred.down.sql",import.meta.url),"utf8");
    await pool.query(down);
    state=await fkState(pool);
    assert.equal(state.condeferrable,false);
    assert.equal(state.condeferred,false);

    const up=await fs.readFile(new URL("../../database/migrations/0006_idempotency_actor_fk_deferred.sql",import.meta.url),"utf8");
    await pool.query(up);
    state=await fkState(pool);
    assert.equal(state.condeferrable,true);
    assert.equal(state.condeferred,true);
  } finally {
    await pool.end();
  }
});
