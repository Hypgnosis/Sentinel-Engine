
const { IntegrityController, TruthAuditError } = require('./integrity-controller');
const { SecurityManager } = require('./security-manager');

// Mock SecurityManager to avoid loading real keys/HSM
class MockSecurityManager {
  async tokenizePII(text) { return text; }
}

async function runIntegrityTests() {
  console.log('--- STARTING V5.3 INTEGRITY HARDENING VERIFICATION ---');
  const controller = new IntegrityController(new MockSecurityManager());

  // TEST 1: Confidence Decay (0.95 -> 0.50)
  console.log('\n[TEST 1] Verifying Confidence Decay on Partial Data...');
  const partialDataObject = {
    confidence: 0.95, // High confidence but we have partial context
    sources: ['Xeneta (Stale)', 'BigQuery'],
    executiveAction: {
      narrative: 'This is a sufficiently long narrative to pass the substance gate and reach at least fifty characters in length.',
      recommendations: [],
      metrics: []
    }
  };
  
  const context = { contextPayload: '[WARNING: External Data Authority: Xeneta UNAVAILABLE]' };
  
  const result1 = await controller.finalTruthAudit(partialDataObject, 'tenant-123', context, new MockSecurityManager());
  
  console.log(`- Result Confidence: ${result1.confidence}`);
  if (result1.confidence === 0.50) {
    console.log('✓ PASS: Confidence decayed to cap.');
  } else {
    console.error('✗ FAIL: Confidence did not decay.');
  }

  // TEST 2: Narrative Substance Gate (Under 50 chars rejection)
  console.log('\n[TEST 2] Verifying Narrative Substance Gate Rejection...');
  const hollowResponse = {
    confidence: 0.80,
    sources: ['Cached Result'],
    executiveAction: {
      narrative: 'Too short.', // Should fail substance gate
      recommendations: [],
      metrics: []
    }
  };

  try {
    await controller.finalTruthAudit(hollowResponse, 'tenant-123', context, new MockSecurityManager());
    console.error('✗ FAIL: Hollow response was NOT rejected.');
  } catch (err) {
    if (err instanceof TruthAuditError && err.auditCode === 'INTEGRITY_GATE_REJECTION') {
      console.log('✓ PASS: Hollow response rejected with INTEGRITY_GATE_REJECTION.');
      console.log(`- Error Message: ${err.message}`);
    } else {
      console.error(`✗ FAIL: Unexpected error type: ${err.name} / ${err.auditCode}`);
      console.error(err);
    }
  }

  // TEST 3: Fail-Silent Trap check (Schema vs Integrity)
  console.log('\n[TEST 3] Verifying 422 Separation (Schema vs Integrity)...');
  const brokenSchema = {
    confidence: 'extremely high', // Should fail Zod validation (expected number)
    sources: 'invalid', // Should fail Zod
    executiveAction: {
      narrative: 123
    }
  };
  
  try {
    await controller.finalTruthAudit(brokenSchema, 'tenant-123', {}, new MockSecurityManager());
    console.error('✗ FAIL: Broken schema was NOT rejected.');
  } catch (err) {
    if (err instanceof TruthAuditError && err.auditCode === 'SCHEMA_VALIDATION_FAILED') {
      console.log('✓ PASS: Broken schema rejected as SYSTEM ERROR (SCHEMA_VALIDATION_FAILED).');
    } else {
      console.error(`✗ FAIL: Unexpected audit code for schema failure: ${err.auditCode}`);
    }
  }

  console.log('\n--- V5.3 INTEGRITY HARDENING VERIFICATION COMPLETE ---');
}

runIntegrityTests().catch(err => {
  console.error('CRITICAL TEST ERROR:', err);
  process.exit(1);
});
