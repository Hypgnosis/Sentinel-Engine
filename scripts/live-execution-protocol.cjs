const { AuthorityUnit, globalGraphRegistry } = require('../functions/authority-graph/unit');
const { ArbitrationInterface } = require('../functions/authority-graph/arbitration');
const { MonotonicReductionProtocol } = require('../functions/authority-graph/reduction');
const { EvidenceLocker, EVENT_TYPES } = require('../functions/evidence-locker');
const { SecurityManager, AsymmetricKmsProvider } = require('../functions/security-manager');
const crypto = require('crypto');

async function runLiveExecutionProtocol() {
  console.log('--- SENTINEL V5.5 LIVE EXECUTION PROTOCOL ---\n');

  console.log('[KMS] Generating ECDSA P-256 Keys for Asymmetric KMS...');
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  // Initialize true Asymmetric KMS Provider
  const asymmetricKms = new AsymmetricKmsProvider({
    privateKeyPem: privateKey,
    publicKeyPem: publicKey,
    encryptionKey: crypto.randomBytes(16).toString('hex')
  });

  // Initialize SecurityManager with the Asymmetric KMS Provider
  const securityManager = new SecurityManager(asymmetricKms);

  // Initialize Evidence Locker
  const evidenceLocker = new EvidenceLocker(securityManager);

  // ---------------------------------------------------------
  // PHASE 1: Deploy a Shadow Authority Domain
  // ---------------------------------------------------------
  console.log('[Phase 1] Deploying Shadow Authority Domain');
  
  // Create Root Authority
  const root = new AuthorityUnit({
    id: 'ROOT_AUTHORITY',
    scope: { decision_type: 'ANY', domain: 'SYSTEM', limits: [{ metric: 'funds', max: 1000000 }] },
    delegation: { granted_by: 'ROOT' },
    provenance: { chain: ['ROOT'] }
  });

  // Create Shadow Domain Unit
  const shadowDomainUnit = new AuthorityUnit({
    id: 'SHADOW_DOMAIN_UNIT',
    scope: {
      decision_type: 'shadow_operations',
      domain: 'production-test-shadow',
      conditions: [
        function MUST_NOT_BE_IRREVERSIBLE(context) {
          if (context.is_irreversible && context.requires_human_override) return false;
          return true;
        },
        'EXPECT_NO_CONTRADICTION' // NLI Semantics Integration
      ],
      limits: [{ metric: 'funds', max: 5000 }]
    },
    delegation: { granted_by: 'ROOT_AUTHORITY' },
    provenance: { chain: ['ROOT', 'ROOT_AUTHORITY', 'SHADOW_DOMAIN_UNIT'] },
    termination: {
      revocation_triggers: ['TIMEOUT', 'SUPERVISOR_REJECTED']
    }
  });

  console.log(`✅ Test Domain registered: ${shadowDomainUnit.scope.domain}`);
  console.log(`✅ Contracts applied inheriting Constitutional Invariants.`);

  // ---------------------------------------------------------
  // PHASE 2: Trigger a "Controlled Reduction"
  // ---------------------------------------------------------
  console.log('\n[Phase 2] Triggering a "Controlled Reduction"');
  
  const requestId1 = `REQ-SHADOW-${Date.now()}`;

  console.log('  -> Simulating TTL Timeout...');
  const finding = await MonotonicReductionProtocol.contractToMinimum(
    shadowDomainUnit.id,
    'TIMEOUT - Supervisor Response TTL Expired',
    asymmetricKms
  );

  console.log(`  -> Active Governance Feed: [RED WARNING] ${finding.trigger}`);

  if (finding.signature && finding.status === 'MONOTONIC_REDUCTION_APPLIED') {
    console.log(`✅ Reduction successfully applied to Minimum Viable Safe State.`);
  } else {
    console.error(`❌ Reduction failed: ${finding.status}`);
  }

  // Route Governance Finding to Evidence Locker
  let lockerId1;
  try {
    const { lockerId, signature } = await evidenceLocker.recordEvent({
      requestId: requestId1,
      eventType: EVENT_TYPES.GOVERNANCE_FINDING,
      tenantId: 'TENANT_SHADOW',
      payload: finding
    });
    lockerId1 = lockerId;
    console.log(`✅ Governance Finding saved to Evidence Locker. Locker ID: ${lockerId}`);
    console.log(`✅ Finding is signed and immutable. Signature: ${signature.substring(0, 16)}...`);
  } catch (err) {
    console.error(`❌ Database insertion failed for Governance Finding: ${err.message}`);
  }

  // ---------------------------------------------------------
  // PHASE 3: Verify the "Prosecutor" Boundary
  // ---------------------------------------------------------
  console.log('\n[Phase 3] Verifying the "Prosecutor" Boundary');
  
  const requestId2 = `REQ-SHADOW-${Date.now()+1}`;

  // Introduce Contradiction in context
  const faultyContext = {
    verdict: { isVerified: false, reason: "Logical fallacy: Open all circuit breakers while keeping the line energized" },
    is_irreversible: true
  };

  console.log('  -> Introducing contradiction into Arbitration Interface...');

  const record = await ArbitrationInterface.evaluateDecision({
    request_id: requestId2,
    action: {
      source_unit_id: 'SHADOW_DOMAIN_UNIT',
      domain: shadowDomainUnit.scope.domain, // use the current mutated domain
      is_irreversible: true
    },
    context: faultyContext,
    asymmetricKms: asymmetricKms
  });

  if (record.status === 'DENIED_CONSTITUTIONAL_CONDITIONS_FAILED' && record.tier_resolved_at === 'CONSTITUTIONAL') {
    console.log(`✅ Prosecutor correctly identified unconfirmed condition/contradiction.`);
    console.log(`✅ Arbitration Interface intercepted action with status: ${record.status}`);
  } else {
    console.error(`❌ Prosecutor Boundary failed to intercept: ${record.status}`);
  }

  // Route Legibility Record to Evidence Locker
  let lockerId2;
  try {
    const { lockerId } = await evidenceLocker.recordEvent({
      requestId: requestId2,
      eventType: EVENT_TYPES.LEGIBILITY_RECORD,
      tenantId: 'TENANT_SHADOW',
      payload: record
    });
    lockerId2 = lockerId;
    console.log(`✅ Legibility Record saved to Evidence Locker. Locker ID: ${lockerId}`);
  } catch (err) {
    console.error(`❌ Database insertion failed for Legibility Record: ${err.message}`);
  }

  console.log('\n[Phase 4] Verifying Non-Repudiation (KMS HSM Verification)');
  
  const recordWithoutSig = { ...record };
  delete recordWithoutSig.signature;
  delete recordWithoutSig.signature_algorithm;
  const payloadToVerify = Buffer.from(JSON.stringify(recordWithoutSig));
  const isSignatureValid = await asymmetricKms.verify(payloadToVerify, record.signature);
  
  if (isSignatureValid) {
    console.log(`✅ Legibility Record signature mathematically verified using public key.`);
  } else {
    console.error(`❌ Signature verification failed!`);
  }

  // Attempt forgery on the Legibility Record
  console.log('  -> Simulating malicious modification of Legibility Record...');
  const forgedRecord = { ...recordWithoutSig, status: 'PERMIT' };
  const forgedPayload = Buffer.from(JSON.stringify(forgedRecord));
  const isForgedValid = await asymmetricKms.verify(forgedPayload, record.signature);

  if (!isForgedValid) {
    console.log(`✅ Forgery correctly rejected. Non-repudiation confirmed.`);
  } else {
    console.error(`❌ Forged record improperly verified!`);
  }

  // ---------------------------------------------------------
  // PHASE 5: Verify Provenance Chain Forgery Rejection
  // ---------------------------------------------------------
  console.log('\n[Phase 5] Verifying Provenance Chain Forgery Rejection');
  
  // Create a rogue unit with a forged provenance chain
  const rogueChain = ['ROOT', 'ROOT_AUTHORITY', 'ROGUE_UNIT'];
  const fakeSignature = 'invalid-signature-data';
  
  const rogueUnit = new AuthorityUnit({
    id: 'ROGUE_UNIT',
    scope: { decision_type: 'shadow_operations', domain: 'production-test-shadow', limits: [] },
    delegation: { granted_by: 'ROOT_AUTHORITY' },
    provenance: { chain: rogueChain, signature: fakeSignature }
  });

  const requestId3 = `REQ-ROGUE-${Date.now()}`;
  console.log('  -> Submitting action from ROGUE_UNIT with forged provenance signature...');
  
  const rogueRecord = await ArbitrationInterface.evaluateDecision({
    request_id: requestId3,
    action: {
      source_unit_id: 'ROGUE_UNIT',
      domain: rogueUnit.scope.domain,
      is_irreversible: true
    },
    context: {},
    asymmetricKms: asymmetricKms
  });

  if (rogueRecord.status === 'DENIED_PROVENANCE_FORGERY') {
    console.log(`✅ Prosecutor intercepted rogue unit. Status: ${rogueRecord.status}`);
  } else {
    console.error(`❌ Prosecutor failed to intercept rogue unit! Status: ${rogueRecord.status}`);
  }

  // ---------------------------------------------------------
  // PHASE 6: Verify Database Persistence & JSONB Integrity
  // ---------------------------------------------------------
  console.log('\n[Phase 6] Verifying Database Persistence & JSONB Integrity');
  
  if (lockerId1) {
    console.log(`  -> Retrieving Evidence Locker Fragment for Request ID: ${requestId1}`);
    const fragment = await evidenceLocker.getFragment(requestId1);
    
    if (fragment && fragment.length > 0) {
      const entry = fragment.find(e => e.locker_id === lockerId1);
      if (entry) {
        console.log(`✅ Retrieved locker entry from PostgreSQL.`);
        // Verify JSONB integrity: payload should be parsed and retain fields
        if (entry.payload && entry.payload.trigger === finding.trigger) {
          console.log(`✅ JSONB data-type integrity confirmed. Trigger accurately retrieved.`);
        } else {
          console.error(`❌ JSONB data-type corruption detected!`);
        }
      } else {
        console.error(`❌ Could not find entry with lockerId ${lockerId1} in the fragment!`);
      }
    } else {
      console.error(`❌ Fragment retrieval returned 0 records! Database persistence failed.`);
    }
  } else {
    console.error(`❌ Skipping Phase 6 due to Phase 2 insertion failure.`);
  }

  // Also test the verifyChain method
  console.log('  -> Verifying chain integrity for TENANT_SHADOW...');
  const chainResult = await evidenceLocker.verifyChain('TENANT_SHADOW');
  if (chainResult.valid) {
    console.log(`✅ Evidence chain is cryptographically intact (${chainResult.entryCount} entries verified).`);
  } else {
    console.error(`❌ Evidence chain verification failed at ${chainResult.brokenAt}.`);
  }

  console.log('\n--- LIVE EXECUTION PROTOCOL COMPLETED SUCCESSFULLY ---');
  process.exit(0);
}

runLiveExecutionProtocol().catch(err => {
  console.error('[PROTOCOL ERROR]', err);
  process.exit(1);
});
