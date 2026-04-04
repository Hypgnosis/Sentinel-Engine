/**
 * SENTINEL ENGINE — CORE INFRASTRUCTURE (v4.1 Production)
 * ═══════════════════════════════════════════════════════════
 * Google Cloud Function (Node.js 20+) — Gen2
 * 
 * Inference: Google Gen AI (Gemini 2.0 Flash) — Structured JSON Output
 * Context:   BigQuery VECTOR_SEARCH (sentinel_warehouse) — RAG Pipeline
 * Fallback:  Cloud Firestore (sentinel_data) — Legacy compat
 * Embeddings: Vertex AI text-embedding-004 (768 dim)
 * Security:  Zero-Trust CORS, JWT + tenant_id, Rate Limiting
 * Secrets:   Google Cloud Secret Manager (runtime fetch)
 * 
 * Propiedad de High ArchyTech Solutions.
 * Arquitectura diseñada para: ReshapeX, Fracttal, DHL, Maersk.
 * ═══════════════════════════════════════════════════════════
 */

const functions = require('@google-cloud/functions-framework');
const { GoogleGenAI } = require('@google/genai');
const { BigQuery } = require('@google-cloud/bigquery');
const { Firestore } = require('@google-cloud/firestore');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const admin = require('firebase-admin');

// Initialize once at cold-start. Uses Application Default Credentials
// inside Cloud Functions (no key file needed). Safe to call repeatedly —
// the guard prevents duplicate-app errors on warm instances.
if (!admin.apps.length) {
  admin.initializeApp();
}

// ─────────────────────────────────────────────────────
//  CONFIGURATION
// ─────────────────────────────────────────────────────

const GCP_PROJECT_ID  = 'ha-sentinel-core-v21';
const GCP_REGION      = process.env.GCP_REGION || 'us-central1';
const BQ_DATASET      = process.env.BQ_DATASET || 'sentinel_warehouse';
const EMBEDDING_MODEL = 'text-embedding-004';
const EMBEDDING_DIM   = 768;
const VECTOR_TOP_K    = 15;  // Top-K results from each VECTOR_SEARCH

// ─────────────────────────────────────────────────────
//  SECRET MANAGER — Runtime Secret Fetching
// ─────────────────────────────────────────────────────

const secretClient = new SecretManagerServiceClient();

/**
 * Singleton cache for secrets — fetched once at cold-start, reused
 * across warm invocations. No process.env for sensitive keys.
 */
const _secretCache = {};

/**
 * Fetches a secret from Google Cloud Secret Manager.
 * Caches the result in-memory for the lifetime of the instance.
 *
 * @param {string} secretName - e.g. 'GEMINI_API_KEY'
 * @returns {Promise<string>} The secret value (UTF-8 string)
 */
async function getSecret(secretName) {
  if (_secretCache[secretName]) {
    return _secretCache[secretName];
  }

  const name = `projects/${GCP_PROJECT_ID}/secrets/${secretName}/versions/latest`;

  try {
    const [version] = await secretClient.accessSecretVersion({ name });
    const payload = version.payload.data.toString('utf8');
    _secretCache[secretName] = payload;

    console.log(JSON.stringify({
      severity: 'INFO',
      event: 'SECRET_MANAGER_FETCH_SUCCESS',
      secret: secretName,
      timestamp: new Date().toISOString(),
    }));

    return payload;
  } catch (err) {
    console.error(JSON.stringify({
      severity: 'CRITICAL',
      event: 'SECRET_MANAGER_FETCH_FAILURE',
      secret: secretName,
      error: err.message,
      timestamp: new Date().toISOString(),
    }));
    throw new Error(`Failed to fetch secret '${secretName}': ${err.message}`);
  }
}

/**
 * Allowed CORS origins — Zero Trust.
 * Development: localhost:3000, localhost:5173
 * Production:  https://sentinel.high-archy.tech
 * Add client VPC domains as they onboard (e.g., DHL internal).
 */
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://sentinel.high-archy.tech',
  'https://sentinel-engine.netlify.app',
];

// ─────────────────────────────────────────────────────
//  SERVICE INITIALIZATION (Cold-start optimized)
// ─────────────────────────────────────────────────────

