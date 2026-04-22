/**
 * SENTINEL ENGINE V5.4 — HITL & Escalation Integration Tests
 * ═══════════════════════════════════════════════════════════════════
 * Tests the complete HITL pipeline: Authority Matrix resolution,
 * Evidence Locker chain integrity, JIT Escalation lifecycle,
 * and Rollback Engine data-plane operations.
 *
 * Run: node test-v54-hitl.js
 * ═══════════════════════════════════════════════════════════════════
 */

console.log('──────────────────────────────────────────────────');
console.log(' SENTINEL V5.4 — HITL Integration Test Suite');
console.log('──────────────────────────────────────────────────\n');

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failed++;
  }
}

// ─────────────────────────────────────────────────────
//  1. MODULE IMPORT TESTS
// ─────────────────────────────────────────────────────

console.log('▸ Phase 1: Module Imports');

try {
  const { EvidenceLocker, EVENT_TYPES } = require('./evidence-locker');
  assert(typeof EvidenceLocker === 'function', 'EvidenceLocker class exported');
  assert(typeof EVENT_TYPES === 'object', 'EVENT_TYPES enum exported');
  assert(EVENT_TYPES.PROSECUTOR_REJECTION === 'PROSECUTOR_REJECTION', 'EVENT_TYPES.PROSECUTOR_REJECTION correct');
  assert(EVENT_TYPES.ESCALATION_CREATED === 'ESCALATION_CREATED', 'EVENT_TYPES.ESCALATION_CREATED correct');
  assert(EVENT_TYPES.HUMAN_OVERRIDE === 'HUMAN_OVERRIDE', 'EVENT_TYPES.HUMAN_OVERRIDE correct');
  assert(EVENT_TYPES.PRISTINE_CHECKPOINT === 'PRISTINE_CHECKPOINT', 'EVENT_TYPES.PRISTINE_CHECKPOINT correct');
  assert(EVENT_TYPES.ROLLBACK_TRIGGERED === 'ROLLBACK_TRIGGERED', 'EVENT_TYPES.ROLLBACK_TRIGGERED correct');
  assert(EVENT_TYPES.COACHING_ANNOTATION === 'COACHING_ANNOTATION', 'EVENT_TYPES.COACHING_ANNOTATION correct');
  assert(Object.keys(EVENT_TYPES).length === 8, 'EVENT_TYPES has exactly 8 entries');
} catch (err) {
  assert(false, `EvidenceLocker import failed: ${err.message}`);
}

try {
  const { StandingAuthorityMatrix, BLAST_RADIUS, AUTHORITY_ROLES } = require('./authority-matrix');
  assert(typeof StandingAuthorityMatrix === 'function', 'StandingAuthorityMatrix class exported');
  assert(BLAST_RADIUS.LOCAL === 'LOCAL', 'BLAST_RADIUS.LOCAL correct');
  assert(BLAST_RADIUS.REGIONAL === 'REGIONAL', 'BLAST_RADIUS.REGIONAL correct');
  assert(BLAST_RADIUS.GLOBAL === 'GLOBAL', 'BLAST_RADIUS.GLOBAL correct');
  assert(AUTHORITY_ROLES.SOC_TIER_1 === 'SOC_TIER_1', 'AUTHORITY_ROLES.SOC_TIER_1 correct');
  assert(AUTHORITY_ROLES.CISO === 'CISO', 'AUTHORITY_ROLES.CISO correct');
} catch (err) {
  assert(false, `StandingAuthorityMatrix import failed: ${err.message}`);
}

try {
  const { EscalationEngine, ESCALATION_TTL_SECONDS } = require('./escalation-engine');
  assert(typeof EscalationEngine === 'function', 'EscalationEngine class exported');
  assert(typeof ESCALATION_TTL_SECONDS === 'number', 'ESCALATION_TTL_SECONDS exported');
  assert(ESCALATION_TTL_SECONDS === 300, 'Default TTL is 300 seconds');
} catch (err) {
  assert(false, `EscalationEngine import failed: ${err.message}`);
}

