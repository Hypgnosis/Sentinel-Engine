/**
 * PROJECT SUB-ZERO LATENCY — Reservoir Transfer (Node.js)
 * ═══════════════════════════════════════════════════════════
 * Migrates the Pristine Reservoir from Supabase to GCP Cloud SQL.
 * 
 * This Node.js version replaces migrate-reservoir.sh for Windows
 * environments that lack psql / pg_dump.
 *
 * PREREQUISITES:
 *   1. Cloud SQL instance provisioned via Terraform
 *   2. Cloud SQL Auth Proxy running on port 5433:
 *      cloud-sql-proxy.exe ha-sentinel-core-v21:us-central1:sentinel-reservoir --port 5433
 *
 * USAGE:
 *   node infra/migrate-reservoir.js
 *
 * ENVIRONMENT (set before running):
 *   SUPABASE_HOST       - e.g. db.pgajtcnpnuutlqstpmdr.supabase.co
 *   SUPABASE_PASSWORD    - Supabase DB password
 *   CLOUDSQL_PASSWORD    - Cloud SQL password (set during terraform apply)
 */

const postgres = require('postgres');

// ─── Configuration ─────────────────────────────────────
const SUPABASE_HOST     = process.env.SUPABASE_HOST     || die('SUPABASE_HOST');
const SUPABASE_PORT     = parseInt(process.env.SUPABASE_PORT || '6543');
const SUPABASE_USER     = process.env.SUPABASE_USER     || 'postgres';
const SUPABASE_PASSWORD = process.env.SUPABASE_PASSWORD || die('SUPABASE_PASSWORD');
const SUPABASE_DB       = process.env.SUPABASE_DB       || 'postgres';

const CLOUDSQL_HOST     = process.env.CLOUDSQL_HOST     || '127.0.0.1';
const CLOUDSQL_PORT     = parseInt(process.env.CLOUDSQL_PORT || '5433');
const CLOUDSQL_USER     = process.env.CLOUDSQL_USER     || 'sentinel';
const CLOUDSQL_PASSWORD = process.env.CLOUDSQL_PASSWORD || die('CLOUDSQL_PASSWORD');
const CLOUDSQL_DB       = process.env.CLOUDSQL_DB       || 'sentinel_reservoir';

function die(varName) {
  console.error(`[FATAL] ${varName} is required but not set.`);
  process.exit(1);
}

// ─── Tables to migrate ────────────────────────────────
const TABLES = [
  'freight_indices',
  'port_congestion',
  'maritime_chokepoints',
  'risk_matrix',
  'subject_revocation_list',
];

// ─── Connect ──────────────────────────────────────────
function connectCloudSQL() {
  return postgres({
    host: CLOUDSQL_HOST,
    port: CLOUDSQL_PORT,
    username: CLOUDSQL_USER,
    password: CLOUDSQL_PASSWORD,
    database: CLOUDSQL_DB,
    ssl: false, // Auth Proxy handles encryption
    max: 5,
    connect_timeout: 30,
  });
}