const bigquery  = new BigQuery({ projectId: GCP_PROJECT_ID });
const firestore = new Firestore({ projectId: GCP_PROJECT_ID });

let ai = null;

// ── In-Memory Global Caching & Throttling ──
const CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes
const vectorResultsCache = new Map(); // key: queryHash, value: { payload, timestamp }
const sourceAlphaCache   = new Map(); // key: contextKey, value: { payload, timestamp } (legacy)

const RATE_LIMIT_WINDOW_MS = 1000 * 10; // 10 seconds
const RATE_LIMIT_MAX_REQUESTS = 5;
const requestStamps = new Map(); // key: uid, value: [timestamps]

// ─────────────────────────────────────────────────────
//  STRUCTURED RESPONSE SCHEMA — Logistics Intelligence
// ─────────────────────────────────────────────────────

const LOGISTICS_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    narrative: {
      type: 'STRING',
      description: 'Markdown-formatted analysis with bullet points, metrics, and actionable recommendations.',
    },
    metrics: {
      type: 'ARRAY',
      description: 'Extracted key data points from the analysis.',
      items: {
        type: 'OBJECT',
        properties: {
          label: { type: 'STRING', description: 'Metric name (e.g., "Shanghai-Rotterdam Rate")' },
          value: { type: 'STRING', description: 'Metric value with units (e.g., "$2,340/FEU")' },
          trend: { type: 'STRING', description: 'Direction indicator: up, down, or stable' },
          confidence: { type: 'NUMBER', description: 'Confidence in this metric (0.0–1.0)' },
        },
        required: ['label', 'value'],
      },
    },
    confidence: {
      type: 'NUMBER',
      description: 'Overall confidence score for this response (0.0–1.0)',
    },
    sources: {
      type: 'ARRAY',
      description: 'Data sources used for this response.',
      items: { type: 'STRING' },
    },
    dataAuthority: {
      type: 'STRING',
      description: 'The data source that powered this response: GCP_BIGQUERY_VECTOR_RAG or FIRESTORE_LEGACY.',
    },
  },
  required: ['narrative', 'confidence', 'sources'],
};

// ─────────────────────────────────────────────────────
//  SYSTEM PROMPT — Sovereign Intelligence Persona (v4.1)
// ─────────────────────────────────────────────────────

const buildSystemPrompt = (contextPayload, dataAuthority) => `
SISTEMA: Sentinel Engine — Sovereign Intelligence Layer.
ESTADO: GCP-Native Infrastructure v4.1 (Data Moat Architecture).
ARQUITECTO: High ArchyTech Solutions.
DATA AUTHORITY: ${dataAuthority}

CONTEXTO OPERATIVO (DATOS ESTRUCTURADOS — VECTORIZED RETRIEVAL):
${contextPayload}

INSTRUCCIÓN:
Eres el núcleo de inferencia estratégica para una organización logística global de nivel enterprise.
Tu rol es eliminar la "Latencia de Decisión" — el tiempo perdido entre la disponibilidad de datos y la acción ejecutiva.

DIRECTIVAS:
1. Analiza patrones de congestión portuaria, volatilidad de fletes (spot y contractuales),
   y cuellos de botella operativos en cadenas de suministro globales.
2. Responde con datos concretos: cifras, porcentajes, tendencias, y benchmarks.
3. Si los datos disponibles no cubren la consulta, indícalo explícitamente.
   No inventes data points bajo ninguna circunstancia.
4. El campo "narrative" debe usar markdown con bullet points, métricas destacadas, y recomendaciones accionables.
5. El campo "metrics" debe extraer los KPIs más relevantes de tu análisis.
6. El campo "confidence" es tu grado de certeza (0.0–1.0) basado en la cobertura de datos.
7. El campo "sources" lista las fuentes de datos utilizadas.
8. El campo "dataAuthority" DEBE ser exactamente: "${dataAuthority}".
9. Tono: ejecutivo, técnico, directo. Cero ambigüedad. Cero redundancia.
10. Idioma: Responde en el mismo idioma de la consulta del usuario.

FORMATO DE SALIDA: JSON estricto siguiendo el schema proporcionado.
`;

