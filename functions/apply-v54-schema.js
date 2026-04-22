/**
 * Apply V5.4 HITL schema — Direct connection (no db.js dependency).
 * Uses ssl: false since Cloud SQL Auth Proxy handles encryption.
 */

const postgres = require('postgres');

const sql = postgres('postgresql://sentinel:53ntin3l3ng1n3v5.2@127.0.0.1:5432/sentinel_reservoir', {
  ssl: false,
  connect_timeout: 10,
});

const STATEMENTS = [
  // Table: standing_authority_matrix
  `CREATE TABLE IF NOT EXISTS standing_authority_matrix (
    authority_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('SOC_TIER_1', 'SOC_TIER_2', 'CHIEF_ENGINEER', 'CISO')),
    blast_radius TEXT NOT NULL CHECK (blast_radius IN ('LOCAL', 'REGIONAL', 'GLOBAL')),
    escalation_tier INTEGER NOT NULL CHECK (escalation_tier BETWEEN 1 AND 4),
    contact_channel TEXT,
    webhook_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    tenant_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Table: evidence_locker
  `CREATE TABLE IF NOT EXISTS evidence_locker (
    locker_id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN (
      'PROSECUTOR_REJECTION', 'ESCALATION_CREATED', 'HUMAN_OVERRIDE',
      'HUMAN_CONFIRM_REJECTION', 'COACHING_ANNOTATION',
      'ROLLBACK_TRIGGERED', 'PRISTINE_CHECKPOINT', 'AUTHORITY_MODIFIED'
    )),
    responsible_authority_id TEXT REFERENCES standing_authority_matrix(authority_id),
    payload JSONB NOT NULL,
    signature TEXT NOT NULL,
    previous_signature TEXT,
    tenant_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Table: escalation_requests
  `CREATE TABLE IF NOT EXISTS escalation_requests (
    escalation_id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    authority_id TEXT REFERENCES standing_authority_matrix(authority_id),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN (
      'PENDING', 'OVERRIDE_RELEASED', 'CONFIRMED_BLOCKED', 'TTL_EXPIRED'
    )),
    impact_level TEXT NOT NULL DEFAULT 'HIGH_IMPACT' CHECK (impact_level IN (
      'HIGH_IMPACT', 'STANDARD', 'LOW'
    )),
    blast_radius TEXT NOT NULL DEFAULT 'LOCAL',
    evidence_fragment JSONB NOT NULL,
    resolution_payload JSONB,
    coaching_annotation TEXT,
    ttl_expires_at TIMESTAMPTZ NOT NULL,
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT,
    webauthn_assertion_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Table: webauthn_credentials
  `CREATE TABLE IF NOT EXISTS webauthn_credentials (
    credential_id TEXT PRIMARY KEY,
    authority_id TEXT NOT NULL REFERENCES standing_authority_matrix(authority_id),
    public_key BYTEA NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    transports TEXT[],
    aaguid TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // ALTER: verification_results
  `ALTER TABLE verification_results ADD COLUMN IF NOT EXISTS escalation_id TEXT`,

  // Indexes
  `CREATE INDEX IF NOT EXISTS idx_evidence_request ON evidence_locker(request_id)`,
  `CREATE INDEX IF NOT EXISTS idx_evidence_tenant ON evidence_locker(tenant_id)`,
  `CREATE INDEX IF NOT EXISTS idx_evidence_type ON evidence_locker(event_type)`,
  `CREATE INDEX IF NOT EXISTS idx_evidence_created ON evidence_locker(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_escalation_status ON escalation_requests(status)`,
  `CREATE INDEX IF NOT EXISTS idx_escalation_tenant ON escalation_requests(tenant_id)`,
  `CREATE INDEX IF NOT EXISTS idx_escalation_ttl ON escalation_requests(ttl_expires_at) WHERE status = 'PENDING'`,
  `CREATE INDEX IF NOT EXISTS idx_authority_active ON standing_authority_matrix(is_active) WHERE is_active = TRUE`,
  `CREATE INDEX IF NOT EXISTS idx_authority_blast ON standing_authority_matrix(blast_radius, escalation_tier)`,
  `CREATE INDEX IF NOT EXISTS idx_webauthn_authority ON webauthn_credentials(authority_id)`,
];

async function main() {
  console.log('[SCHEMA] Applying V5.4 HITL schema (direct connection, ssl=false)...\n');

  let applied = 0;
  let errors = 0;

  for (const stmt of STATEMENTS) {
    try {
      await sql.unsafe(stmt);
      applied++;
      const match = stmt.match(/(?:TABLE|INDEX|ALTER TABLE)\s+(?:IF\s+NOT\s+EXISTS\s+)?(\S+)/i);
      const name = match ? match[1] : 'statement';
      console.log(`  ✅ ${name}`);
    } catch (err) {
      errors++;
      console.error(`  ❌ ${err.message.substring(0, 100)}`);
    }
  }

  console.log(`\n[SCHEMA] Complete: ${applied} applied, ${errors} errors`);
  await sql.end();
  process.exit(errors > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('[SCHEMA] Fatal:', err.message);
  process.exit(1);
});
