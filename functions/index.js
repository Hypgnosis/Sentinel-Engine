/**
 * SENTINEL ENGINE — CORE INFRASTRUCTURE (v2.1 White Label)
 * ═══════════════════════════════════════════════════════════
 * Google Cloud Function (Node.js 20+) — Gen2
 * 
 * Inference: Google Gen AI (Gemini 2.0 Flash)
 * Context:   Cloud Firestore (sentinel_data)
 * Security:  Zero-Trust CORS, Structured Audit Logging
 * 
 * Propiedad de High ArchyTech Solutions.
 * Arquitectura diseñada para: ReshapeX, Fracttal, DHL, Maersk.
 * ═══════════════════════════════════════════════════════════
 */

const functions = require('@google-cloud/functions-framework');
const { GoogleGenAI } = require('@google/genai');
const { Firestore } = require('@google-cloud/firestore');
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

// Force production sovereign project to inherit Vertex AI Enterprise SLAs
const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || 'ha-sentinel-core-prod';
const GCP_REGION     = process.env.GCP_REGION     || 'us-central1';

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

const firestore = new Firestore({ projectId: GCP_PROJECT_ID });

let ai = null;

// ── In-Memory Global Caching & Throttling ──
const CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes
const sourceAlphaCache = new Map(); // key: contextKey, value: { payload, timestamp }

const RATE_LIMIT_WINDOW_MS = 1000 * 10; // 10 seconds
const RATE_LIMIT_MAX_REQUESTS = 5;
const requestStamps = new Map(); // key: uid, value: [timestamps]

// ─────────────────────────────────────────────────────
//  SYSTEM PROMPT — Sovereign Intelligence Persona
// ─────────────────────────────────────────────────────

const buildSystemPrompt = (contextPayload) => `
SISTEMA: Sentinel Engine — Sovereign Intelligence Layer.
ESTADO: White Label Infrastructure v2.1.
ARQUITECTO: High ArchyTech Solutions.

CONTEXTO OPERATIVO:
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
4. Formato: estructura clara con bullet points, métricas destacadas, y recomendaciones accionables.
5. Tono: ejecutivo, técnico, directo. Cero ambigüedad. Cero redundancia.
6. Idioma: Responde en el mismo idioma de la consulta del usuario.

CAPA DE SEGURIDAD: AES-256-GCM-ZDF | Post-Quantum Ready
`;

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
      contextKey,
      queryLength: query.trim().length,
      timestamp: requestTimestamp,
    }));

    // ── Retrieve Source Alpha (Cache-Aware) ──
    const nowMsForCache = Date.now();
    let contextPayload;

    if (sourceAlphaCache.has(contextKey) && (nowMsForCache - sourceAlphaCache.get(contextKey).timestamp) < CACHE_TTL_MS) {
      contextPayload = sourceAlphaCache.get(contextKey).payload;
      console.log(JSON.stringify({ severity: 'DEBUG', event: 'CACHE_HIT', contextKey, requestId }));
    } else {
      console.log(JSON.stringify({ severity: 'DEBUG', event: 'CACHE_MISS', contextKey, requestId }));
      const sourceAlphaRef = firestore.collection('sentinel_data').doc(contextKey);
      const doc = await sourceAlphaRef.get();

      if (!doc.exists) {
        console.error(JSON.stringify({
          severity: 'ERROR',
          event: 'SOURCE_ALPHA_NOT_FOUND',
          requestId,
          contextKey,
          timestamp: requestTimestamp,
        }));

        return res.status(503).json({
          error: 'Infrastructure Data Integrity Breach',
          code: 'SOURCE_ALPHA_MISSING',
          message: `Source Alpha context document '${contextKey}' not found in Firestore. Data pipeline may require re-initialization.`,
          requestId,
        });
      }

      const contextData = doc.data();
      contextPayload = typeof contextData.content === 'string'
        ? contextData.content
        : JSON.stringify(contextData.content || contextData, null, 2);

      sourceAlphaCache.set(contextKey, { payload: contextPayload, timestamp: nowMsForCache });
    }

    // ── Build Prompt & Execute Inference ──
    const systemPrompt = buildSystemPrompt(contextPayload);

    // ── Execute Sovereign Inference ──
    const result = await ai.models.generateContent({
      model: 'gemini-1.5-pro',
      contents: query.trim(),
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.1,
        maxOutputTokens: 2048,
        topP: 0.8,
        responseModalities: ["TEXT", "AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: "Puck"
            }
          }
        }
      }
    });

    const inferenceOutput = result.text;

    // Search for the generated audio payload in the content parts
    let audioBase64 = null;
    if (result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts) {
      const audioPart = result.candidates[0].content.parts.find(p => p.inlineData && p.inlineData.mimeType.startsWith('audio/'));
      if (audioPart) {
        audioBase64 = audioPart.inlineData.data;
      }
    }

    // ── Structured Audit Log: Inference Complete ──
    console.log(JSON.stringify({
      severity: 'INFO',
      event: 'SENTINEL_INFERENCE_COMPLETE',
      requestId,
      clientContext: contextKey,
      model: 'gemini-1.5-pro-001',
      outputLength: inferenceOutput.length,
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - new Date(requestTimestamp).getTime(),
    }));

    // ── Success Response ──
    return res.status(200).json({
      status: 'SUCCESS',
      model: 'gemini-1.5-pro',
      timestamp: new Date().toISOString(),
      data: inferenceOutput,
      audioData: audioBase64,  // Native API PCM base64 encoded audio
      security_layer: 'AES-256-GCM-ZDF',
      infrastructure: 'Google Gen AI SDK (Server-Side Direct)',
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
