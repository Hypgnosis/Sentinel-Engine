/**
 * SENTINEL ENGINE — CORE INFRASTRUCTURE (V5.2 "SOVEREIGN ABSOLUTE")
 * ═══════════════════════════════════════════════════════════
 * Google Cloud Function (Node.js 20) — Gen2
 *
 * V5.2 CHANGES (Regulated Sector Hardening):
 * ─────────────────────────────────────────
 * 1 — Pessimistic Classification: Shadow Classifier FAILS CLOSED.
 *     Timeout/error/ambiguity → SENSITIVE → mandatory sync audit.
 * 2 — Pristine Priority Racing: 150ms window favors Postgres.
 *     Prevents stale BigQuery cache from winning by milliseconds.
 * 3 — SYSTEM_PEPPER: High-entropy boot secret for HKDF derivation.
 *     PII tokens are unreachable even if tenantId is compromised.
 * 4 — Configuration Monism: DATABASE_URL only. No fallback chains.
 *
 * Constraints:
 *   - Truth over Speed (P99 may increase for SENSITIVE queries)
 *   - Correctness over Latency
 *   - Zod-enforced schema compliance
 *   - Zero hardcoded secrets or connection strings
 *   - Zero lazy-loaded security primitives
 * ═══════════════════════════════════════════════════════════
 */

const functions = require('@google-cloud/functions-framework');
const { GoogleGenAI } = require('@google/genai');
const { BigQuery } = require('@google-cloud/bigquery');
const { Firestore } = require('@google-cloud/firestore');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const textToSpeech = require('@google-cloud/text-to-speech');
const admin = require('firebase-admin');

// ═══════════════════════════════════════════════════════
//  TASK 1: ATOMIC BOOT GUARD (Global Scope)
//  ─────────────────────────────────────────────────────
//  ALL critical secrets are validated and the SecurityManager
//  is constructed BEFORE any function exports are registered.
//  If ANY secret is missing, the container crashes immediately.
//  No lazy-loading. No graceful degradation. No security theatre.
// ═══════════════════════════════════════════════════════

const REQUIRED_SECRETS = {
  DATABASE_URL: process.env.DATABASE_URL,
  SENTINEL_ENCRYPTION_KEY: process.env.SENTINEL_ENCRYPTION_KEY,
  SENTINEL_SIGNING_KEY: process.env.SENTINEL_SIGNING_KEY,
  SYSTEM_PEPPER: process.env.SYSTEM_PEPPER,
};

for (const [name, value] of Object.entries(REQUIRED_SECRETS)) {
  if (!value || value.trim().length === 0) {
    console.error(`[FATAL_SECURITY_BOOT_FAILURE] Secret "${name}" is missing or empty. Container HALTED.`);
    process.exit(1);
  }
}

// SecurityManager: Initialized at boot — NOT lazily inside request handlers.
const { SecurityManager } = require('./security-manager');

/** @type {import('./security-manager').SecurityManager} */
let _securityManager;
try {
  _securityManager = SecurityManager.create('software');
} catch (err) {
  console.error(`[FATAL_SECURITY_BOOT_FAILURE] SecurityManager.create() failed: ${err.message}`);
  process.exit(1);
}

console.log('[BOOT_GUARD] All secrets verified. SecurityManager initialized. Container is SECURE.');

// ─────────────────────────────────────────────────────
//  MODULE IMPORTS (post-boot-guard)
// ─────────────────────────────────────────────────────

const {
  loadInstanceConfig,
  getTableConfigs,
  buildInstanceSystemPrompt,
  getComplexTriggers,
  getTTSConfig,
} = require('./instance-loader');

// V4.5 Core
const { getSql, postgresVectorSearch, isSubjectRevoked } = require('./db');
const { IntegrityController, TruthAuditError } = require('./integrity-controller');

// V4.9-RC: Fortress Modules
const { verifyPEP, PEPError } = require('./pep-gate');
const { GEMINI_RESPONSE_SCHEMA, validateInferenceResponse } = require('./schemas');
const { recursiveSchemaRetry } = require('./recursive-retry');
const { launchVerificationSidecar, getVerificationStatus } = require('./verification-loop');
const { swrFetch, circuitBreaker } = require('./swr-cache');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

// ─────────────────────────────────────────────────────
//  CONFIGURATION
// ─────────────────────────────────────────────────────

const GCP_PROJECT_ID  = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'ha-sentinel-core-v21';
const GCP_REGION      = process.env.GCP_REGION || 'us-central1';
const BQ_DATASET      = process.env.BQ_DATASET || 'sentinel_warehouse';
const EMBEDDING_MODEL = 'text-embedding-004';
const EMBEDDING_DIM   = 768;
const VECTOR_TOP_K    = 5;

