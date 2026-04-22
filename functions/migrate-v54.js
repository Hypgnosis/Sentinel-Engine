/**
 * One-shot schema migration Cloud Function.
 * Applies V5.4 HITL tables via the Cloud SQL Unix socket.
 * Deploy, invoke once, then delete.
 */
const functions = require('@google-cloud/functions-framework');
const postgres = require('postgres');

const STATEMENTS = [
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
  `CREATE TABLE IF NOT EXISTS webauthn_credentials (
    credential_id TEXT PRIMARY KEY,
    authority_id TEXT NOT NULL REFERENCES standing_authority_matrix(authority_id),
    public_key BYTEA NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    transports TEXT[],
    aaguid TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `ALTER TABLE verification_results ADD COLUMN IF NOT EXISTS escalation_id TEXT`,
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

functions.http('migrateV54', async (req, res) => {
  const url = process.env.DATABASE_URL;
  if (!url) return res.status(500).json({ error: 'DATABASE_URL not set' });

  const isUnixSocket = url.includes('/cloudsql/');
  const sql = postgres(url, { ssl: isUnixSocket ? false : 'require', max: 5, connect_timeout: 10 });

  let applied = 0, errors = 0;
  const results = [];

  for (const stmt of STATEMENTS) {
    try {
      await sql.unsafe(stmt);
      applied++;
      const match = stmt.match(/(?:TABLE|INDEX|ALTER TABLE)\s+(?:IF\s+NOT\s+EXISTS\s+)?(\S+)/i);
      results.push({ status: 'ok', name: match ? match[1] : 'unknown' });
    } catch (err) {
      errors++;
      results.push({ status: 'error', message: err.message.substring(0, 200) });
    }
  }

  await sql.end();
  res.json({ applied, errors, results, version: '5.4.0-hitl' });
});
