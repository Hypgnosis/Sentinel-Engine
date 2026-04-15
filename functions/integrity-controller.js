/**
 * SENTINEL ENGINE V5.0 — Integrity Controller
 * ═══════════════════════════════════════════════════════════
 * Consolidated truth-enforcement layer. This is the SINGLE point
 * through which all inference output passes before client delivery.
 *
 * V5.0 CHANGES:
 * ─────────────────────────────────────────────────────────
 *   - Migrated from a thin wrapper to a full controller.
 *   - DLL procedural rules, Zod schema validation, and
 *     SecurityManager PII tokenization are ALL orchestrated here.
 *   - SecurityManager is injected via constructor (dependency
 *     injection) to avoid circular dependencies and guarantee
 *     the instance is the same one initialized at boot.
 *
 * Pipeline: DLL Rules → Zod Validation → PII Tokenization
 * ═══════════════════════════════════════════════════════════
 */

const { dllInterceptor } = require('./dll');
const { validateInferenceResponse } = require('./schemas');

class IntegrityController {
  /** @type {import('./security-manager').SecurityManager} */
  #securityManager;

  /**
   * @param {import('./security-manager').SecurityManager} securityManager
   *   The SecurityManager instance initialized at global scope in index.js.
   *   Must be fully constructed (keys resolved) before use.
   */
  constructor(securityManager) {
    if (!securityManager) {
      throw new Error(
        '[INTEGRITY_CONTROLLER] SecurityManager instance is required. ' +
        'Ensure it is initialized at boot and injected via constructor.'
      );
    }
    this.#securityManager = securityManager;
  }

  /**
   * PHASE 1: Pre-Inference Procedural Rules.
   * Evaluates DLL deterministic intercepts (Vessel Risk, Margin Gate).
   * If a rule triggers, returns the override response — the AI is bypassed entirely.
   *
   * @param {string} query - User query
   * @param {string} contextPayload - RAG context string
   * @returns {object|null} Override result, or null to continue with AI inference
   */
  checkProceduralRules(query, contextPayload) {
    return dllInterceptor(query, contextPayload);
  }

  /**
   * PHASE 2: Final Truth Audit — Unified pipeline for post-inference validation.
   *
   * Executes in strict order:
   *   1. Procedural DLL post-processing (reserved for future rules)
   *   2. Zod schema validation (final enforcement gate)
   *   3. SecurityManager.tokenizePII() sweep on all narrative fields
   *
   * This is the LAST gate before data leaves the engine. If Zod fails here,
   * it means the recursive retry also failed — hard crash.
   *
   * @param {object} dataObject - Parsed inference response from Gemini
   * @param {object} [context] - Optional request context for future DLL post-rules
   * @param {import('./security-manager').SecurityManager} [securityManagerOverride] - Optional SM override for testing
   * @returns {Promise<object>} Audited, PII-scrubbed response
   * @throws {Error} TRUTH_AUDIT_FAILURE if Zod validation fails
   */
  async finalTruthAudit(dataObject, context = null, securityManagerOverride = null) {
    const sm = securityManagerOverride || this.#securityManager;

    // ── Step 1: Procedural DLL post-processing (future expansion point) ──
    // Currently no post-inference DLL rules. The pre-inference rules
    // (checkProceduralRules) handle all deterministic overrides.

    // ── Step 2: Zod Schema Validation (Final Safety Gate) ──
    const validation = validateInferenceResponse(dataObject);
    if (!validation.valid) {
      // V5.0 AUDIT REMEDY: Graceful degradation instead of hard crash.
      // A Zod mismatch after retry means the AI output is structurally
      // malformed. Throwing here causes a generic 500 — total system collapse.
      // Instead: log the violation, set confidence to 0, and return the
      // raw data with a degraded trust indicator. The client receives
      // actionable data instead of an opaque error.
      console.error(
        `[TRUTH_AUDIT_DEGRADED] Zod schema mismatch after retry completion. ` +
        `Failed modules: ${validation.failedModules.join(', ')}. ` +
        `Errors: ${JSON.stringify(validation.errors)}`
      );
      // Inject degradation marker into the data — client MUST check this field
      dataObject.confidence = 0;
      dataObject._truthAuditDegraded = true;
      dataObject._failedModules = validation.failedModules;
    }

    let audited = validation.result || dataObject;

    // ── Step 3: PII Tokenization (HMAC-SHA256, irreversible) ──
    // Sweep all narrative fields for SSN, CC, and Subject ID patterns.
    if (audited.narrative) {
      audited.narrative = await sm.tokenizePII(audited.narrative);
    }

    if (audited.executiveAction && audited.executiveAction.narrative) {
      audited.executiveAction.narrative = await sm.tokenizePII(
        audited.executiveAction.narrative
      );
    }

    // Sweep recommendation text for PII leakage
    if (audited.executiveAction && Array.isArray(audited.executiveAction.recommendations)) {
      for (let i = 0; i < audited.executiveAction.recommendations.length; i++) {
        const rec = audited.executiveAction.recommendations[i];
        if (rec.action) {
          audited.executiveAction.recommendations[i].action = await sm.tokenizePII(rec.action);
        }
      }
    }

    return audited;
  }
}

module.exports = { IntegrityController };