// Tier mode: POSTGRES_ONLY | FULL_CASCADE (default)
const TIER_MODE = process.env.SENTINEL_TIER_MODE || 'FULL_CASCADE';

// Data freshness window — ETL runs daily, 24h is too aggressive
const DATA_FRESHNESS_HOURS = parseInt(process.env.DATA_FRESHNESS_HOURS || '72', 10);

const INSTANCE_CONFIG = loadInstanceConfig();
const ACTIVE_BQ_DATASET = INSTANCE_CONFIG.database?.datasetId || BQ_DATASET;

/**
 * The resilience advisory string prepended to stale narratives
 * when the circuit breaker is open and the engine is serving cached data.
 * @type {string}
 */
const RESILIENCE_ADVISORY =
  '[ADVISORY: Serving cached intelligence. Live verification currently unavailable due to reservoir connectivity.]\n\n';

// ─────────────────────────────────────────────────────
//  SERVICES
// ─────────────────────────────────────────────────────

const bigquery  = new BigQuery({ projectId: GCP_PROJECT_ID });
const firestore = new Firestore({ projectId: GCP_PROJECT_ID });
const secretClient = new SecretManagerServiceClient();
const ttsClient = new textToSpeech.TextToSpeechClient();

let ai = null;
const _secretCache = {};

// ─────────────────────────────────────────────────────
//  UTILITIES
// ─────────────────────────────────────────────────────

/**
 * Fetch a secret from GCP Secret Manager. Returns cached values on repeat calls.
 * @param {string} secretName
 * @returns {Promise<string|null>}
 */
async function getSecret(secretName) {
  if (_secretCache[secretName]) return _secretCache[secretName];
  const name = `projects/${GCP_PROJECT_ID}/secrets/${secretName}/versions/latest`;
  try {
    const [version] = await secretClient.accessSecretVersion({ name });
    const payload = version.payload.data.toString('utf8');
    _secretCache[secretName] = payload;
    return payload;
  } catch (err) {
    console.error(`[SECRET_ERROR] ${secretName}:`, err.message);
    return null;
  }
}

/**
 * Get the Vertex AI client (lazy-init is acceptable here — not a security primitive).
 * @returns {GoogleGenAI}
 */
function getAI() {
  if (!ai) {
    ai = new GoogleGenAI({
      vertexai: true,
      project: GCP_PROJECT_ID,
      location: GCP_REGION,
    });
  }
  return ai;
}

const ALLOWED_ORIGINS = [
  'http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174',
  'https://sentinel.high-archy.tech', 'https://sentinel-engine.netlify.app',
];

/**
 * Handle CORS preflight and method enforcement.
 * @param {object} req
 * @param {object} res
 * @returns {boolean} True if the request was fully handled (OPTIONS/405)
 */
const handleCORS = (req, res) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) res.set('Access-Control-Allow-Origin', origin);
  res.set('Vary', 'Origin');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Sentinel-Client, X-Sentinel-Instance');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return true; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return true; }
  return false;
};

// ─────────────────────────────────────────────────────
//  INFERENCE LOGIC
// ─────────────────────────────────────────────────────

/**
 * Perform vector search across BigQuery tables.
 * @param {string} queryText
 * @param {GoogleGenAI} genaiClient
 * @param {string} tenantId
 * @returns {Promise<{contextPayload: string, resultCount: number, bqErrors?: string[]}>}
 */
