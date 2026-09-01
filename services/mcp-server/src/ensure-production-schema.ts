import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const { Client } = pg;

const MIGRATIONS = [
  "0001_core.sql",
  "0002_sprint2_hardening.sql",
  "0003_sprint2_1_security.sql",
  "0004_sprint2_2_pg_mcp.sql",
  "0005_sprint2_3_core_certification.sql"
] as const;

const KNOWN_TABLES = [
  "users",
  "institutions",
  "identity_versions",
  "assets",
  "asset_versions",
  "projects",
  "approvals",
  "provenance_records",
  "audit_events",
  "analysis_versions",
  "structure_versions",
  "resource_versions",
  "art_direction_versions",
  "verification_versions",
  "design_versions",
  "idempotency_keys",
  "approval_grants"
] as const;

export interface ProductionSchemaOptions {
  migrationsDir?: string;
  searchPath?: string;
}

function assertSafeIdentifier(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error(`INVALID_SCHEMA_IDENTIFIER:${value}`);
  return value;
}

function stripMigrationTransaction(sql: string): string {
  return sql
    .replace(/^\s*BEGIN\s*;\s*/i, "")
    .replace(/\s*COMMIT\s*;\s*$/i, "")
    .trim();
}

async function currentKnownTables(client: InstanceType<typeof Client>): Promise<string[]> {
  const q = await client.query(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = ANY($1::text[])
      ORDER BY table_name`,
    [KNOWN_TABLES]
  );
  return q.rows.map((row: { table_name: string }) => row.table_name);
}

async function ledgerExists(client: InstanceType<typeof Client>): Promise<boolean> {
  const q = await client.query(
    `SELECT EXISTS(
       SELECT 1 FROM information_schema.tables
        WHERE table_schema=current_schema() AND table_name='visual4d_schema_migrations'
     ) AS present`
  );
  return q.rows[0]?.present === true;
}

async function createLedger(client: InstanceType<typeof Client>): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS visual4d_schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

export async function ensureProductionSchema(
  connectionString: string,
  options: ProductionSchemaOptions = {}
): Promise<{ applied: string[]; schema: string }> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    if (options.searchPath) {
      const schema = assertSafeIdentifier(options.searchPath);
      await client.query(`SET search_path TO ${schema}`);
    }

    const schemaResult = await client.query("SELECT current_schema() AS schema");
    const schema = String(schemaResult.rows[0]?.schema ?? "public");
    const hadLedger = await ledgerExists(client);
    const existingTables = await currentKnownTables(client);

    if (!hadLedger && existingTables.length > 0) {
      throw new Error(`SCHEMA_PARTIAL_BASELINE_UNSAFE:${existingTables.join(",")}`);
    }

    await createLedger(client);
    const appliedRows = await client.query("SELECT version FROM visual4d_schema_migrations ORDER BY version");
    const alreadyApplied = new Set(appliedRows.rows.map((row: { version: string }) => row.version));
    const migrationsDir = options.migrationsDir ?? path.join(process.cwd(), "database", "migrations");
    const newlyApplied: string[] = [];

    for (const migration of MIGRATIONS) {
      if (alreadyApplied.has(migration)) continue;
      const migrationPath = path.join(migrationsDir, migration);
      const rawSql = await fs.readFile(migrationPath, "utf8");
      const sql = stripMigrationTransaction(rawSql);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO visual4d_schema_migrations(version) VALUES($1)",
          [migration]
        );
        await client.query("COMMIT");
        newlyApplied.push(migration);
        console.error(`[schema-bootstrap] applied=${migration}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    const finalRows = await client.query("SELECT version FROM visual4d_schema_migrations ORDER BY version");
    const finalVersions = finalRows.rows.map((row: { version: string }) => row.version);
    const missing = MIGRATIONS.filter(migration => !finalVersions.includes(migration));
    if (missing.length > 0) throw new Error(`SCHEMA_MIGRATIONS_INCOMPLETE:${missing.join(",")}`);

    const finalTables = new Set(await currentKnownTables(client));
    const requiredForCreate = ["users", "institutions", "identity_versions", "projects", "audit_events", "idempotency_keys"];
    const missingCreateTables = requiredForCreate.filter(table => !finalTables.has(table));
    if (missingCreateTables.length > 0) {
      throw new Error(`SCHEMA_PROJECT_CREATE_INCOMPLETE:${missingCreateTables.join(",")}`);
    }

    console.error(`[schema-bootstrap] status=ready schema=${schema} migrations=${finalVersions.length}`);
    return { applied: newlyApplied, schema };
  } finally {
    await client.end();
  }
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  await ensureProductionSchema(connectionString);
}