// ─── Step 0: Create schema on Cloud SQL ───────────────
async function createSchema(target) {
  console.log('\n[STEP 0] Enabling pgvector and creating schema on Cloud SQL...');

  await target.unsafe('CREATE EXTENSION IF NOT EXISTS vector');
  console.log('  ✓ pgvector extension enabled');

  await target.unsafe(`
    CREATE TABLE IF NOT EXISTS freight_indices (
      id SERIAL PRIMARY KEY,
      entity_hash TEXT UNIQUE NOT NULL,
      tenant_id TEXT NOT NULL,
      source TEXT NOT NULL,
      route_origin TEXT,
      route_destination TEXT,
      rate_usd NUMERIC,
      week_over_week_change NUMERIC,
      trend TEXT,
      narrative_context TEXT NOT NULL,
      embedding vector(768),
      ingested_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await target.unsafe(`
    CREATE TABLE IF NOT EXISTS port_congestion (
      id SERIAL PRIMARY KEY,
      entity_hash TEXT UNIQUE NOT NULL,
      tenant_id TEXT NOT NULL,
      source TEXT NOT NULL,
      port_name TEXT NOT NULL,
      vessels_at_anchor INTEGER,
      avg_wait_days NUMERIC,
      severity_level TEXT,
      narrative_context TEXT NOT NULL,
      embedding vector(768),
      ingested_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await target.unsafe(`
    CREATE TABLE IF NOT EXISTS maritime_chokepoints (
      id SERIAL PRIMARY KEY,
      entity_hash TEXT UNIQUE NOT NULL,
      tenant_id TEXT NOT NULL,
      source TEXT NOT NULL,
      chokepoint_name TEXT NOT NULL,
      status TEXT,
      vessel_queue INTEGER,
      transit_delay_hours NUMERIC,
      narrative_context TEXT NOT NULL,
      embedding vector(768),
      ingested_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await target.unsafe(`
    CREATE TABLE IF NOT EXISTS risk_matrix (
      id SERIAL PRIMARY KEY,
      entity_hash TEXT UNIQUE NOT NULL,
      tenant_id TEXT NOT NULL,
      source TEXT NOT NULL,
      risk_factor TEXT NOT NULL,
      severity TEXT,
      probability TEXT,
      impact_window TEXT,
      narrative_context TEXT NOT NULL,
      embedding vector(768),
      ingested_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await target.unsafe(`
    CREATE TABLE IF NOT EXISTS subject_revocation_list (
      subject_id TEXT PRIMARY KEY,
      revocation_reason TEXT,
      revoked_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      revoked_by TEXT
    )
  `);

  console.log('  ✓ All 5 tables created');
}

// ─── Step 1: Migrate data table by table ─────────────
async function migrateTable(source, target, tableName) {
  process.stdout.write(`  ${tableName}: reading from Supabase... `);

  let rows;
  try {
    rows = await source.unsafe(`SELECT * FROM ${tableName}`);
  } catch (err) {
    // Table might not exist in source
    console.log(`SKIPPED (${err.message.substring(0, 60)})`);
    return 0;
  }

  if (!rows || rows.length === 0) {
    console.log('0 rows (empty)');
    return 0;
  }

  process.stdout.write(`${rows.length} rows found. Writing to Cloud SQL... `);

  let inserted = 0;
  for (const row of rows) {
    try {
      // Get column names from the row object
      const columns = Object.keys(row);
      const valuePlaceholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const values = columns.map(col => {
        const val = row[col];
        // Handle vector/array types — convert to string representation
        if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
          return JSON.stringify(val);
        }
        if (Array.isArray(val)) {
          return `[${val.join(',')}]`;
        }
        return val;
      });

      // Use ON CONFLICT to make this idempotent
      const conflictCol = tableName === 'subject_revocation_list' ? 'subject_id' : 'entity_hash';
      
      await target.unsafe(
        `INSERT INTO ${tableName} (${columns.join(', ')})
         VALUES (${valuePlaceholders})
         ON CONFLICT (${conflictCol}) DO NOTHING`,
        values
      );
      inserted++;
    } catch (err) {
      // Log but continue — don't let one bad row block the migration
      if (!err.message.includes('duplicate key')) {
        console.error(`\n    ⚠ Row error in ${tableName}: ${err.message.substring(0, 80)}`);
      }
    }
  }

  console.log(`${inserted} inserted ✓`);
  return inserted;
}

// ─── Step 2: Create indexes ──────────────────────────
async function createIndexes(target) {
  console.log('\n[STEP 2] Creating vector + tenant indexes...');

  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_freight_vector ON freight_indices USING hnsw (embedding vector_cosine_ops)',
    'CREATE INDEX IF NOT EXISTS idx_port_vector ON port_congestion USING hnsw (embedding vector_cosine_ops)',
    'CREATE INDEX IF NOT EXISTS idx_choke_vector ON maritime_chokepoints USING hnsw (embedding vector_cosine_ops)',
    'CREATE INDEX IF NOT EXISTS idx_risk_vector ON risk_matrix USING hnsw (embedding vector_cosine_ops)',
    'CREATE INDEX IF NOT EXISTS idx_freight_tenant ON freight_indices(tenant_id)',
    'CREATE INDEX IF NOT EXISTS idx_port_tenant ON port_congestion(tenant_id)',
    'CREATE INDEX IF NOT EXISTS idx_choke_tenant ON maritime_chokepoints(tenant_id)',
    'CREATE INDEX IF NOT EXISTS idx_risk_tenant ON risk_matrix(tenant_id)',
  ];

  for (const ddl of indexes) {
    try {
      await target.unsafe(ddl);
      const name = ddl.match(/idx_\w+/)?.[0] || 'index';
      console.log(`  ✓ ${name}`);
    } catch (err) {
      console.warn(`  ⚠ Index warning: ${err.message.substring(0, 60)}`);
    }
  }
}

// ─── Step 3: Verify ──────────────────────────────────
async function verify(source, target) {
  console.log('\n[STEP 3] Verifying row counts (Source → Target):');
  const dataTables = TABLES.filter(t => t !== 'subject_revocation_list');

  for (const table of dataTables) {
    let srcCount = 0, tgtCount = 0;
    try {
      const [src] = await source.unsafe(`SELECT COUNT(*)::int as count FROM ${table}`);
      srcCount = src.count;
    } catch { srcCount = 'N/A'; }

    try {
      const [tgt] = await target.unsafe(`SELECT COUNT(*)::int as count FROM ${table}`);
      tgtCount = tgt.count;
    } catch { tgtCount = 'N/A'; }

    const match = srcCount === tgtCount ? '✓' : '⚠ MISMATCH';
    console.log(`  ${table}: ${srcCount} → ${tgtCount} ${match}`);
  }
}

// ─── Main ────────────────────────────────────────────
async function main() {
  const t0 = Date.now();

  console.log('═══════════════════════════════════════════════════════');
  console.log('  PROJECT SUB-ZERO: Reservoir Transfer (Node.js)');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Source: Supabase (${SUPABASE_HOST})`);
  console.log(`  Target: Cloud SQL (${CLOUDSQL_HOST}:${CLOUDSQL_PORT})`);
  console.log('═══════════════════════════════════════════════════════\n');

  const source = connectSupabase();
  const target = connectCloudSQL();

  try {
    // Test connections
    console.log('[CONNECT] Testing Supabase connection...');
    await source.unsafe('SELECT 1');
    console.log('  ✓ Supabase connected');

    console.log('[CONNECT] Testing Cloud SQL connection...');
    await target.unsafe('SELECT 1');
    console.log('  ✓ Cloud SQL connected');

    // Step 0: Schema
    await createSchema(target);

    // Step 1: Migrate data
    console.log('\n[STEP 1] Migrating data...');
    let totalRows = 0;
    for (const table of TABLES) {
      totalRows += await migrateTable(source, target, table);
    }
    console.log(`\n  Total rows transferred: ${totalRows}`);

    // Step 2: Indexes
    await createIndexes(target);

    // Step 3: Verify
    await verify(source, target);

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  ✅ RESERVOIR TRANSFER COMPLETE');
    console.log(`  Duration: ${elapsed}s`);
    console.log('');
    console.log('  Next steps:');
    console.log('    1. Update DATABASE_URL in Secret Manager:');
    console.log('       postgresql://sentinel:PW@/sentinel_reservoir?host=/cloudsql/ha-sentinel-core-v21:us-central1:sentinel-reservoir');
    console.log('    2. Set INSTANCE_CONNECTION_NAME:');
    console.log('       ha-sentinel-core-v21:us-central1:sentinel-reservoir');
    console.log('    3. Deploy: gcloud functions deploy handleSentinelInference');
    console.log('    4. Verify latency via /inference endpoint logs');
    console.log('═══════════════════════════════════════════════════════');

  } catch (err) {
    console.error('\n[FATAL] Migration failed:', err);
    process.exit(1);
  } finally {
    await source.end();
    await target.end();
  }
}

main();
