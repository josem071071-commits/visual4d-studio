import pg from "pg";

const { Client } = pg;

export async function ensureProductionSchema(connectionString: string): Promise<void> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS idempotency_keys (
        actor_user_id TEXT NOT NULL REFERENCES users(id),
        operation TEXT NOT NULL,
        request_id TEXT NOT NULL,
        result_json JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        status TEXT NOT NULL DEFAULT 'COMPLETED',
        error_code TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY(actor_user_id, operation, request_id)
      )
    `);
    await client.query("ALTER TABLE idempotency_keys ALTER COLUMN result_json DROP NOT NULL");
    await client.query("ALTER TABLE idempotency_keys ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'COMPLETED'");
    await client.query("ALTER TABLE idempotency_keys ADD COLUMN IF NOT EXISTS error_code TEXT");
    await client.query("ALTER TABLE idempotency_keys ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()");
    await client.query("CREATE INDEX IF NOT EXISTS idempotency_keys_created_at_idx ON idempotency_keys(created_at)");
    await client.query("COMMIT");
    console.error("[schema-repair] idempotency_keys ready");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  await ensureProductionSchema(connectionString);
}
