/**
 * SENTINEL ENGINE V4.9-RC — Adversarial NLI Verification Loop
 * ═══════════════════════════════════════════════════════════════
 * "The Prosecutor" — Asynchronous sidecar verification.
 *
 * After primary Gemini inference completes, this module fires an
 * async call to a lightweight model (gemini-2.0-flash-lite) that
 * acts as a fact-checking adversary. It identifies semantic
 * contradictions between the generated narrative and the source
 * context logs.
 *
 * The primary API response is NEVER blocked by verification.
 * Results are stored in Postgres for async polling.
 * ═══════════════════════════════════════════════════════════════
 */

const { getSql } = require('./db');

const SIDECAR_MODEL = 'gemini-2.0-flash-lite';

// ─────────────────────────────────────────────────────
//  ADVERSARIAL PROMPT TEMPLATE
// ─────────────────────────────────────────────────────

const PROSECUTOR_PROMPT = `You are a Verification Prosecutor for the Sentinel Intelligence Engine.
Your mandate is absolute factual integrity. You must:

1. Compare the GENERATED NARRATIVE against the SOURCE LOGS provided below.
2. Identify ANY semantic contradictions, unsupported claims, or hallucinated data points.
3. Flag specific discrepancies with exact quotes from both the narrative and source.

CRITICAL RULES:
- A claim is CONTRADICTED if the source data explicitly states the opposite.
- A claim is UNSUPPORTED if no source data backs it up (this is a soft discrepancy).
- Numbers, dates, port names, risk levels and trends are HIGH-PRIORITY for verification.
- If the narrative is broadly consistent with sources, return isVerified: true.

Return your verdict as a JSON object:
{
  "isVerified": boolean,
  "discrepancies": ["string describing each discrepancy found"],
  "verificationNotes": "Brief summary of your analysis"
}`;

// ─────────────────────────────────────────────────────
//  VERIFICATION SCHEMA (for Gemini responseSchema)
// ─────────────────────────────────────────────────────

const VERIFICATION_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    isVerified: { type: 'BOOLEAN', description: 'True if the narrative is factually consistent with source data.' },
    discrepancies: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'List of specific contradictions or unsupported claims found.',
    },
    verificationNotes: { type: 'STRING', description: 'Brief summary of the verification analysis.' },
  },
  required: ['isVerified', 'discrepancies'],
};

// ─────────────────────────────────────────────────────
//  POSTGRES TABLE SETUP (idempotent)
// ─────────────────────────────────────────────────────

let _tableEnsured = false;

async function ensureVerificationTable() {
  if (_tableEnsured) return;
  const sql = getSql();
  if (!sql) return;

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS verification_results (
        id SERIAL PRIMARY KEY,
        request_id TEXT NOT NULL UNIQUE,
        tenant_id TEXT NOT NULL,
        is_verified BOOLEAN,
        discrepancies JSONB DEFAULT '[]',
        verification_notes TEXT,
        sidecar_model TEXT,
        verified_at TIMESTAMPTZ DEFAULT NOW(),
        latency_ms INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    _tableEnsured = true;
    console.log('[VERIFICATION_LOOP] Table verification_results ensured.');
  } catch (err) {
    console.warn('[VERIFICATION_LOOP] Table creation skipped:', err.message);
    // Table might already exist or we don't have DDL perms — not fatal
    _tableEnsured = true;
  }
}

// ─────────────────────────────────────────────────────
//  STORE VERIFICATION RESULT
// ─────────────────────────────────────────────────────

async function storeVerificationResult(requestId, tenantId, result, latencyMs) {
  const sql = getSql();
  if (!sql) {
    console.warn('[VERIFICATION_LOOP] Cannot store result — DB unavailable.');
    return;
  }

  try {
    await sql`
      INSERT INTO verification_results (request_id, tenant_id, is_verified, discrepancies, verification_notes, sidecar_model, latency_ms)
      VALUES (
        ${requestId},
        ${tenantId},
        ${result.isVerified},
        ${JSON.stringify(result.discrepancies || [])},
        ${result.verificationNotes || ''},
        ${SIDECAR_MODEL},
        ${latencyMs}
      )
      ON CONFLICT (request_id) DO UPDATE SET
        is_verified = EXCLUDED.is_verified,
        discrepancies = EXCLUDED.discrepancies,
        verification_notes = EXCLUDED.verification_notes,
        verified_at = NOW(),
        latency_ms = EXCLUDED.latency_ms
    `;
    console.log(`[VERIFICATION_LOOP] Result stored for ${requestId}: verified=${result.isVerified}`);
  } catch (err) {
    console.error(`[VERIFICATION_LOOP] Failed to store result for ${requestId}:`, err.message);
  }
}

// ─────────────────────────────────────────────────────
//  LAUNCH VERIFICATION SIDECAR (Fire-and-forget)
// ─────────────────────────────────────────────────────