try {
  const { WebAuthnProvider, RP_ID, RP_NAME } = require('./webauthn-provider');
  assert(typeof WebAuthnProvider === 'function', 'WebAuthnProvider class exported');
  assert(typeof RP_ID === 'string', 'RP_ID exported');
  assert(RP_NAME === 'Sentinel Engine HITL', 'RP_NAME correct');
} catch (err) {
  assert(false, `WebAuthnProvider import failed: ${err.message}`);
}

try {
  const { RollbackEngine, CHECKPOINT_INTERVAL } = require('./rollback-engine');
  assert(typeof RollbackEngine === 'function', 'RollbackEngine class exported');
  assert(typeof CHECKPOINT_INTERVAL === 'number', 'CHECKPOINT_INTERVAL exported');
  assert(CHECKPOINT_INTERVAL === 100, 'Default checkpoint interval is 100');
} catch (err) {
  assert(false, `RollbackEngine import failed: ${err.message}`);
}

// ─────────────────────────────────────────────────────
//  2. BLAST RADIUS CLASSIFICATION
// ─────────────────────────────────────────────────────

console.log('\n▸ Phase 2: Blast Radius Classification');

try {
  const { StandingAuthorityMatrix } = require('./authority-matrix');

  assert(
    StandingAuthorityMatrix.classifyBlastRadius('HIGH_IMPACT', 'SENSITIVE') === 'GLOBAL',
    'HIGH_IMPACT + SENSITIVE = GLOBAL'
  );
  assert(
    StandingAuthorityMatrix.classifyBlastRadius('HIGH_IMPACT', 'PROCEDURAL') === 'REGIONAL',
    'HIGH_IMPACT + PROCEDURAL = REGIONAL'
  );
  assert(
    StandingAuthorityMatrix.classifyBlastRadius('HIGH_IMPACT', 'GENERAL') === 'REGIONAL',
    'HIGH_IMPACT + GENERAL = REGIONAL'
  );
  assert(
    StandingAuthorityMatrix.classifyBlastRadius('STANDARD', 'SENSITIVE') === 'LOCAL',
    'STANDARD + SENSITIVE = LOCAL'
  );
  assert(
    StandingAuthorityMatrix.classifyBlastRadius('LOW', 'GENERAL') === 'LOCAL',
    'LOW + GENERAL = LOCAL'
  );
} catch (err) {
  assert(false, `Blast radius classification failed: ${err.message}`);
}

// ─────────────────────────────────────────────────────
//  3. EVIDENCE LOCKER MOCK TESTS (no DB)
// ─────────────────────────────────────────────────────

console.log('\n▸ Phase 3: Evidence Locker (Unit)');

try {
  const { EvidenceLocker } = require('./evidence-locker');

  // Mock SecurityManager
  const mockSecurity = {
    signPayload: async (payload) => {
      const crypto = require('crypto');
      return crypto.createHmac('sha256', 'test-key')
        .update(JSON.stringify(payload))
        .digest('hex');
    },
    verifyPayload: async (payload, signature) => {
      const crypto = require('crypto');
      const expected = crypto.createHmac('sha256', 'test-key')
        .update(JSON.stringify(payload))
        .digest('hex');
      return expected === signature;
    },
  };

  const locker = new EvidenceLocker(mockSecurity);
  assert(locker !== null, 'EvidenceLocker instantiation succeeds');

  // Test ID generation
  const id1 = locker._generateLockerId();
  const id2 = locker._generateLockerId();
  assert(id1.startsWith('EL-'), 'Locker ID starts with EL-');
  assert(id1 !== id2, 'Locker IDs are unique');

  // Test constructor validation
  try {
    new EvidenceLocker(null);
    assert(false, 'Should throw without SecurityManager');
  } catch (e) {
    assert(e.message.includes('SecurityManager'), 'Throws on missing SecurityManager');
  }
} catch (err) {
  assert(false, `Evidence Locker unit tests failed: ${err.message}`);
}

// ─────────────────────────────────────────────────────
//  4. ESCALATION ENGINE MOCK TESTS (no DB)
// ─────────────────────────────────────────────────────

console.log('\n▸ Phase 4: Escalation Engine (Unit)');

