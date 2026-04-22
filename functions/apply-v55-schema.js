/**
 * Apply V5.5 AGS schema — Direct connection (no db.js dependency).
 * Injects necessary constraints and JSONB indexes for Monotonic Reductions.
 */

const postgres = require('postgres');

const sql = postgres('postgresql://sentinel:53ntin3l3ng1n3v5.2@127.0.0.1:5432/sentinel_reservoir', {
  ssl: false,
  connect_timeout: 10,
});

const STATEMENTS = [
  // 1. Update constraints for Governance Findings and Legibility Records
  `ALTER TABLE evidence_locker DROP CONSTRAINT IF EXISTS evidence_locker_event_type_check`,
  `ALTER TABLE evidence_locker ADD CONSTRAINT evidence_locker_event_type_check CHECK (event_type IN (
      'PROSECUTOR_REJECTION', 'ESCALATION_CREATED', 'HUMAN_OVERRIDE',
      'HUMAN_CONFIRM_REJECTION', 'COACHING_ANNOTATION',
      'ROLLBACK_TRIGGERED', 'PRISTINE_CHECKPOINT', 'AUTHORITY_MODIFIED',
      'GOVERNANCE_FINDING', 'LEGIBILITY_RECORD'
  ))`,

  // 2. Update constraints for Impact Level constraints
  `ALTER TABLE escalation_requests DROP CONSTRAINT IF EXISTS escalation_requests_impact_level_check`,
  `ALTER TABLE escalation_requests ADD CONSTRAINT escalation_requests_impact_level_check CHECK (impact_level IN (
      'HIGH_IMPACT', 'STANDARD', 'LOW', 'UTILITY_CRITICAL'
  ))`,

  // 3. Update constraints for AGS Status fields
  `ALTER TABLE escalation_requests DROP CONSTRAINT IF EXISTS escalation_requests_status_check`,
  `ALTER TABLE escalation_requests ADD CONSTRAINT escalation_requests_status_check CHECK (status IN (
      'PENDING', 'OVERRIDE_RELEASED', 'CONFIRMED_BLOCKED', 'TTL_EXPIRED', 'MONOTONIC_REDUCTION_APPLIED'
  ))`,

  // 4. Attach JSONB Indexes for High-Capacity Querying
  `CREATE INDEX IF NOT EXISTS idx_evidence_finding_action ON evidence_locker USING GIN ((payload -> 'finding' -> 'action'))`,
  `CREATE INDEX IF NOT EXISTS idx_evidence_finding_trigger ON evidence_locker USING GIN ((payload -> 'finding' -> 'trigger'))`,

  // 5. Formal Arbitration Interface Tables
  `CREATE TABLE IF NOT EXISTS arbitration_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      requesting_agent TEXT NOT NULL,
      action TEXT NOT NULL,
      context JSONB NOT NULL,
      target_domain TEXT,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS arbitration_responses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id UUID NOT NULL REFERENCES arbitration_requests(id) ON DELETE CASCADE,
      authority_unit TEXT NOT NULL,
      decision TEXT NOT NULL CHECK (decision IN ('permit', 'escalate', 'deny', 'reduce')),
      reasoning TEXT,
      legibility_record JSONB NOT NULL,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS governance_findings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id UUID NOT NULL REFERENCES arbitration_requests(id) ON DELETE CASCADE,
      trigger TEXT NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('attenuate', 'suspend', 'revoke')),
      attenuated_scope JSONB,
      supervisor_timeout BOOLEAN DEFAULT FALSE,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_arb_requests_context ON arbitration_requests USING GIN (context)`,
  `CREATE INDEX IF NOT EXISTS idx_arb_responses_legibility ON arbitration_responses USING GIN (legibility_record)`,
  `CREATE INDEX IF NOT EXISTS idx_gov_findings_trigger ON governance_findings (trigger)`,
  `CREATE INDEX IF NOT EXISTS idx_gov_findings_action ON governance_findings (action)`
];

async function main() {
  console.log('[SCHEMA] Applying V5.5 AGS schema (direct connection, ssl=false)...\n');

  let applied = 0;
  let errors = 0;

  for (const stmt of STATEMENTS) {
    try {
      await sql.unsafe(stmt);
      applied++;
      const match = stmt.match(/(?:TABLE|INDEX|ALTER TABLE|CREATE INDEX)\s+(?:IF\s+NOT\s+EXISTS\s+)?(\S+)/i);
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
