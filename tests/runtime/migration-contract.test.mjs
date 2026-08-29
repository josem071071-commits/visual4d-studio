import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const up = fs.readFileSync(path.join(root, "database/migrations/0001_core.sql"), "utf8");
const down = fs.readFileSync(path.join(root, "database/migrations/0001_core.down.sql"), "utf8");

const requiredTables = [
  "users",
  "institutions",
  "identity_versions",
  "assets",
  "asset_versions",
  "projects",
  "approvals",
  "provenance_records",
  "audit_events"
];

test("up migration creates all Sprint 1.1 core tables and down migration removes them", () => {
  for (const table of requiredTables) {
    assert.match(up, new RegExp(`CREATE TABLE ${table}\\b`, "i"));
    assert.match(down, new RegExp(`DROP TABLE IF EXISTS ${table}\\b`, "i"));
  }
});

test("migration encodes multi-institution and same-parent integrity constraints", () => {
  assert.match(up, /FOREIGN KEY \(owner_user_id, institution_id\)\s+REFERENCES institutions\(owner_user_id, id\)/i);
  assert.match(up, /FOREIGN KEY \(institution_id, identity_version_id\)\s+REFERENCES identity_versions\(institution_id, id\)/i);
  assert.match(up, /FOREIGN KEY \(id, current_version_id\)\s+REFERENCES asset_versions\(asset_id, id\)/i);
  assert.match(up, /FOREIGN KEY \(id, active_identity_version_id\)\s+REFERENCES identity_versions\(institution_id, id\)/i);
});

test("migration constrains project types, stages and asset types", () => {
  assert.match(up, /project_type TEXT NOT NULL CHECK \(project_type IN/i);
  assert.match(up, /current_stage TEXT NOT NULL CHECK \(current_stage IN/i);
  assert.match(up, /type TEXT NOT NULL CHECK \(type IN/i);
});

test("migration stores exact approval version IDs and provenance", () => {
  assert.match(up, /artifact_version_id TEXT NOT NULL/i);
  assert.match(up, /CREATE TABLE provenance_records/i);
  assert.match(up, /CHECK \(NOT \(generated_by_ai AND documentary\)\)/i);
});

test("Sprint 2 migration enforces one active identity and provenance consistency", () => {
  const sql = fs.readFileSync(new URL("../../database/migrations/0002_sprint2_hardening.sql", import.meta.url), "utf8");
  assert.match(sql, /identity_versions_one_active_per_institution/);
  assert.match(sql, /provenance_approved_at_consistency_chk/);
  assert.match(sql, /provenance_source_id_required_chk/);
  assert.match(sql, /projects_stage_status_consistency_chk/);
});

test("Sprint 2 down migration reverses all added tables and constraints", () => {
  const sql = fs.readFileSync(new URL("../../database/migrations/0002_sprint2_hardening.down.sql", import.meta.url), "utf8");
  assert.match(sql, /DROP TABLE IF EXISTS verification_versions/);
  assert.match(sql, /DROP INDEX IF EXISTS identity_versions_one_active_per_institution/);
  assert.match(sql, /DROP CONSTRAINT IF EXISTS projects_stage_status_consistency_chk/);
});