// ─────────────────────────────────────────────────────
//  VECTOR_SEARCH — BigQuery RAG Retrieval (Tenant-Scoped)
// ─────────────────────────────────────────────────────

/**
 * Embed the user's query using Vertex AI text-embedding-004 (RETRIEVAL_QUERY),
 * then execute VECTOR_SEARCH across all four warehouse tables.
 * Returns the top-K semantically relevant rows as a JSON context block.
 * 
 * CRITICAL: All queries are scoped to the authenticated tenant_id to
 * enforce Row-Level Security at the application layer.
 *
 * @param {string} queryText - The user's natural language query
 * @param {object} genaiClient - Initialized GoogleGenAI client
 * @param {string} tenantId - The tenant_id from the verified JWT claim
 * @returns {Promise<{contextPayload: string, resultCount: number}>}
 */
async function vectorSearchRetrieval(queryText, genaiClient, tenantId) {
  // Step 1: Embed the user query
  const embeddingResponse = await genaiClient.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: queryText,
    config: {
      taskType: 'RETRIEVAL_QUERY',
      outputDimensionality: EMBEDDING_DIM,
    },
  });

  const queryVector = embeddingResponse.embeddings[0].values;
  const vectorLiteral = `[${queryVector.join(',')}]`;

  // Step 2: Run VECTOR_SEARCH on all four tables (parallel)
  // TENANT ISOLATION: Every query includes WHERE tenant_id = @tenantId
  const tableConfigs = [
    {
      table: 'freight_indices',
      displayColumns: ['source', 'route_origin', 'route_destination', 'rate_usd', 'week_over_week_change', 'trend', 'narrative_context', 'ingested_at'],
      label: 'Freight Indices',
    },
    {
      table: 'port_congestion',
      displayColumns: ['source', 'port_name', 'vessels_at_anchor', 'avg_wait_days', 'severity_level', 'narrative_context', 'ingested_at'],
      label: 'Port Congestion',
    },
    {
      table: 'maritime_chokepoints',
      displayColumns: ['source', 'chokepoint_name', 'status', 'vessel_queue', 'transit_delay_hours', 'narrative_context', 'ingested_at'],
      label: 'Maritime Chokepoints',
    },
    {
      table: 'risk_matrix',
      displayColumns: ['source', 'risk_factor', 'severity', 'probability', 'impact_window', 'narrative_context', 'ingested_at'],
      label: 'Risk Matrix',
    },
  ];

  const searchPromises = tableConfigs.map(async ({ table, displayColumns, label }) => {
    const query = `
      SELECT
        base.${displayColumns.join(', base.')},
        distance
      FROM VECTOR_SEARCH(
        (SELECT * FROM \`${GCP_PROJECT_ID}.${BQ_DATASET}.${table}\` WHERE tenant_id = @tenantId),
        'embedding',
        (SELECT ${vectorLiteral} AS embedding),
        top_k => ${VECTOR_TOP_K},
        distance_type => 'COSINE'
      )
      WHERE base.ingested_at > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
      ORDER BY distance ASC
    `;

    try {
      const [rows] = await bigquery.query({
        query,
        params: { tenantId },
        location: 'US',
      });
      return { label, rows, error: null };
    } catch (err) {
      // Table might not exist yet — graceful degradation
      return { label, rows: [], error: err.message };
    }
  });

  const results = await Promise.all(searchPromises);

  // Step 3: Assemble context payload from top-K results
  let totalResults = 0;
  const contextSections = [];

  for (const { label, rows, error } of results) {
    if (error) {
      contextSections.push(`\n── ${label} ── [ERROR: ${error}]`);
      continue;
    }
    if (rows.length === 0) continue;

    totalResults += rows.length;
    const sectionLines = rows.map((row, idx) => {
      // Remove the distance field from the display payload
      const { distance, ...displayRow } = row;
      return `  [${idx + 1}] (relevance: ${(1 - distance).toFixed(3)}) ${JSON.stringify(displayRow)}`;
    });

    contextSections.push(`\n── ${label} (${rows.length} results) ──\n${sectionLines.join('\n')}`);
  }

  const contextPayload = contextSections.length > 0
    ? contextSections.join('\n')
    : '';

  return { contextPayload, resultCount: totalResults };
}