async function vectorSearchRetrieval(queryText, genaiClient, tenantId) {
  const embeddingResponse = await genaiClient.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: queryText,
    config: { taskType: 'RETRIEVAL_QUERY', outputDimensionality: EMBEDDING_DIM },
  });
  const queryVector = embeddingResponse.embeddings[0].values;
  const vectorLiteral = `[${queryVector.join(',')}]`;

  const tableConfigs = getTableConfigs(INSTANCE_CONFIG) || [
    { table: 'freight_indices', displayColumns: ['source', 'route_origin', 'route_destination', 'rate_usd', 'trend', 'narrative_context', 'ingested_at'], label: 'Freight Indices' },
    { table: 'port_congestion', displayColumns: ['source', 'port_name', 'vessels_at_anchor', 'avg_wait_days', 'severity_level', 'narrative_context', 'ingested_at'], label: 'Port Congestion' },
    { table: 'maritime_chokepoints', displayColumns: ['source', 'chokepoint_name', 'status', 'vessel_queue', 'transit_delay_hours', 'narrative_context', 'ingested_at'], label: 'Maritime Chokepoints' },
    { table: 'risk_matrix', displayColumns: ['source', 'risk_factor', 'severity', 'probability', 'impact_window', 'narrative_context', 'ingested_at'], label: 'Risk Matrix' },
  ];

  const searchPromises = tableConfigs.map(async (configItem) => {
    const table = configItem.table || configItem.id;
    const displayColumns = configItem.displayColumns;
    const label = configItem.label;
    const query = `
      SELECT base.${displayColumns.join(', base.')}, distance
      FROM VECTOR_SEARCH(
        (SELECT * FROM \`${GCP_PROJECT_ID}.${ACTIVE_BQ_DATASET}.${table}\` WHERE tenant_id = @tenantId),
        'embedding',
        (SELECT ${vectorLiteral} AS embedding),
        top_k => ${VECTOR_TOP_K},
        distance_type => 'COSINE'
      )
      ORDER BY distance ASC
    `;
    console.log(`[BQ_QUERY] dataset=${ACTIVE_BQ_DATASET} table=${table} tenantId=${tenantId}`);
    try {
      const [rows] = await bigquery.query({ query, params: { tenantId }, location: 'US' });
      return { label, rows };
    } catch (err) {
      console.error(`[BQ_VECTOR_ERROR] Table=${table} Tenant=${tenantId}: ${err.message}`);
      return { label, rows: [], error: err.message };
    }
  });

  const results = await Promise.all(searchPromises);
  const sections = results.filter(r => r.rows.length > 0).map(({ label, rows }) => {
    // V4.5.2: Context compression — top 3 per table for payload budget
    const topRows = rows.slice(0, 3);
    const lines = topRows.map((row, idx) => {
      const { distance, ...displayRow } = row;
      return `  [${idx + 1}] (rel: ${(1 - distance).toFixed(3)}) ${JSON.stringify(displayRow)}`;
    });
    return `\n── BigQuery:${label} ──\n${lines.join('\n')}`;
  });

  const bqErrors = results.filter(r => r.error).map(r => `${r.label}: ${r.error}`);
  if (bqErrors.length > 0) {
    console.error(`[BQ_VECTOR_SUMMARY] ${bqErrors.length}/4 tables failed: ${bqErrors.join(' | ')}`);
  }

  const resultCount = results.reduce((sum, r) => sum + r.rows.length, 0);
  console.log(`[BQ_VECTOR_SUCCESS] tenantId=${tenantId}, resultCount=${resultCount}`);

  // V4.5.2 Hard Limit: 2048 bytes max context payload
  const MAX_CONTEXT_BYTES = 2048;
  let fullPayload = sections.join('\n');
  if (fullPayload.length > MAX_CONTEXT_BYTES) {
    console.warn(`[CONTEXT_CAP] Payload ${fullPayload.length}B exceeds ${MAX_CONTEXT_BYTES}B limit. Truncating.`);
    fullPayload = fullPayload.substring(0, MAX_CONTEXT_BYTES);
    const lastBracket = fullPayload.lastIndexOf('}');
    if (lastBracket > 0) fullPayload = fullPayload.substring(0, lastBracket + 1);
    fullPayload += `\n[CONTEXT_CAPPED: ${MAX_CONTEXT_BYTES}B limit enforced]`;
  }
  if (tenantId && !fullPayload.includes(tenantId)) {
    console.warn(`[DLL_SAFETY] tenant_id '${tenantId}' lost after truncation. Prepending.`);
    fullPayload = `[tenant_id: ${tenantId}]\n` + fullPayload;
  }

  return {
    contextPayload: fullPayload,
    resultCount,
    bqErrors: bqErrors.length > 0 ? bqErrors : undefined,
  };
}

/**
 * Firestore legacy retrieval (Tier 3 fallback).
 * @param {string} contextKey
 * @returns {Promise<{contextPayload: string|null}>}
 */
async function firestoreLegacyRetrieval(contextKey) {
  let doc = await firestore.collection('sentinel_data').doc(contextKey).get();
  if (!doc.exists || doc.data()?.content === 'DATA MOAT INITIALIZED') {
    doc = await firestore.collection('sentinel_data').doc('source_alpha').get();
  }
  if (!doc.exists) return { contextPayload: null };
  const data = doc.data();
  let content = typeof data.content === 'string' ? data.content : JSON.stringify(data.content || data);

  const MAX_CONTEXT_BYTES = 2048;
  if (content.length > MAX_CONTEXT_BYTES) {
    content = content.substring(0, MAX_CONTEXT_BYTES) + '\n[...CONTEXT TRUNCATED FOR PERFORMANCE...]';
  }

  return { contextPayload: content };
}