/**
 * Launches the Prosecutor sidecar asynchronously.
 * This function is called WITHOUT await so it doesn't block the primary response.
 *
 * @param {object} params
 * @param {object} params.genaiClient - Google GenAI client
 * @param {string} params.requestId - Unique request identifier
 * @param {string} params.tenantId - Tenant context
 * @param {string} params.narrative - Generated narrative from primary model
 * @param {string} params.sourceContext - RAG source logs
 * @returns {Promise<void>}
 */
async function launchVerificationSidecar({ genaiClient, requestId, tenantId, narrative, sourceContext }) {
  const t0 = Date.now();

  try {
    await ensureVerificationTable();

    const userContent = `GENERATED NARRATIVE:\n${narrative}\n\nSOURCE LOGS:\n${sourceContext}`;

    const result = await genaiClient.models.generateContent({
      model: SIDECAR_MODEL,
      contents: userContent,
      config: {
        systemInstruction: PROSECUTOR_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: VERIFICATION_RESPONSE_SCHEMA,
        temperature: 0.0,  // Deterministic verification
        maxOutputTokens: 512,
        topK: 5,
        topP: 0.3,
      },
    });

    let cleanedText = result.text.replace(/```(json)?/gi, '').trim();
    cleanedText = cleanedText.replace(/,\s*([\]}])/g, '$1');
    const verdict = JSON.parse(cleanedText);

    const latencyMs = Date.now() - t0;
    console.log(`[VERIFICATION_LOOP] Prosecutor completed in ${latencyMs}ms. Verified: ${verdict.isVerified}`);

    // ═══ V5.0 AUDIT REMEDY: Close the Loop ═══
    // If the Prosecutor finds hallucinations, emit a structured log
    // that triggers a Cloud Monitoring alert. The user may have already
    // received the response — this creates the audit trail.
    if (verdict.isVerified === false) {
      console.error(JSON.stringify({
        severity: 'CRITICAL',
        eventType: 'HALLUCINATION_DETECTED',
        requestId,
        tenantId,
        discrepancyCount: verdict.discrepancies?.length || 0,
        discrepancies: verdict.discrepancies,
        verificationNotes: verdict.verificationNotes,
        latencyMs,
        message: `[HALLUCINATION_DETECTED] Prosecutor flagged ${verdict.discrepancies?.length || 0} discrepancy(ies) for request ${requestId}. Audit trail recorded.`,
      }));
    }

    if (verdict.discrepancies && verdict.discrepancies.length > 0) {
      verdict.discrepancies.forEach((d, i) => console.warn(`  [${i + 1}] ${d}`));
    }

    await storeVerificationResult(requestId, tenantId, verdict, latencyMs);
  } catch (err) {
    const latencyMs = Date.now() - t0;
    // Structured log for monitoring — sidecar failures must not be silent
    console.error(JSON.stringify({
      severity: 'ERROR',
      eventType: 'VERIFICATION_SIDECAR_FAILURE',
      requestId,
      tenantId,
      error: err.message,
      latencyMs,
      message: `[VERIFICATION_SIDECAR_FAILURE] Prosecutor failed for ${requestId} after ${latencyMs}ms: ${err.message}`,
    }));

    // Store failure result so polling knows it completed (with error)
    await storeVerificationResult(requestId, tenantId, {
      isVerified: null,
      discrepancies: [`VERIFICATION_ERROR: ${err.message}`],
      verificationNotes: 'Sidecar execution failed.',
    }, latencyMs).catch(storeErr => {
      // DB is also down — emit structured log for this too
      console.error(JSON.stringify({
        severity: 'CRITICAL',
        eventType: 'VERIFICATION_STORE_FAILURE',
        requestId,
        tenantId,
        error: storeErr.message,
        message: `[VERIFICATION_STORE_FAILURE] Could not persist verification failure for ${requestId}. Audit trail is BROKEN.`,
      }));
    });
  }
}

// ─────────────────────────────────────────────────────
//  POLL VERIFICATION STATUS
// ─────────────────────────────────────────────────────

/**
 * Retrieves the async verification result for a given requestId.
 *
 * @param {string} requestId
 * @returns {Promise<{status: string, result: object|null}>}
 */
async function getVerificationStatus(requestId) {
  const sql = getSql();
  if (!sql) {
    return { status: 'unavailable', result: null };
  }

  try {
    const [row] = await sql`
      SELECT is_verified, discrepancies, verification_notes, sidecar_model, verified_at, latency_ms
      FROM verification_results
      WHERE request_id = ${requestId}
    `;

    if (!row) {
      return { status: 'pending', result: null };
    }

    return {
      status: 'completed',
      result: {
        isVerified: row.is_verified,
        discrepancies: row.discrepancies,
        verificationNotes: row.verification_notes,
        sidecarModel: row.sidecar_model,
        verifiedAt: row.verified_at,
        latencyMs: row.latency_ms,
      },
    };
  } catch (err) {
    console.error('[VERIFICATION_LOOP] Poll error:', err.message);
    return { status: 'error', result: null };
  }
}

module.exports = {
  launchVerificationSidecar,
  getVerificationStatus,
  ensureVerificationTable,
  SIDECAR_MODEL,
};