// ─────────────────────────────────────────────────────
//  LEGACY FIRESTORE RETRIEVAL (Fallback)
// ─────────────────────────────────────────────────────

async function firestoreLegacyRetrieval(contextKey) {
  const nowMs = Date.now();

  if (sourceAlphaCache.has(contextKey) && (nowMs - sourceAlphaCache.get(contextKey).timestamp) < CACHE_TTL_MS) {
    return { contextPayload: sourceAlphaCache.get(contextKey).payload, cached: true };
  }

  const sourceAlphaRef = firestore.collection('sentinel_data').doc(contextKey);
  const doc = await sourceAlphaRef.get();

  if (!doc.exists) {
    return { contextPayload: null, cached: false };
  }

  const contextData = doc.data();
  const contextPayload = typeof contextData.content === 'string'
    ? contextData.content
    : JSON.stringify(contextData.content || contextData, null, 2);

  sourceAlphaCache.set(contextKey, { payload: contextPayload, timestamp: nowMs });
  return { contextPayload, cached: false };
}

// ─────────────────────────────────────────────────────
//  CORS HANDLER — Zero Trust Origin Validation
// ─────────────────────────────────────────────────────

const handleCORS = (req, res) => {
  // Dynamic origin check — only reflect origins in the explicit allowlist.
  // Rejects unknown origins by omitting the header entirely (browser blocks).
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  }
  res.set('Vary', 'Origin');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Sentinel-Client');
  
  // Preflight
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return true; // Signal: request handled
  }

  // Method guard
  if (req.method !== 'POST') {
    res.status(405).json({
      error: 'Method Not Allowed',
      code: 'SENTINEL_METHOD_DENIED',
      message: 'Only POST requests are accepted by the Sovereign Intelligence Layer.',
    });
    return true;
  }

  return false; // Signal: proceed to inference
};

// ─────────────────────────────────────────────────────
//  CLOUD FUNCTION ENTRY POINT
// ─────────────────────────────────────────────────────

