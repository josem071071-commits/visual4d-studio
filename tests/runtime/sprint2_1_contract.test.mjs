import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const sql = fs.readFileSync(new URL("../../database/migrations/0003_sprint2_1_security.sql", import.meta.url), "utf8");

test("Sprint 2.1 migration includes DesignVersion and idempotency", () => {
  assert.match(sql,/CREATE TABLE design_versions/i);
  assert.match(sql,/CREATE TABLE idempotency_keys/i);
  assert.match(sql,/final_design_version_id/i);
});

test("Sprint 2.1 migration records user approval provenance", () => {
  assert.match(sql,/approved_by_user_id/i);
  assert.match(sql,/USER_APPROVED/i);
  assert.match(sql,/approved_at/i);
});
