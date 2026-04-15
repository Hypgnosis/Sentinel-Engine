/**
 * SENTINEL ENGINE V4.9-RC — Policy Enforcement Point (PEP Gate)
 * ═══════════════════════════════════════════════════════════════
 * Zero-Trust middleware: Independent JWT signature verification
 * using JWKS public keys from Supabase Identity Provider.
 *
 * Architecture:
 *   Layer 1 → JWKS-RSA local verification (primary)
 *   Layer 2 → Firebase Admin SDK verification (fallback)
 *   Both fail → 401 Unauthorized (hard reject)
 *
 * Context Injection:
 *   req.sentinelContext = { tenantId, userRole, authMethod, verifiedAt }
 * ═══════════════════════════════════════════════════════════════
 */

const jwksClient = require('jwks-rsa');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');

// ─────────────────────────────────────────────────────
//  JWKS CLIENT — Cached Public Key Fetcher
// ─────────────────────────────────────────────────────

const SUPABASE_PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'pgajtcnpnuutlqstpmdr';
const JWKS_URI = `https://${SUPABASE_PROJECT_REF}.supabase.co/auth/v1/.well-known/jwks.json`;

const jwks = jwksClient({
  jwksUri: JWKS_URI,
  cache: true,
  cacheMaxAge: 3600000,   // 1 hour — per spec
  rateLimit: true,
  jwksRequestsPerMinute: 10,
  timeout: 5000,          // 5s max for JWKS fetch
});

/**
 * Retrieves the signing key for a given Key ID from the JWKS endpoint.
 * @param {string} kid - Key ID from the JWT header
 * @returns {Promise<string>} Public key or certificate
 */
function getSigningKey(kid) {
  return new Promise((resolve, reject) => {
    jwks.getSigningKey(kid, (err, key) => {
      if (err) {
        console.error(`[PEP_JWKS_ERROR] Failed to fetch signing key for kid=${kid}:`, err.message);
        return reject(err);
      }
      const signingKey = key.getPublicKey();
      resolve(signingKey);
    });
  });
}

// ─────────────────────────────────────────────────────
//  PEP VERIFICATION — Dual-Layer Auth
// ─────────────────────────────────────────────────────

/**
 * Custom error class for PEP Gate failures.
 */
class PEPError extends Error {
  constructor(code, message, httpStatus = 401) {
    super(message);
    this.name = 'PEPError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

/**
 * Layer 1: JWKS-RSA local signature verification.
 * Decodes the JWT, fetches the public key by kid, and verifies.
 *
 * @param {string} token - Raw JWT string
 * @returns {Promise<object>} Decoded and verified token claims
 */
async function verifyWithJWKS(token) {
  // Decode header without verification to extract kid
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || !decoded.header) {
    throw new PEPError('PEP_DECODE_FAILURE', 'Token header could not be decoded.');
  }

  const kid = decoded.header.kid;
  if (!kid) {
    throw new PEPError('PEP_NO_KID', 'Token missing key ID (kid) in header.');
  }

  const publicKey = await getSigningKey(kid);

  return new Promise((resolve, reject) => {
    jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      // Supabase uses 'authenticated' role claim
      // We verify expiration and issuer
      issuer: `https://${SUPABASE_PROJECT_REF}.supabase.co/auth/v1`,
    }, (err, verified) => {
      if (err) {
        return reject(new PEPError('PEP_SIGNATURE_INVALID', `JWKS verification failed: ${err.message}`));
      }
      resolve(verified);
    });
  });
}

/**
 * Layer 2: Firebase Admin SDK verification (fallback).
 *
 * @param {string} token - Raw JWT string
 * @returns {Promise<object>} Decoded Firebase token
 */
async function verifyWithFirebase(token) {
  try {
    const decodedToken = await admin.auth().verifyIdToken(token, true);
    return decodedToken;
  } catch (err) {
    throw new PEPError('PEP_FIREBASE_FAILURE', `Firebase verification failed: ${err.message}`);
  }
}

/**
 * Primary PEP Gate entry point.
 * Attempts JWKS verification first, then Firebase fallback.
 * Injects verified context into req.sentinelContext.
 *
 * @param {object} req - HTTP request object
 * @returns {Promise<{tenantId: string, userRole: string, authMethod: string, verifiedAt: string, sub: string}>}
 * @throws {PEPError} If both layers fail
 */
async function verifyPEP(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    throw new PEPError('PEP_NO_TOKEN', 'Missing or malformed Authorization header.', 401);
  }

  const token = authHeader.split('Bearer ')[1];
  if (!token || token.length < 10) {
    throw new PEPError('PEP_EMPTY_TOKEN', 'Token is empty or too short.', 401);
  }

  let claims = null;
  let authMethod = null;

  // ── Layer 1: JWKS-RSA (Primary) ──
  try {
    claims = await verifyWithJWKS(token);
    authMethod = 'JWKS_SUPABASE';
    console.log(`[PEP_GATE] JWKS verification SUCCESS. sub=${claims.sub}`);
  } catch (jwksErr) {
    console.warn(`[PEP_GATE] JWKS verification failed: ${jwksErr.message}. Falling back to Firebase.`);

    // ── Layer 2: Firebase Admin (Fallback) ──
    try {
      claims = await verifyWithFirebase(token);
      authMethod = 'FIREBASE_ADMIN';
      console.log(`[PEP_GATE] Firebase fallback verification SUCCESS. uid=${claims.uid}`);
    } catch (fbErr) {
      console.error(`[PEP_GATE] BOTH layers FAILED. JWKS: ${jwksErr.message} | Firebase: ${fbErr.message}`);
      throw new PEPError(
        'PEP_AUTH_FAILURE',
        'Authentication failed. Both JWKS and Firebase verification rejected the token.',
        401
      );
    }
  }

  // ── Context Extraction ──
  // Supabase tokens: tenant info in app_metadata or custom claims
  // Firebase tokens: tenant_id in custom claims
  const tenantId = claims.tenant_id
    || claims.app_metadata?.tenant_id
    || claims.user_metadata?.tenant_id
    || null;

  if (!tenantId) {
    throw new PEPError(
      'PEP_NO_TENANT',
      'Verified token does not contain a tenant_id claim. Access denied.',
      403
    );
  }

  const userRole = claims.role
    || claims.app_metadata?.role
    || claims.user_role
    || 'viewer';

  const context = {
    tenantId,
    userRole,
    authMethod,
    sub: claims.sub || claims.uid || 'unknown',
    verifiedAt: new Date().toISOString(),
  };

  // Inject into request for downstream consumption
  req.sentinelContext = context;
  return context;
}

module.exports = {
  verifyPEP,
  PEPError,
  // Exported for testing
  verifyWithJWKS,
  verifyWithFirebase,
};