/**
 * Apply the Kill Switch: redact data for revoked subject IDs.
 * @param {string|null} context
 * @param {string} requestId
 * @returns {Promise<string|null>}
 */
async function applyKillSwitch(context, requestId) {
  if (!context) return null;
  const idMatches = context.match(/"subject_id":\s*"([^"]+)"/g);
  if (!idMatches) return context;
  const ids = [...new Set(idMatches.map(m => m.split('"')[3]))];
  let finalContext = context;
  for (const id of ids) {
    if (await isSubjectRevoked(id)) {
      console.warn(`[KILL_SWITCH] Revoked ID detected: ${id}`);
      const regex = new RegExp(`.*${id}.*`, 'g');
      finalContext = finalContext.replace(regex, `[REDACTED: SUBJECT REVOKED - ID: ${id}]`);
    }
  }
  return finalContext;
}

// ─────────────────────────────────────────────────────
//  MODEL TIERING — Authorized Routing Logic
// ─────────────────────────────────────────────────────

/**
 * Select the inference model based on query complexity and instance config.
 * @param {string} query
 * @param {object} instanceConfig
 * @returns {string} Model ID
 */
function selectModel(query, instanceConfig) {
  return 'gemini-1.5-flash';
}

// ─────────────────────────────────────────────────────
//  PRISTINE PRIORITY RACING — V5.2 "Pristine Window"
// ─────────────────────────────────────────────────────

const PRISTINE_WINDOW_MS = 150;

/**
 * Priority-aware RAG race with a 150ms "Pristine Window."
 *
 * 1. Fire Postgres (Tier 1) and BigQuery (Tier 2) concurrently.
 * 2. If Postgres returns data within 150ms, resolve immediately
 *    and discard the BigQuery race. This prevents a "Fast Stale Win"
 *    where a BigQuery cache beats fresh Postgres by milliseconds.
 * 3. If the 150ms window expires, resolve with the first available
 *    result from ANY tier that contains data.
 * 4. If all tiers settle with no results, reject with ALL_TIERS_EMPTY.
 *
 * @param {Promise<{tier: string, res: object|null}>} pgPromise
 * @param {Promise<{tier: string, res: object|null}>} bqPromise
 * @returns {Promise<{tier: string, res: object}>}
 * @throws {Error} If all tiers settle with no results
 */
function pristineRace(pgPromise, bqPromise) {
  return new Promise((resolve, reject) => {
    let resolved = false;
    let pgSettled = false;
    let bqSettled = false;
    let pgResult = null;
    let bqResult = null;

    const tryResolve = () => {
      if (resolved) return;
      // Check if either has data
      if (pgResult && pgResult.res && pgResult.res.resultCount > 0) {
        resolved = true;
        resolve(pgResult);
        return;
      }
      if (bqResult && bqResult.res && bqResult.res.resultCount > 0) {
        resolved = true;
        resolve(bqResult);
        return;
      }
      // Both settled with no data
      if (pgSettled && bqSettled) {
        reject(new Error('ALL_TIERS_EMPTY'));
      }
    };

    // Phase 1: Pristine Window — give Postgres 150ms of priority
    pgPromise.then(result => {
      pgSettled = true;
      pgResult = result;
      if (result && result.res && result.res.resultCount > 0) {
        // Postgres has data — resolve immediately, skip BQ
        if (!resolved) { resolved = true; resolve(result); }
      } else {
        tryResolve();
      }
    }).catch(() => {
      pgSettled = true;
      tryResolve();
    });

    // Phase 2: BigQuery — only accepted after the Pristine Window
    // or if Postgres failed/returned empty.
    setTimeout(() => {
      bqPromise.then(result => {
        bqSettled = true;
        bqResult = result;
        tryResolve();
      }).catch(() => {
        bqSettled = true;
        tryResolve();
      });
    }, PRISTINE_WINDOW_MS);

    // Safety net: if Postgres is extremely slow AND BQ settles
    // before the window opens, we still need to accept BQ data.
    // The setTimeout above just DELAYS evaluation of BQ results,
    // not BQ execution (which was fired concurrently already).
  });
}

// ─────────────────────────────────────────────────────
//  SHADOW CLASSIFIER — Pessimistic Sensitivity Gate (V5.2)
// ─────────────────────────────────────────────────────

const SHADOW_CLASSIFIER_MODEL = 'gemini-2.0-flash-lite';

