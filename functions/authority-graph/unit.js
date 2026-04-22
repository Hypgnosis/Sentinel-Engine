/**
 * SENTINEL ENGINE V5.5 — Authority Graph Specification (AGS v0.1.0)
 * ═══════════════════════════════════════════════════════════════
 * The Authority Unit Schema
 * Encapsulates formal decision boundaries.
 * ═══════════════════════════════════════════════════════════════
 */

// Simulating a graph state lookup for provenance
const globalGraphRegistry = new Map();

class AuthorityUnit {
  /**
   * @param {object} params 
   * @param {string} params.id Unique identified
   * @param {object} params.scope 
   * @param {string} params.scope.decision_type Class of decisions (e.g. "refund_approval")
   * @param {string} params.scope.domain Entities covered (e.g. "transactions")
   * @param {string[]} [params.scope.conditions] Evaluable predicates (e.g. NLI prosecutor checks)
   * @param {object[]} [params.scope.limits] Boundaries/thresholds (e.g. { metric: "amount", max: 5000 })
   * @param {object} [params.delegation] Delegation constraints
   * @param {string|null} [params.delegation.granted_by] Reference to grantor Unit ID
   * @param {object} [params.delegation.contract] Terms
   * @param {boolean} [params.delegation.re_delegation] Further delegation permitted
   * @param {object} params.termination
   * @param {number|null} [params.termination.expiry] Unix timestamp
   * @param {string[]} [params.termination.revocation_triggers] Event types that revoke this 
   * @param {object} params.provenance
   * @param {string[]} params.provenance.chain Path to root authority
   * @param {boolean} params.provenance.verifiable Cryptographic verification flag
   */
  constructor(params) {
    this.id = params.id;
    
    this.scope = {
      decision_type: params.scope.decision_type,
      domain: params.scope.domain,
      conditions: params.scope.conditions || [],
      limits: params.scope.limits || []
    };

    this.delegation = {
      granted_by: params.delegation?.granted_by || null,
      contract: params.delegation?.contract || null,
      re_delegation: params.delegation?.re_delegation || false
    };

    this.termination = {
      expiry: params.termination?.expiry || null,
      revocation_triggers: params.termination?.revocation_triggers || []
    };

    this.provenance = {
      chain: params.provenance?.chain || [this.id],
      verifiable: params.provenance?.verifiable || false,
      signature: params.provenance?.signature || null
    };

    // No Ambient Authority: component cannot exist outside graph
    globalGraphRegistry.set(this.id, this);

    this.validateProvenance();
    this.validateMonotonicAttenuation();
  }

  /**
   * Provenance Completeness:
   * Every non-root unit must have a chain terminating at a root authority.
   */
  validateProvenance() {
    // A root authority grants itself
    if (this.delegation.granted_by === null || this.delegation.granted_by === 'ROOT') {
      if (this.provenance.chain[this.provenance.chain.length - 1] !== 'ROOT' &&
          this.provenance.chain[this.provenance.chain.length - 1] !== this.id) {
        throw new Error(`[AGS_VIOLATION] Provenance Completeness Failed: Root unit ${this.id} chain must terminate at itself or ROOT.`);
      }
      return true;
    }

    if (!this.provenance.chain.includes('ROOT') && !this.provenance.chain.includes(this.delegation.granted_by)) {
      throw new Error(`[AGS_VIOLATION] Provenance Completeness Failed: Non-root unit ${this.id} lacks valid root chain.`);
    }

    const grantor = globalGraphRegistry.get(this.delegation.granted_by);
    if (!grantor) {
      throw new Error(`[AGS_VIOLATION] Undefined Grantor: Unit ${this.id} references non-existent grantor ${this.delegation.granted_by}. No Ambient Authority permitted.`);
    }

    return true;
  }

  /**
   * Monotonic Attenuation:
   * Delegated scope must be equal to or narrower than the grantor's scope on every dimension.
   */
  validateMonotonicAttenuation() {
    if (!this.delegation.granted_by || this.delegation.granted_by === 'ROOT') return true;

    const grantor = globalGraphRegistry.get(this.delegation.granted_by);
    if (!grantor) return false;

    // Check Domains (e.g. Grantor cannot grant ENERGY if they only own LOGISTICS, unless Grantor is SYSTEM)
    if (grantor.scope.domain !== 'SYSTEM' && grantor.scope.domain !== this.scope.domain) {
      throw new Error(`[AGS_VIOLATION] Monotonic Attenuation: Domain mismatch. Grantor is ${grantor.scope.domain}, Delegate requests ${this.scope.domain}.`);
    }

    // Check Limits (numeric bounding)
    for (const delegateLimit of this.scope.limits) {
      const grantorLimit = grantor.scope.limits.find(l => l.metric === delegateLimit.metric);
      if (grantorLimit && typeof grantorLimit.max === 'number' && typeof delegateLimit.max === 'number') {
        if (delegateLimit.max > grantorLimit.max) {
           throw new Error(`[AGS_VIOLATION] Monotonic Attenuation: Limit exceeded. Grantor provides max ${grantorLimit.max} for ${delegateLimit.metric}, Delegate requests ${delegateLimit.max}.`);
        }
      }
    }

    return true;
  }

  /**
   * Evaluate conditions (including formal NLI semantics)
   * @param {object} context 
   * @returns {boolean}
   */
  evaluateConditions(context) {
    // Time-bounded expiry limit check
    if (this.termination.expiry && Date.now() > this.termination.expiry) {
      console.warn(`[AGS_EXPIRED] AuthorityUnit ${this.id} passed expiry timestamp.`);
      return false;
    }

    // Evaluate logical predicates assigned to this graph
    for (const condition of this.scope.conditions) {
      if (typeof condition === 'function') {
         if (!condition(context)) return false;
      }
      // NLI semantics integration: If condition maps to an NLI contradiction check string
      if (typeof condition === 'string' && condition.startsWith('EXPECT_NO_CONTRADICTION')) {
         if (context.verdict && context.verdict.isVerified === false) {
           return false;
         }
      }
    }

    return true;
  }
}

module.exports = {
  AuthorityUnit,
  globalGraphRegistry
};