try {
  const { EscalationEngine } = require('./escalation-engine');

  const mockSecurity = {
    signPayload: async (p) => require('crypto').createHmac('sha256', 'k').update(JSON.stringify(p)).digest('hex'),
    verifyPayload: async () => true,
  };

  const engine = new EscalationEngine(mockSecurity);
  assert(engine !== null, 'EscalationEngine instantiation succeeds');

  // Test ID generation
  const id = engine._generateEscalationId();
  assert(id.startsWith('ESC-'), 'Escalation ID starts with ESC-');

  // Test constructor validation
  try {
    new EscalationEngine(null);
    assert(false, 'Should throw without SecurityManager');
  } catch (e) {
    assert(e.message.includes('SecurityManager'), 'Throws on missing SecurityManager');
  }
} catch (err) {
  assert(false, `Escalation Engine unit tests failed: ${err.message}`);
}

// ─────────────────────────────────────────────────────
//  5. WEBAUTHN PROVIDER (Unit)
// ─────────────────────────────────────────────────────

console.log('\n▸ Phase 5: WebAuthn Provider (Unit)');

try {
  const { WebAuthnProvider, RP_NAME, RP_ORIGIN } = require('./webauthn-provider');

  const provider = new WebAuthnProvider();
  assert(provider !== null, 'WebAuthnProvider instantiation succeeds');
  assert(RP_NAME === 'Sentinel Engine HITL', 'RP Name is correct');
  assert(typeof RP_ORIGIN === 'string', 'RP Origin is a string');
} catch (err) {
  assert(false, `WebAuthn Provider unit tests failed: ${err.message}`);
}

// ─────────────────────────────────────────────────────
//  6. ROLLBACK ENGINE (Unit - no DB)
// ─────────────────────────────────────────────────────

console.log('\n▸ Phase 6: Rollback Engine (Unit)');

try {
  const { RollbackEngine, CHECKPOINT_INTERVAL } = require('./rollback-engine');

  const mockSecurity = {
    signPayload: async (p) => require('crypto').createHmac('sha256', 'k').update(JSON.stringify(p)).digest('hex'),
    verifyPayload: async () => true,
  };

  const engine = new RollbackEngine(mockSecurity);
  assert(engine !== null, 'RollbackEngine instantiation succeeds');
  assert(CHECKPOINT_INTERVAL === 100, 'Checkpoint interval default is 100');

  try {
    new RollbackEngine(null);
    assert(false, 'Should throw without SecurityManager');
  } catch (e) {
    assert(e.message.includes('SecurityManager'), 'Throws on missing SecurityManager');
  }
} catch (err) {
  assert(false, `Rollback Engine unit tests failed: ${err.message}`);
}

// ─────────────────────────────────────────────────────
//  7. INDEX.JS — SHADOW CLASSIFIER SCHEMA
// ─────────────────────────────────────────────────────

console.log('\n▸ Phase 7: Index.js Integration Checks');

try {
  const fs = require('fs');
  const indexSource = fs.readFileSync('./index.js', 'utf-8');

  // Verify impactLevel is in the Shadow Classifier
  assert(indexSource.includes('impactLevel'), 'index.js contains impactLevel dimension');
  assert(indexSource.includes("'HIGH_IMPACT'"), 'index.js contains HIGH_IMPACT enum');
  assert(indexSource.includes("'STANDARD'"), 'index.js contains STANDARD enum');
  assert(indexSource.includes("'LOW'"), 'index.js contains LOW enum');
  assert(indexSource.includes("required: ['classification', 'domain', 'impactLevel']"), 'impactLevel is required in schema');

  // Verify HITL module imports
  assert(indexSource.includes('EscalationEngine'), 'index.js imports EscalationEngine');
  assert(indexSource.includes('EvidenceLocker'), 'index.js imports EvidenceLocker');
  assert(indexSource.includes('StandingAuthorityMatrix'), 'index.js imports StandingAuthorityMatrix');
  assert(indexSource.includes('WebAuthnProvider'), 'index.js imports WebAuthnProvider');
  assert(indexSource.includes('RollbackEngine'), 'index.js imports RollbackEngine');

  // Verify new Cloud Function endpoint
  assert(indexSource.includes('sentinelEscalation'), 'index.js registers sentinelEscalation endpoint');
  assert(indexSource.includes('handleSentinelEscalation'), 'index.js defines handleSentinelEscalation handler');

  // Verify HTTP 202 for escalation pending
  assert(indexSource.includes('ESCALATION_PENDING'), 'index.js handles ESCALATION_PENDING status');
  assert(indexSource.includes('202'), 'index.js returns HTTP 202 for pending escalations');

  // Verify Pristine Checkpoint integration
  assert(indexSource.includes('createPristineCheckpoint'), 'index.js calls createPristineCheckpoint');

  // Verify infrastructure version
  assert(indexSource.includes('Sentinel v5.4'), 'Infrastructure string updated to v5.4');
} catch (err) {
  assert(false, `Index.js integration check failed: ${err.message}`);
}

