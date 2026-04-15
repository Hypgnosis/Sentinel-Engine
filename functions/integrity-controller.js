const { dllInterceptor } = require('./dll');
const { validateInferenceResponse } = require('./schemas');

class IntegrityController {
  constructor(securityManager) {
    this.securityManager = securityManager;
  }

  /**
   * Applies pre-inference procedural rules.
   * If a rule triggers, returns the override response.
   */
  checkProceduralRules(query, contextPayload) {
    return dllInterceptor(query, contextPayload);
  }

  /**
   * Performs the Final Truth Audit on the AI response:
   * 1. Schema Validation (Zod final enforcement)
   * 2. PII Tokenization (SecurityManager HMAC)
   */
  async finalTruthAudit(dataObject) {
    // 1. Zod Validation (Final Safety Check)
    const validation = validateInferenceResponse(dataObject);
    if (!validation.valid) {
      throw new Error(`TRUTH_AUDIT_FAILURE: Zod schema mismatch after retry completion. Failed modules: ${validation.failedModules.join(', ')}`);
    }

    let audited = validation.result;

    // 2. Data Sovereignty: PII Tokenization
    if (audited.narrative) {
      audited.narrative = await this.securityManager.tokenizePII(audited.narrative);
    }
    
    if (audited.executiveAction && audited.executiveAction.narrative) {
      audited.executiveAction.narrative = await this.securityManager.tokenizePII(audited.executiveAction.narrative);
    }

    return audited;
  }
}

module.exports = { IntegrityController };