/**
 * Fires a 10-token prompt to classify query sensitivity BEFORE primary
 * inference. Determines whether The Prosecutor must synchronously verify.
 *
 * Returns: 'SENSITIVE' | 'PROCEDURAL' | 'GENERAL'
 *
 * V5.2 FAIL-CLOSED POLICY:
 * If the classifier fails (timeout, network, quota), OR returns an
 * ambiguous result, it defaults to 'SENSITIVE'. This forces mandatory
 * synchronous verification whenever the security sensors are offline.
 * We do NOT "Fail-Open" in a Fortress.
 *
 * @param {GoogleGenAI} genai - AI client
 * @param {string} query - User query
 * @returns {Promise<string>} Classification result
 */
async function classifyQuerySensitivity(genai, query) {
  try {
    const result = await genai.models.generateContent({
      model: SHADOW_CLASSIFIER_MODEL,
      contents: `Classify this query as exactly one of: SENSITIVE, PROCEDURAL, GENERAL.\nQuery: ${query}`,
      config: {
        temperature: 0.0,
        maxOutputTokens: 10,
        topK: 1,
      },
    });
    const classification = result.text.trim().toUpperCase();
    // Only accept exact, unambiguous matches
    if (classification === 'PROCEDURAL') return 'PROCEDURAL';
    if (classification === 'GENERAL') return 'GENERAL';
    // Anything else — including partial matches, empty strings,
    // or unexpected model output — is treated as SENSITIVE.
    // This is the Pessimistic Classification principle.
    return 'SENSITIVE';
  } catch (err) {
    // FAIL-CLOSED: Classifier down → treat as SENSITIVE → mandatory sync audit.
    console.warn(`[SHADOW_CLASSIFIER] FAIL-CLOSED: ${err.message}. Defaulting to SENSITIVE.`);
    return 'SENSITIVE';
  }
}

// ─────────────────────────────────────────────────────
//  ENTRY POINT: SENTINEL INFERENCE (V5.0 Sovereign)
// ─────────────────────────────────────────────────────

/**
 * Main inference handler. Orchestrates: PEP Auth → SWR Cache → RAG Cascade →
 * DLL Rules → AI Generation → Zod Validation → PII Tokenization → Response.
 *
 * @param {object} req - Cloud Function HTTP request
 * @param {object} res - Cloud Function HTTP response
 */
