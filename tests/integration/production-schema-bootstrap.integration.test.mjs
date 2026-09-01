import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { ensureProductionSchema } from "../../dist-integration/services/mcp-server/src/ensure-production-schema.js";
import { PostgresProjectRepository } from "../../dist-integration/packages/postgres-repository/src/index.js";
import { ProjectWorkflowService } from "../../dist-integration/packages/services/src/index.js";

const { Client, Pool } = pg;
const dbUrl = process.env.VISUAL4D_TEST_DATABASE_URL;
const canRun = Boolean(dbUrl);

function schemaName(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

async function withAdmin(action) {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try { return await action(client); } finally { await client.end(); }
}

test("production schema bootstrap handles empty, repeated and unsafe partial states", { skip: !canRun }, async () => {
  const emptySchema = schemaName("visual4d_bootstrap");
  const partialSchema = schemaName("visual4d_partial");

  await withAdmin(async client => {
    await client.query(`CREATE SCHEMA ${emptySchema}`);
    await client.query(`CREATE SCHEMA ${partialSchema}`);
  });

  try {
    const firstBootstrap = await ensureProductionSchema(dbUrl, { searchPath: emptySchema });
    assert.equal(firstBootstrap.applied.length, 6);

    const pool = new Pool({ connectionString: dbUrl, options: `-c search_path=${emptySchema}` });
    const repo = new PostgresProjectRepository({ pool });
    const workflow = new ProjectWorkflowService(repo);
    const actor = {
      userId: "certification_user",
      permissions: ["visual4d:read", "visual4d:render", "visual4d:write", "visual4d:approve", "visual4d:identity"]
    };
    const context = { actor, requestId: "schema-bootstrap-project-create-001" };

    const created = await workflow.createProject("Certificación MCP Visual 4D", context, "FLYER");
    assert.ok(created.projectId.startsWith("project_"));
    assert.equal(created.name, "Certificación MCP Visual 4D");
    assert.equal(created.projectType, "FLYER");
    assert.equal(created.status, "DRAFT");
    assert.equal(created.currentStage, "DRAFT");

    const replay = await workflow.createProject("Certificación MCP Visual 4D", context, "FLYER");
    assert.deepEqual(replay, created, "idempotent replay must return the original server result");

    const migrationCount = await pool.query("SELECT count(*)::int AS count FROM visual4d_schema_migrations");
    assert.equal(migrationCount.rows[0].count, 6);
    const projectCount = await pool.query("SELECT count(*)::int AS count FROM projects WHERE id=$1", [created.projectId]);
    assert.equal(projectCount.rows[0].count, 1);
    await pool.end();

    const secondBootstrap = await ensureProductionSchema(dbUrl, { searchPath: emptySchema });
    assert.deepEqual(secondBootstrap.applied, [], "second bootstrap must be a no-op");

    await withAdmin(async client => {
      await client.query(`SET search_path TO ${partialSchema}`);
      await client.query("CREATE TABLE users(id TEXT PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT now())");
    });

    await assert.rejects(
      () => ensureProductionSchema(dbUrl, { searchPath: partialSchema }),
      /SCHEMA_PARTIAL_BASELINE_UNSAFE:users/
    );
  } finally {
    await withAdmin(async client => {
      await client.query(`DROP SCHEMA IF EXISTS ${emptySchema} CASCADE`);
      await client.query(`DROP SCHEMA IF EXISTS ${partialSchema} CASCADE`);
    });
  }
});