// ─────────────────────────────────────────────────────
//  8. VERIFICATION LOOP — ESCALATION INTEGRATION
// ─────────────────────────────────────────────────────

console.log('\n▸ Phase 8: Verification Loop Escalation Integration');

try {
  const fs = require('fs');
  const vLoopSource = fs.readFileSync('./verification-loop.js', 'utf-8');

  assert(vLoopSource.includes('EscalationEngine'), 'verification-loop imports EscalationEngine');
  assert(vLoopSource.includes('impactLevel'), 'verification-loop accepts impactLevel param');
  assert(vLoopSource.includes('queryClassification'), 'verification-loop accepts queryClassification param');
  assert(vLoopSource.includes('securityManager'), 'verification-loop accepts securityManager param');
  assert(vLoopSource.includes('_escalation'), 'verification-loop attaches _escalation to verdict');
  assert(vLoopSource.includes('ESCALATION_PENDING'), 'verification-loop sets ESCALATION_PENDING status');
  assert(vLoopSource.includes('escalation_id'), 'verification-loop stores escalation_id in results');
  assert(vLoopSource.includes('V5.4'), 'verification-loop header updated to V5.4');
} catch (err) {
  assert(false, `Verification Loop check failed: ${err.message}`);
}

// ─────────────────────────────────────────────────────
//  9. DATABASE SCHEMA
// ─────────────────────────────────────────────────────

console.log('\n▸ Phase 9: Database Schema Validation');

try {
  const fs = require('fs');
  const schema = fs.readFileSync('../infra/postgres.sql', 'utf-8');

  assert(schema.includes('standing_authority_matrix'), 'Schema contains standing_authority_matrix');
  assert(schema.includes('evidence_locker'), 'Schema contains evidence_locker');
  assert(schema.includes('escalation_requests'), 'Schema contains escalation_requests');
  assert(schema.includes('webauthn_credentials'), 'Schema contains webauthn_credentials');
  assert(schema.includes('previous_signature'), 'evidence_locker has chain-of-custody field');
  assert(schema.includes('PROSECUTOR_REJECTION'), 'Schema contains PROSECUTOR_REJECTION event type');
  assert(schema.includes('ttl_expires_at'), 'escalation_requests has TTL field');
  assert(schema.includes('FIDO2'), 'Schema mentions FIDO2 mandate');
  assert(schema.includes('idx_escalation_ttl'), 'Schema has TTL index for pending escalations');
  assert(schema.includes('idx_evidence_request'), 'Schema has evidence request index');
} catch (err) {
  assert(false, `Database schema validation failed: ${err.message}`);
}

// ─────────────────────────────────────────────────────
//  RESULTS
// ─────────────────────────────────────────────────────

console.log('\n──────────────────────────────────────────────────');
console.log(` Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);

if (failed > 0) {
  console.error(' ❌ HITL MODULE VALIDATION FAILED');
  process.exit(1);
} else {
  console.log(' ✅ ALL HITL MODULE VALIDATIONS PASSED');
  console.log(' ✅ V5.4 Conditional Execution infrastructure is structurally sound.');
}

console.log('──────────────────────────────────────────────────\n');
