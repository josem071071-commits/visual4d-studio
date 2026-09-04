import type { PgPool } from "../../../packages/postgres-repository/src/index.js";
import { PRODUCTION_SCHEMA_MIGRATIONS, PRODUCTION_SCHEMA_TABLES } from "./ensure-production-schema.js";

type Queryable = Pick<PgPool,"query">;

export type ProductionReadiness =
  | {ok:true;schema:string;migrations:number;tables:number;databaseFingerprint:string}
  | {ok:false;code:string;missingMigrations?:string[];missingTables?:string[]};

async function databaseFingerprint(db:Queryable):Promise<string>{
  const identity=await db.query(`SELECT substr(md5(concat_ws('|',
    COALESCE(inet_server_addr()::text,'local'),
    COALESCE(inet_server_port(),0)::text,
    current_database(),
    current_schema()
  )),1,16) AS fingerprint`);
  const fingerprint=identity.rows[0]?.fingerprint;
  if(typeof fingerprint!=="string"||!/^[a-f0-9]{16}$/.test(fingerprint))throw new Error("DATABASE_FINGERPRINT_UNAVAILABLE");
  return fingerprint;
}

export async function checkProductionReadiness(db:Queryable):Promise<ProductionReadiness>{
  try{
    const schemaResult=await db.query("SELECT current_schema() AS schema");
    const schema=String(schemaResult.rows[0]?.schema??"public");
    const ledger=await db.query(`SELECT EXISTS(
      SELECT 1 FROM information_schema.tables
       WHERE table_schema=current_schema() AND table_name='visual4d_schema_migrations'
    ) AS present`);
    if(ledger.rows[0]?.present!==true)return{ok:false,code:"SCHEMA_LEDGER_MISSING"};

    const versions=await db.query("SELECT version FROM visual4d_schema_migrations ORDER BY version");
    const applied=new Set(versions.rows.map((r:{version:string})=>r.version));
    const missingMigrations=PRODUCTION_SCHEMA_MIGRATIONS.filter(v=>!applied.has(v));

    const tables=await db.query(`SELECT table_name FROM information_schema.tables
      WHERE table_schema=current_schema() AND table_name=ANY($1::text[])`,[PRODUCTION_SCHEMA_TABLES]);
    const present=new Set(tables.rows.map((r:{table_name:string})=>r.table_name));
    const missingTables=PRODUCTION_SCHEMA_TABLES.filter(t=>!present.has(t));

    if(missingMigrations.length>0)return{ok:false,code:"SCHEMA_MIGRATIONS_INCOMPLETE",missingMigrations:[...missingMigrations]};
    if(missingTables.length>0)return{ok:false,code:"SCHEMA_TABLES_INCOMPLETE",missingTables:[...missingTables]};
    return{ok:true,schema,migrations:PRODUCTION_SCHEMA_MIGRATIONS.length,tables:PRODUCTION_SCHEMA_TABLES.length,databaseFingerprint:await databaseFingerprint(db)};
  }catch{
    return{ok:false,code:"DATABASE_UNAVAILABLE"};
  }
}