functions.http('sentinelInference', async (req, res) => {
  const requestTimestamp = new Date().toISOString();

  const requestId = `SEN-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  // ── CORS & Method Gate ──
  if (handleCORS(req, res)) return;

  try {
    // ── Initialize AI client via Vertex AI ADC (no API key in env) ──
    if (!ai) {
      ai = new GoogleGenAI({ 
        vertexai: { 
          project: GCP_PROJECT_ID, 
          location: GCP_REGION 
        },
        project: GCP_PROJECT_ID,
        location: GCP_REGION
      });
    }

    // ── Authentication Gate ──
    // Verify Firebase ID token. Rejects expired, malformed, or revoked tokens.
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        code: 'SENTINEL_AUTH_MISSING',
        message: 'Authorization header with Bearer token is required.',
        requestId,
      });
    }

    let decodedToken;
    try {
      const idToken = authHeader.split('Bearer ')[1];
      decodedToken = await admin.auth().verifyIdToken(idToken, /* checkRevoked */ true);
    } catch (authError) {
      console.error(JSON.stringify({
        severity: 'WARNING',
        event: 'SENTINEL_AUTH_FAILURE',
        requestId,
        reason: authError.code || authError.message,
        timestamp: requestTimestamp,
      }));
      return res.status(401).json({
        error: 'Unauthorized',
        code: 'SENTINEL_AUTH_INVALID',
        message: 'Token verification failed. Token may be expired or revoked.',
        requestId,
      });
    }

    // ── Extract Payload ──
    const { query } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        code: 'SENTINEL_EMPTY_QUERY',
        message: 'The query field is required and must be a non-empty string.',
        requestId,
      });
    }

    // ── Data Sovereignty: Strict Tenant Authorization ──
    // The context key is derived EXCLUSIVELY from the verified JWT custom claim 'tenant_id'.
    // This claim is set server-side during client onboarding via Admin SDK.
    //
    // CRITICAL: We do NOT fall back to decodedToken.uid.
    // Without this gate, any random person who signs up to the Firebase project
    // can spam the Cloud Function — even if the doc 404s, it still generates
    // a billable Firestore read + CF invocation (Denial of Wallet).
    // Only onboarded tenants with an explicit tenant_id claim can proceed.
    const tenantId = decodedToken.tenant_id;
    if (!tenantId) {
      console.error(JSON.stringify({
        severity: 'WARNING',
        event: 'SENTINEL_TENANT_MISSING',
        requestId,
        uid: decodedToken.uid,
        message: 'Authenticated user lacks tenant_id custom claim. Access denied.',
        timestamp: requestTimestamp,
      }));
      return res.status(403).json({
        error: 'Forbidden',
        code: 'SENTINEL_TENANT_REQUIRED',
        message: 'Your account has not been provisioned for Sentinel Engine access. Contact your administrator.',
        requestId,
      });
    }
    const contextKey = tenantId;

    // ── Pre-execution: Layer 7 Rate Limiting ──
    const uid = decodedToken.uid;
    const nowMs = Date.now();
    const stamps = requestStamps.get(uid) || [];
    // Filter out timestamps older than the window
    const recentStamps = stamps.filter(t => nowMs - t < RATE_LIMIT_WINDOW_MS);

    if (recentStamps.length >= RATE_LIMIT_MAX_REQUESTS) {
      console.warn(JSON.stringify({
        severity: 'WARNING',
        event: 'SENTINEL_RATE_LIMITED',
        requestId,
        uid,
        message: `Rate limit exceeded (${RATE_LIMIT_MAX_REQUESTS} reqs / 10s)`,
        timestamp: requestTimestamp,
      }));
      return res.status(429).json({
        error: 'Too Many Requests',
        code: 'SENTINEL_RATE_LIMIT_EXCEEDED',
        message: 'You have exceeded the maximum number of requests. Please slow down.',
        requestId,
      });
    }

    recentStamps.push(nowMs);
    requestStamps.set(uid, recentStamps);

    // ── Structured Audit Log: Request Ingested ──
    console.log(JSON.stringify({
      severity: 'INFO',
      event: 'SENTINEL_REQUEST_INGESTED',
      requestId,
      uid: decodedToken.uid,
      tenantId,
      contextKey,
      queryLength: query.trim().length,
      timestamp: requestTimestamp,
    }));

    // ═══════════════════════════════════════════════════
    //  RAG CONTEXT RETRIEVAL — BigQuery VECTOR_SEARCH
    //  with automatic Firestore legacy fallback
    //  ALL QUERIES SCOPED TO tenant_id
    // ═══════════════════════════════════════════════════

    let contextPayload;
    let dataAuthority;

    // Primary path: BigQuery VECTOR_SEARCH (Production, Tenant-Scoped)
    try {
      console.log(JSON.stringify({
        severity: 'INFO',
        event: 'VECTOR_SEARCH_START',
        requestId,
        tenantId,
        queryPreview: query.trim().substring(0, 100),
        timestamp: new Date().toISOString(),
      }));

      const vectorResult = await vectorSearchRetrieval(query.trim(), ai, tenantId);

      if (vectorResult.resultCount > 0) {
        contextPayload = vectorResult.contextPayload;
        dataAuthority = 'GCP_BIGQUERY_VECTOR_RAG';

        console.log(JSON.stringify({
          severity: 'INFO',
          event: 'VECTOR_SEARCH_SUCCESS',
          requestId,
          tenantId,
          resultCount: vectorResult.resultCount,
          dataAuthority,
          timestamp: new Date().toISOString(),
        }));
      } else {
        // No results — BigQuery tables may be empty. Fall through to Firestore.
        console.log(JSON.stringify({
          severity: 'WARNING',
          event: 'VECTOR_SEARCH_EMPTY',
          requestId,
          tenantId,
          message: 'BigQuery VECTOR_SEARCH returned 0 results. Falling back to Firestore.',
          timestamp: new Date().toISOString(),
        }));
        contextPayload = null; // triggers fallback below
      }
    } catch (vectorError) {
      // BigQuery error (table not found, permissions, etc.) — degrade to Firestore
      console.error(JSON.stringify({
        severity: 'WARNING',
        event: 'VECTOR_SEARCH_FALLBACK',
        requestId,
        tenantId,
        error: vectorError.message,
        message: 'BigQuery VECTOR_SEARCH failed. Falling back to Firestore legacy path.',
        timestamp: new Date().toISOString(),
      }));
      contextPayload = null;
    }

    // Fallback path: Firestore legacy (if VECTOR_SEARCH unavailable)
    if (!contextPayload) {
      const firestoreResult = await firestoreLegacyRetrieval(contextKey);

      if (!firestoreResult.contextPayload) {
        console.error(JSON.stringify({
          severity: 'ERROR',
          event: 'SOURCE_ALPHA_NOT_FOUND',
          requestId,
          contextKey,
          tenantId,
          message: 'Both BigQuery VECTOR_SEARCH and Firestore legacy path failed. No context available.',
          timestamp: requestTimestamp,
        }));

        return res.status(503).json({
          error: 'Infrastructure Data Integrity Breach',
          code: 'SOURCE_ALPHA_MISSING',
          message: `No context data available. BigQuery warehouse may be unpopulated and Firestore document '${contextKey}' not found. Run the ETL pipeline.`,
          requestId,
        });
      }

      contextPayload = firestoreResult.contextPayload;
      dataAuthority = 'FIRESTORE_LEGACY';

      console.log(JSON.stringify({
        severity: 'INFO',
        event: 'FIRESTORE_LEGACY_ACTIVE',
        requestId,
        contextKey,
        tenantId,
        cached: firestoreResult.cached,
        dataAuthority,
        timestamp: new Date().toISOString(),
      }));
    }

    // ── Build Prompt & Execute Inference ──
    const systemPrompt = buildSystemPrompt(contextPayload, dataAuthority);

    // ── Execute Sovereign Inference (Structured JSON Output) ──
    const result = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: query.trim(),
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.1,
        maxOutputTokens: 4096,
        topP: 0.8,
        responseMimeType: 'application/json',
        responseSchema: LOGISTICS_RESPONSE_SCHEMA,
      },
    });

    // Parse the structured JSON response from Gemini
    let structuredResponse;
    try {
      structuredResponse = JSON.parse(result.text);
    } catch (parseError) {
      // Fallback: if Gemini returns non-JSON despite the schema constraint,
      // wrap the raw text in the expected structure.
      console.warn(JSON.stringify({
        severity: 'WARNING',
        event: 'SENTINEL_JSON_PARSE_FALLBACK',
        requestId,
        rawLength: result.text?.length || 0,
        timestamp: new Date().toISOString(),
      }));
      structuredResponse = {
        narrative: result.text || 'No response generated.',
        metrics: [],
        confidence: 0.5,
        sources: ['Sentinel Engine (unstructured fallback)'],
        dataAuthority,
      };
    }

    // Ensure dataAuthority is in the response
    structuredResponse.dataAuthority = dataAuthority;

    // ── Structured Audit Log: Inference Complete ──
    console.log(JSON.stringify({
      severity: 'INFO',
      event: 'SENTINEL_INFERENCE_COMPLETE',
      requestId,
      contextKey,
      tenantId,
      model: 'gemini-2.0-flash',
      dataAuthority,
      outputLength: result.text?.length || 0,
      confidence: structuredResponse.confidence,
      metricsCount: structuredResponse.metrics?.length || 0,
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - new Date(requestTimestamp).getTime(),
    }));

    // ── Success Response (Structured) ──
    return res.status(200).json({
      status: 'SUCCESS',
      model: 'gemini-2.0-flash',
      timestamp: new Date().toISOString(),
      data: structuredResponse,
      infrastructure: `Sentinel v4.1 — ${dataAuthority}`,
      requestId,
    });

  } catch (error) {
    // ── Structured Audit Log: Critical Failure ──
    console.error(JSON.stringify({
      severity: 'CRITICAL',
      event: 'SENTINEL_INFERENCE_FAILURE',
      requestId,
      errorMessage: error.message,
      errorStack: error.stack,
      timestamp: new Date().toISOString(),
    }));

    return res.status(500).json({
      error: 'Infrastructure Failure',
      code: 'DECISION_LATENCY_ERROR',
      message: 'Falla en la capa de inferencia soberana.',
      detail: error.message,
      requestId,
    });
  }
});
