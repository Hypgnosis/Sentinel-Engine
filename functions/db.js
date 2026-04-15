/**
 * SENTINEL ENGINE V5.1 — PostgreSQL Client (Pristine Reservoir)
 * ═══════════════════════════════════════════════════════════
 * High-speed RAG grounding for inference.
 *
 * V5.1 DESIGN RULE — CONFIGURATION MONISM:
 *   DATABASE_URL is the SOLE connection configuration.
 *   If it is absent at boot, the system crashes.
 *   No DB_HOST/DB_USER/DB_PASSWORD fallback chains.
 *   No hardcoded hostnames. One source of truth.
 */

const postgres = require('postgres');

// ─────────────────────────────────────────────────────
//  CONNECTION POOL (Boot-Validated, Configuration Monism)
// ─────────────────────────────────────────────────────

let _sql = null;

/**
 * Returns a live Postgres connection pool.
 * Consumes DATABASE_URL exclusively from environment.
 * Throws FATAL_CONFIG_FAILURE if missing.
 */
function getSql() {
  if (_sql) return _sql;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'FATAL_CONFIG_FAILURE: DATABASE_URL is required but was not provisioned. ' +
      'Production configuration must be injected via environment, not compiled.'
    );
  }

  console.log('[DB_INIT] Initializing Postgres connection pool via DATABASE_URL.');
  _sql = postgres(url, {
    ssl: 'require',
    max: 50,
    idle_timeout: 30,
    connect_timeout: 5,
    max_lifetime: 1800,
  });
  return _sql;
}

/**
 * Executes a semantic search across multiple tables.
 * V4.5.2: Aligned to 2048B context budget with top-3 per table.
 */
async function postgresVectorSearch(queryVector, tenantId) {
  const sql = getSql();
  if (!sql) return { contextPayload: '', resultCount: 0 };

  const vectorStr = `[${queryVector.join(',')}]`;
  const tables = ['freight_indices', 'port_congestion', 'maritime_chokepoints', 'risk_matrix'];
  
  let totalCount = 0;
  const sections = [];

  for (const table of tables) {
    try {
      // pgvector cosine distance — top 3 per table for payload budget
      const rows = await sql`
        SELECT *, (embedding <=> ${vectorStr}::vector) as distance
        FROM ${sql(table)}
        WHERE tenant_id = ${tenantId}
        ORDER BY distance ASC
        LIMIT 3
      `;

      if (rows.length > 0) {
        // Relaxed distance filter to accommodate generic queries that may evaluate to ~0.5 distance
        const relevantRows = rows.filter(r => r.distance < 0.75);
        if (relevantRows.length > 0) {
          totalCount += relevantRows.length;
          const sectionLines = relevantRows.map((r, i) => {
            // Strip out large/internal fields to compress JSON length
            const { embedding, distance, id, tenant_id, entity_hash, ingested_at, ...displayFields } = r;
            return `  [${i + 1}] (relevance: ${(1 - r.distance).toFixed(3)}) ${JSON.stringify(displayFields)}`;
          });
          sections.push(`\n── Postgres:${table} (${relevantRows.length} results) ──\n${sectionLines.join('\n')}`);
        }
      }
    } catch (err) {
      console.warn(`[DB_SEARCH_WARNING] table ${table} failed:`, err.message);
    }
  }

  // Gemini Flash can handle up to 1M tokens. Expanding limit to easily accommodate 4 tables.
  const MAX_CONTEXT_BYTES = 8192;
  let fullPayload = sections.join('\n');
  if (fullPayload.length > MAX_CONTEXT_BYTES) {
    console.warn(`[PG_CONTEXT_CAP] Payload ${fullPayload.length}B exceeds ${MAX_CONTEXT_BYTES}B limit.`);
    fullPayload = fullPayload.substring(0, MAX_CONTEXT_BYTES);
    const lastBracket = fullPayload.lastIndexOf('}');
    if (lastBracket > 0) fullPayload = fullPayload.substring(0, lastBracket + 1);
    fullPayload += `\n[CONTEXT_CAPPED: ${MAX_CONTEXT_BYTES}B limit enforced]`;
  }

  return {
    contextPayload: fullPayload,
    resultCount: totalCount
  };
}

/**
 * Check if a Subject ID is revoked (The Kill Switch).
 */
async function isSubjectRevoked(subjectId) {
  const sql = getSql();
  if (!sql || !subjectId) return false;
  try {
    const [rev] = await sql`
      SELECT 1 FROM subject_revocation_list WHERE subject_id = ${subjectId}
    `;
    return !!rev;
  } catch (err) {
    console.error('[DB_ERROR] Revocation check failed:', err.message);
    return false;
  }
}

module.exports = {
  getSql,
  postgresVectorSearch,
  isSubjectRevoked
};
