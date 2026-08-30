import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const dbUrl = process.env.VISUAL4D_TEST_DATABASE_URL;
const psql = spawnSync("psql", ["--version"], { encoding: "utf8" });
const canRun = Boolean(dbUrl) && psql.status === 0;

function runPsql(sql, env = {}) {
  const result = spawnSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-X", "-q", "-t", "-A"], {
    input: sql,
    encoding: "utf8",
    env: { ...process.env, ...env }
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `psql exited ${result.status}`);
  }
  return result.stdout;
}

test("PostgreSQL migration UP/DOWN/UP is executable", { skip: !canRun }, () => {
  const up = fs.readFileSync(path.join(root, "database/migrations/0001_core.sql"), "utf8");
  const down = fs.readFileSync(path.join(root, "database/migrations/0001_core.down.sql"), "utf8");
  const schema = `visual4d_test_${Date.now()}`;
  try {
    runPsql(`CREATE SCHEMA ${schema};`);
    const pgOptions = { PGOPTIONS: `-c search_path=${schema}` };
    runPsql(up, pgOptions);
    runPsql(down, pgOptions);
    runPsql(up, pgOptions);
    const output = runPsql(
      "SELECT count(*) FROM information_schema.tables WHERE table_schema = current_schema();",
      pgOptions
    );
    const count = Number(output.trim());
    assert.ok(count >= 9, `expected at least 9 tables after second UP, got ${count}`);
  } finally {
    try { runPsql(`DROP SCHEMA IF EXISTS ${schema} CASCADE;`); } catch {}
  }
});