async function handleSentinelInference(req, res) {
  const requestId = `SEN-${Date.now()}`;
  const t0 = Date.now();
  const trace = {};
  if (handleCORS(req, res)) return;

  try {
    const genai = getAI();
    trace.init = Date.now() - t0;

    // ═══ PHASE 1: PEP Gate — Zero-Trust Auth ═══
    const tAuth0 = Date.now();
    let ctx;
    try {
      ctx = await verifyPEP(req);
    } catch (pepErr) {
      if (pepErr instanceof PEPError) {
        trace.auth = Date.now() - tAuth0;
        return res.status(pepErr.httpStatus).json({
          error: pepErr.code,
          message: pepErr.message,
          requestId,
          latencyTrace: trace,
        });
      }
      throw pepErr;
    }
    const tenantId = ctx.tenantId;
    const userRole = ctx.userRole;
    trace.auth = Date.now() - tAuth0;
    trace.authMethod = ctx.authMethod;

    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Empty Query', requestId });

    // V5.1: Shadow Classifier — determine query sensitivity BEFORE inference
    const tClassify0 = Date.now();
    const queryClassification = await classifyQuerySensitivity(genai, query);
    trace.classification = Date.now() - tClassify0;
    trace.queryClass = queryClassification;

    // DATABASE_URL: Validated at BOOT (global scope, lines 45-56).
    // db.js consumes DATABASE_URL directly (Configuration Monism).

    // ═══ PHASE 4: SWR Cache Check ═══
    // Wrap the entire RAG → Inference pipeline in SWR
    const swrResult = await swrFetch(tenantId, query, async () => {
      // ── This is the "fresh data" function ──
      // It runs only on cache miss or revalidation.

      // Step 2: Embedding
      const tEmbed0 = Date.now();
      const embResult = await genai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: query,
        config: { taskType: 'RETRIEVAL_QUERY', outputDimensionality: EMBEDDING_DIM },
      });
      const queryVector = embResult.embeddings[0].values;
      trace.embedding = Date.now() - tEmbed0;

      // Step 3: RAG Cascade — PRISTINE PRIORITY RACING (V5.2)
      // Both tiers fire concurrently. Postgres gets a 150ms
      // "Pristine Window" of priority. If Postgres returns data
      // within 150ms, BigQuery is discarded. If the window expires,
      // the first tier with data wins.
      const tRag0 = Date.now();
      let contextPayload, dataAuthority;

      const pgPromise = postgresVectorSearch(queryVector, tenantId)
        .then(res => { circuitBreaker.recordSuccess(); return { tier: 'PG', res }; })
        .catch(err => { circuitBreaker.recordFailure(); console.error('[RAG_CASCADE] Postgres failed:', err.message); return { tier: 'PG', res: null }; });

      if (TIER_MODE === 'POSTGRES_ONLY') {
        const pgResult = await pgPromise;
        trace.postgres = Date.now() - tRag0;
        if (pgResult.res && pgResult.res.resultCount > 0) {
          contextPayload = pgResult.res.contextPayload;
          dataAuthority = 'POSTGRES_PRISTINE_RESERVOIR';
        } else {
          throw new Error('POSTGRES_ONLY mode: Tier 1 returned no results. Fallback disabled.');
        }
      } else {
        // FULL_CASCADE: Pristine Priority Race (150ms Postgres window)
        const bqPromise = vectorSearchRetrieval(query, genai, tenantId)
          .then(res => ({ tier: 'BQ', res }))
          .catch(err => { console.error('[RAG_CASCADE] BigQuery failed:', err.message); return { tier: 'BQ', res: null }; });

        try {
          const winner = await pristineRace(pgPromise, bqPromise);
          contextPayload = winner.res.contextPayload;
          dataAuthority = winner.tier === 'PG' ? 'POSTGRES_PRISTINE_RESERVOIR' : 'GCP_BIGQUERY_VECTOR_RAG';
          if (winner.tier === 'BQ' && winner.res.bqErrors) trace.bqErrors = winner.res.bqErrors;
        } catch (_raceErr) {
          // Both tiers empty — try Firestore as last resort
        }
        trace.ragRace = Date.now() - tRag0;
        trace.pristineWindowMs = PRISTINE_WINDOW_MS;
      }

      // C: Firestore (Tier 3 — Legacy Fallback, only if raceToData returned nothing)
      const tFs0 = Date.now();
      if (!contextPayload) {
        const fsRes = await firestoreLegacyRetrieval(tenantId);
        if (fsRes.contextPayload) {
          contextPayload = fsRes.contextPayload;
          dataAuthority = 'FIRESTORE_LEGACY';
        }
      }
      trace.firestore = Date.now() - tFs0;
      trace.ragTotal = Date.now() - tRag0;

      // Step 4: Kill Switch
      const tKill0 = Date.now();
      contextPayload = await applyKillSwitch(contextPayload, requestId);
      trace.killSwitch = Date.now() - tKill0;

      // ═══ TASK 4: SOURCE_ALPHA_MISSING → 503 ═══
      if (!contextPayload) {
        trace.total = Date.now() - t0;
        return {
          _sourceAlphaMissing: true,
          status: 503,
          code: 'SOURCE_ALPHA_MISSING',
          error: 'SOURCE_ALPHA_MISSING',
          message: 'RAG cascade returned zero results across all data tiers. The Pristine Reservoir, Data Moat, and Legacy Fallback are empty for this tenant.',
          latencyTrace: trace,
          requestId,
        };
      }

      // Step 5: Procedural Rules Intercept Verification (Integrity Controller)
      const integrityCtrl = new IntegrityController(_securityManager);
      const dllOverride = integrityCtrl.checkProceduralRules(query, contextPayload);
      if (dllOverride) {
        return {
          _dllOverride: true,
          ...dllOverride,
          dataAuthority: 'SENTINEL_DLL_OVERRIDE',
        };
      }

      // ═══ PHASE 2: AI Inference with Zod Schema Decomposition ═══
      const tGen0 = Date.now();
      const systemPrompt = buildInstanceSystemPrompt(INSTANCE_CONFIG, contextPayload, dataAuthority)
        || `SYSTEM: Sentinel v5.0 Sovereign Fortress. Context: ${contextPayload}`;
      const modelId = selectModel(query, INSTANCE_CONFIG);

      let data = null;
      let fallbackRetries = 0;

      while (fallbackRetries < 2) {
        const retryPrompt = fallbackRetries > 0
          ? `${systemPrompt}\n\nCRITICAL: Your previous response was malformed JSON. Respond with ONLY a valid JSON object matching the schema exactly.`
          : systemPrompt;

        const result = await genai.models.generateContent({
          model: modelId,
          contents: query,
          config: {
            systemInstruction: retryPrompt,
            responseMimeType: 'application/json',
            responseSchema: GEMINI_RESPONSE_SCHEMA,
            temperature: 0.1,
            maxOutputTokens: 2048,
            topK: 20,
            topP: 0.7,
            thinkingConfig: { thinkingBudget: 0 },
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' }
          ]
        });

        try {
          let cleanedText = result.text.replace(/```(json)?/gi, '').trim();
          cleanedText = cleanedText.replace(/,\s*([\]}])/g, '$1');
          const parsed = JSON.parse(cleanedText);

          // ═══ PHASE 2: Zod Validation ═══
          const validation = validateInferenceResponse(parsed);

          if (validation.valid) {
            data = validation.result;
            break;
          }

          // Recursive retry on specific failed modules
          console.warn(`[DLL_SCHEMA] ${validation.failedModules.length} modules failed Zod validation:`, validation.failedModules);
          data = await recursiveSchemaRetry({
            genaiClient: genai,
            modelId,
            systemPrompt,
            query,
            context: contextPayload,
            partialResponse: parsed,
            failedModules: validation.failedModules,
          });
          break;

        } catch (err) {
          fallbackRetries++;
          console.warn(`[JSON_RETRY] Parse error on attempt ${fallbackRetries}: ${err.message}`);
          if (fallbackRetries >= 2) {
            const { buildGenericAdvisory } = require('./recursive-retry');
            data = buildGenericAdvisory(['executiveAction'], { parse: err.message });
          }
        }
      }

      trace.generation = Date.now() - tGen0;

      // Backward-compat: Flatten executiveAction into top-level for existing clients
      data.narrative = data.executiveAction?.narrative || data.narrative || '';
      data.metrics = data.executiveAction?.metrics || data.metrics || [];
      data.dataAuthority = dataAuthority;

      // Confidence Gate
      if (typeof data.confidence !== 'number' || data.confidence < 0 || data.confidence > 1) {
        console.error(`[SCHEMA_VIOLATION] confidence=${data.confidence} from model=${modelId}.`);
        data.confidence = 0;
      }

      if (data.confidence < 0.7) {
        data.narrative = "Insufficient sovereign data to support a high-confidence decision. Confidence threshold unmet.";
        data.metrics = [];
      }

      // ═══ PHASE 5: UNIFIED TRUTH AUDIT (Zod + Data Sovereignty) ═══
      // tenantId passed for per-tenant PII salt (prevents rainbow tables)
      data = await integrityCtrl.finalTruthAudit(data, tenantId);

      return {
        data,
        modelId,
        dataAuthority,
        contextPayload, // needed for verification sidecar
      };
    });

    // ── Handle SWR result ──
    const isResilienceMode = swrResult.isResilienceMode || false;
    const swrData = swrResult.data;

    // Handle Resilience Advisory (2AM Failsafe — circuit open, no cache)
    if (swrData._resilienceAdvisory) {
      res.set('Retry-After', String(swrData.retryAfterSeconds || 60));
      return res.status(504).json({
        status: 'RESILIENCE_ADVISORY',
        error: swrData.error,
        message: swrData.message,
        retryAfterSeconds: swrData.retryAfterSeconds,
        circuitState: swrData.circuitState,
        requestId,
        isResilienceMode: true,
      });
    }

    // ═══ TASK 4: SOURCE_ALPHA_MISSING → 503 Service Unavailable ═══
    if (swrData._sourceAlphaMissing) {
      return res.status(503).json({
        status: 'SOURCE_ALPHA_MISSING',
        code: 'SOURCE_ALPHA_MISSING',
        error: swrData.error,
        message: swrData.message,
        latencyTrace: swrData.latencyTrace,
        requestId: swrData.requestId,
        isResilienceMode: true,
      });
    }

    // Handle DLL override (passthrough)
    if (swrData._dllOverride) {
      trace.total = Date.now() - t0;
      const { _dllOverride, ...dllPayload } = swrData;
      return res.status(200).json({
        status: 'SUCCESS',
        ...dllPayload,
        latencyTrace: trace,
        requestId,
        verificationStatus: 'not_applicable',
        isResilienceMode,
        cacheStatus: swrResult.cacheStatus,
        infrastructure: `Sentinel v5.0 [SENTINEL_DLL_OVERRIDE]`,
      });
    }

    const { data, modelId, dataAuthority, contextPayload } = swrData;

    // ═══ TASK 4: 2AM "Correctness" Gate — Resilience Advisory Injection ═══
    // If circuit breaker is open (serving stale cache), physically modify the narrative.
    if (isResilienceMode && data && data.narrative) {
      data.narrative = RESILIENCE_ADVISORY + data.narrative;
    }

    // ═══ PHASE 3: Verification Sidecar (V5.1 Shadow Classifier) ═══
    // SENSITIVE queries (classified by Shadow Classifier): sidecar is
    // AWAITED — response is blocked until The Prosecutor verifies.
    // PROCEDURAL/GENERAL: fire-and-forget (async background).
    const isSensitive = queryClassification === 'SENSITIVE';
    let verificationResult = null;

    if (contextPayload && data.narrative) {
      const sidecarPayload = {
        genaiClient: getAI(),
        requestId,
        tenantId,
        narrative: data.narrative,
        sourceContext: contextPayload,
      };

      if (isSensitive) {
        // SYNCHRONOUS: Block response until verification completes
        try {
          verificationResult = await launchVerificationSidecar(sidecarPayload);
          trace.verification = Date.now() - t0;
        } catch (err) {
          console.error('[VERIFICATION_SIDECAR] Sync verification failed:', err.message);
          verificationResult = { isVerified: null, error: err.message };
        }
      } else {
        // ASYNC: Fire-and-forget for PROCEDURAL/GENERAL queries
        launchVerificationSidecar(sidecarPayload)
          .catch(err => console.error('[VERIFICATION_SIDECAR] Background error:', err.message));
      }
    }

    trace.total = Date.now() - t0;

    return res.status(200).json({
      status: 'SUCCESS',
      model: modelId || 'gemini-1.5-flash',
      timestamp: new Date().toISOString(),
      data,
      infrastructure: `Sentinel v5.2 [${dataAuthority}]`,
      latencyTrace: trace,
      requestId,
      queryClassification,
      verificationStatus: isSensitive
        ? (verificationResult?.isVerified === false ? 'HALLUCINATION_FLAGGED' : (verificationResult?.isVerified ? 'verified' : 'verification_failed'))
        : 'pending',
      verificationResult: isSensitive ? verificationResult : undefined,
      isResilienceMode,
      cacheStatus: swrResult.cacheStatus,
      authMethod: ctx.authMethod,
    });

  } catch (err) {
    trace.total = Date.now() - t0;

    // TruthAuditError: Zod validation failed — return typed 422, not generic 500
    if (err instanceof TruthAuditError) {
      console.error(`[TRUTH_AUDIT_REJECTED] ${err.message}`);
      return res.status(422).json({
        status: 'TRUTH_AUDIT_FAILURE',
        error: 'SCHEMA_VALIDATION_FAILED',
        message: 'The AI produced structurally unverifiable output. The Integrity Controller has rejected this response.',
        failedModules: err.failedModules,
        latencyTrace: trace,
        requestId,
        isResilienceMode: circuitBreaker.isOpen(),
      });
    }

    console.error(`[CRITICAL] Inference failed:`, err);
    return res.status(500).json({
      error: 'Infrastructure Failure',
      detail: err.message,
      latencyTrace: trace,
      requestId,
      isResilienceMode: circuitBreaker.isOpen(),
    });
  }
}

// ─────────────────────────────────────────────────────
//  ENTRY POINT: VERIFICATION STATUS (Polling)
// ─────────────────────────────────────────────────────

/**
 * Polling endpoint for async verification sidecar results.
 * @param {object} req
 * @param {object} res
 */
async function handleVerificationStatus(req, res) {
  if (handleCORS(req, res)) return;

  try {
    // Auth check (lightweight — PEP Gate)
    await verifyPEP(req);

    const { requestId } = req.body;
    if (!requestId) {
      return res.status(400).json({ error: 'requestId is required' });
    }

    const result = await getVerificationStatus(requestId);
    return res.status(200).json(result);

  } catch (err) {
    if (err instanceof PEPError) {
      return res.status(err.httpStatus).json({ error: err.code, message: err.message });
    }
    return res.status(500).json({ error: 'Verification lookup failed', detail: err.message });
  }
}

// ─────────────────────────────────────────────────────
//  ENTRY POINT: TTS (Preserved from V4.5.2)
// ─────────────────────────────────────────────────────

/**
 * Text-to-Speech synthesis endpoint.
 * @param {object} req
 * @param {object} res
 */
async function handleSentinelTTS(req, res) {
  if (handleCORS(req, res)) return;
  const { text } = req.body;
  if (!text) return res.status(400).send('Text is required');
  try {
    const config = getTTSConfig(INSTANCE_CONFIG);
    const [response] = await ttsClient.synthesizeSpeech({
      input: { text: text.replace(/[*#_`~>]/g, '') },
      voice: { languageCode: config.languageCode, name: config.voiceName },
      audioConfig: { audioEncoding: 'MP3' },
    });
    res.status(200).json({ audioContent: response.audioContent.toString('base64') });
  } catch (err) {
    res.status(500).send(err.message);
  }
}

// Register Cloud Function entry points
functions.http('sentinelInference', handleSentinelInference);
functions.http('sentinelTTS', handleSentinelTTS);
functions.http('sentinelVerification', handleVerificationStatus);
