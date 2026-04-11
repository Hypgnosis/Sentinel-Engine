/**
 * SENTINEL ENGINE V4.5 — Deterministic Logic Layer (DLL)
 * ═══════════════════════════════════════════════════════════
 * Hard-coded safety intercepts that override AI behavior.
 */

/**
 * Intercepts the query and context to enforce deterministic rules.
 * 
 * @param {string} query - User query
 * @param {string} context - RAG context
 * @returns {object|null} Override result or null to continue with AI
 */
function dllInterceptor(query, context) {
  const normalizedQuery = query.toLowerCase();
  const normalizedContext = context.toLowerCase();

  // Rule 1: High vessel risk fallback
  // Logic: If query mentions 'sea' and context contains 'vessel_risk: high'
  if (normalizedQuery.includes('sea') && normalizedContext.includes('"vessel_risk":"high"')) {
    return {
      narrative: "### DETERMINISTIC OVERRIDE: HIGH VESSEL RISK\n\nOperational intelligence indicates **vessel_risk: HIGH** for requested sea lanes. Sentinel DLL Directive 21.a is now active.\n\n**Mandatory Decision:** Switch transport mode to **Rail/Land Gateway** immediately. Sea transit is suspended for this lane until risk levels normalize.\n\n**Details:** Potential threat detected in AIS patterns. Security protocol escalation level 4.",
      metrics: [
        { label: "Vessel Risk", value: "HIGH", trend: "stable", confidence: 1.0 },
        { label: "Override Directive", value: "DLL-21a", trend: "stable", confidence: 1.0 }
      ],
      confidence: 1.0,
      sources: ["Sentinel DLL Safety Interceptor"],
      dataAuthority: "SENTINEL_DLL_OVERRIDE"
    };
  }

  // Rule 2: Margin Level Risk
  // (This can also be implemented as a post-processor or by augmenting the prompt)
  // For now, if we detect low margin in the context, we can flag it.
  if (normalizedContext.includes('"margin"') && extractMinMargin(context) < 0.05) {
     // We don't necessarily override the whole result if we want the AI to analyze it,
     // but we could prepend a warning or handle it here.
     // In V4.5, "The AI MUST flag Lane Level Risk and escalate to a human."
     // We can add a "DLL metadata" that the frontend can use to show an alert.
  }

  return null; // No override
}

/**
 * Utility to extract minimum margin from context JSON strings
 */
function extractMinMargin(context) {
  const matches = context.match(/"margin":\s*(\d*\.?\d+)/g);
  if (!matches) return 1.0;
  const margins = matches.map(m => parseFloat(m.split(':')[1]));
  return Math.min(...margins);
}

/**
 * PII Redaction / Tokenization for MedTechpacks
 */
function redactPII(text) {
  // Simple mock tokenization
  // Replace patterns that look like SSN, Credit Cards, or specific Patient IDs
  return text.replace(/\d{3}-\d{2}-\d{4}/g, "[SSN_TOKEN]")
             .replace(/\d{4}-\d{4}-\d{4}-\d{4}/g, "[CC_TOKEN]")
             .replace(/patient_id:\s*[a-zA-Z0-9]+/gi, "patient_id: [SUBJECT_TOKEN]");
}

module.exports = {
  dllInterceptor,
  redactPII
};
