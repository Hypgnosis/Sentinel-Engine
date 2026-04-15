/**
 * SENTINEL ENGINE V5.0 — Security Manager (Sovereign Abstraction)
 * ═══════════════════════════════════════════════════════════════════
 * Hardware-agnostic cryptographic operations using the Repository Pattern.
 *
 * Architecture:
 *   KeyProvider (interface) → SoftwareKmsProvider (V5.0)
 *                           → HardwareHsmProvider (V5.1 — future)
 *
 * V5.0 CHANGES:
 * ─────────────────────────────────────────────────────────────────
 *   - tokenizePII() now uses HMAC-SHA256 (one-way, irreversible).
 *     AES-based PII "tokenization" was reversible — security theatre.
 *   - encryptField/decryptField retained for legitimate use-cases
 *     (e.g., at-rest encryption of audit payloads), but NEVER for PII.
 *   - Signing key exposed internally for HMAC hashing via _sigKey.
 *   - Removed duplicate class definitions from V4.9-RC merge artifacts.
 *
 * All PII anonymization, field-level encryption, and payload signing
 * flows through this manager. Swapping to Cloud HSM in V5.1 requires
 * ONLY changing the provider type in the factory — zero business logic
 * refactoring.
 *
 * Current Provider: SoftwareKmsProvider
 *   - AES-256-GCM for symmetric encryption/decryption
 *   - HMAC-SHA256 for payload signing/verification AND PII hashing
 *   - Key material from GCP Secret Manager
 * ═══════════════════════════════════════════════════════════════════
 */

const crypto = require('crypto');

// ─────────────────────────────────────────────────────
//  KEY PROVIDER INTERFACE (JSDoc-typed)
// ─────────────────────────────────────────────────────

/**
 * @typedef {Object} KeyProvider
 * @property {(plaintext: Buffer) => Promise<Buffer>} encrypt - Encrypt a plaintext buffer
 * @property {(ciphertext: Buffer) => Promise<Buffer>} decrypt - Decrypt a ciphertext buffer
 * @property {(data: Buffer) => Promise<string>} sign - Create a signature for data
 * @property {(data: Buffer, signature: string) => Promise<boolean>} verify - Verify a signature
 * @property {() => Promise<{keyId: string, algorithm: string, provider: string}>} getKeyMetadata
 * @property {string} signingKey - Raw signing key for HMAC derivation
 */

// ─────────────────────────────────────────────────────
//  SOFTWARE KMS PROVIDER (V5.0 — Current)
//  Uses Node.js crypto with keys from Secret Manager
// ─────────────────────────────────────────────────────

class SoftwareKmsProvider {
  /**
   * @param {object} params
   * @param {string} params.encryptionKey - 32-byte hex key for AES-256-GCM
   * @param {string} params.signingKey - HMAC signing key
   * @param {string} [params.keyId] - Key identifier for metadata
   */
  constructor({ encryptionKey, signingKey, keyId = 'sentinel-sw-v50' }) {
    if (!encryptionKey || encryptionKey.length < 32) {
      throw new Error('SoftwareKmsProvider: encryptionKey must be at least 32 characters (hex).');
    }
    if (!signingKey || signingKey.length < 16) {
      throw new Error('SoftwareKmsProvider: signingKey must be at least 16 characters.');
    }

    // Derive a 32-byte key using HKDF (HMAC-based Key Derivation Function)
    // for proper entropy expansion. Raw SHA-256 of a text string reduces
    // cryptographic strength to the entropy of the input.
    // HKDF domain-separation salt prevents cross-application key reuse.
    const HKDF_SALT = Buffer.from('sentinel-engine-v50-sovereign', 'utf8');
    this._encKey = crypto.hkdfSync('sha256', encryptionKey, HKDF_SALT, 'aes-256-gcm-encryption', 32);
    this._sigKey = signingKey;
    this._keyId = keyId;
    this._algorithm = 'aes-256-gcm';
  }

  /**
   * Encrypt plaintext using AES-256-GCM.
   * Output format: iv(12) + authTag(16) + ciphertext
   * @param {Buffer} plaintext
   * @returns {Promise<Buffer>}
   */
  async encrypt(plaintext) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this._algorithm, this._encKey, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    // Pack: iv(12) + authTag(16) + ciphertext
    return Buffer.concat([iv, authTag, encrypted]);
  }

  /**
   * Decrypt ciphertext (iv + authTag + encrypted).
   * @param {Buffer} ciphertext - Packed buffer from encrypt()
   * @returns {Promise<Buffer>}
   */
  async decrypt(ciphertext) {
    if (ciphertext.length < 28) {
      throw new Error('Ciphertext too short — minimum 28 bytes (iv + authTag).');
    }

    const iv = ciphertext.subarray(0, 12);
    const authTag = ciphertext.subarray(12, 28);
    const encrypted = ciphertext.subarray(28);

    const decipher = crypto.createDecipheriv(this._algorithm, this._encKey, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
  }

  /**
   * Sign data using HMAC-SHA256.
   * @param {Buffer} data
   * @returns {Promise<string>} Hex-encoded signature
   */
  async sign(data) {
    const hmac = crypto.createHmac('sha256', this._sigKey);
    hmac.update(data);
    return hmac.digest('hex');
  }

  /**
   * Verify an HMAC-SHA256 signature.
   * @param {Buffer} data
   * @param {string} signature - Hex-encoded signature
   * @returns {Promise<boolean>}
   */
  async verify(data, signature) {
    const expected = await this.sign(data);
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex')
    );
  }

  /**
   * Get metadata about the current key configuration.
   * @returns {Promise<{keyId: string, algorithm: string, provider: string}>}
   */
  async getKeyMetadata() {
    return {
      keyId: this._keyId,
      algorithm: this._algorithm,
      provider: 'SOFTWARE_KMS',
    };
  }
}

// ─────────────────────────────────────────────────────
//  HARDWARE HSM PROVIDER (V5.1 — Placeholder)
// ─────────────────────────────────────────────────────

class HardwareHsmProvider {
  constructor() {
    throw new Error(
      'HardwareHsmProvider is reserved for V5.1 "Sovereign HSM" release. ' +
      'Use SoftwareKmsProvider for V5.0.'
    );
  }
}

// ─────────────────────────────────────────────────────
//  SECURITY MANAGER — Facade
// ─────────────────────────────────────────────────────

class SecurityManager {
  /** @type {KeyProvider} */
  #provider;

  /**
   * @param {KeyProvider} provider
   */
  constructor(provider) {
    this.#provider = provider;
  }

  /**
   * Encrypt a string field (e.g. audit payload at-rest).
   * Returns a base64-encoded ciphertext.
   *
   * WARNING: Do NOT use for PII anonymization — use tokenizePII() instead.
   *
   * @param {string} field
   * @returns {Promise<string>}
   */
  async encryptField(field) {
    const plaintext = Buffer.from(field, 'utf8');
    const ciphertext = await this.#provider.encrypt(plaintext);
    return ciphertext.toString('base64');
  }

  /**
   * Decrypt a base64-encoded ciphertext field.
   * @param {string} encryptedField
   * @returns {Promise<string>}
   */
  async decryptField(encryptedField) {
    const ciphertext = Buffer.from(encryptedField, 'base64');
    const plaintext = await this.#provider.decrypt(ciphertext);
    return plaintext.toString('utf8');
  }

  /**
   * Sign a JSON payload. Returns the hex signature.
   * @param {object} payload
   * @returns {Promise<string>}
   */
  async signPayload(payload) {
    const data = Buffer.from(JSON.stringify(payload), 'utf8');
    return this.#provider.sign(data);
  }

  /**
   * Verify a JSON payload against a signature.
   * @param {object} payload
   * @param {string} signature
   * @returns {Promise<boolean>}
   */
  async verifyPayload(payload, signature) {
    const data = Buffer.from(JSON.stringify(payload), 'utf8');
    return this.#provider.verify(data, signature);
  }

  /**
   * PII Tokenization — TRUE ONE-WAY ANONYMIZATION (HMAC-SHA256)
   *
   * V5.0 SOVEREIGN MANDATE:
   *   This method produces IRREVERSIBLE, deterministic hashes.
   *   It uses crypto.createHmac('sha256', signingKey) directly.
   *   It does NOT call encryptField() — AES is reversible and
   *   constitutes "security theatre" for PII anonymization.
   *
   * Salted identifiers: SSNs, Credit Cards, and Subject IDs are
   * converted to irreversible tokens: [HASHED_SSN:8a3f...],
   * [HASHED_CC:b7e2...], [HASHED_ID:c9d0...].
   *
   * @param {string} text - Input text containing potential PII
   * @param {string} [tenantId] - Tenant ID for per-tenant salt (prevents cross-tenant rainbow tables)
   * @returns {Promise<string>} Text with PII replaced by HMAC tokens
   */
  async tokenizePII(text, tenantId = null) {
    if (!text) return text;
    let result = text;

    /**
     * Produce a one-way HMAC-SHA256 hash of the given value.
     * Normalizes the value (strips all non-alphanumeric chars) before hashing.
     *
     * V5.2 BANK-GRADE ANONYMIZATION:
     * HKDF(digest='sha256', salt=SYSTEM_PEPPER, info=tenantId)
     *
     * SYSTEM_PEPPER is a high-entropy secret validated at boot. Using it
     * as the HKDF salt means PII tokens are mathematically unreachable
     * even if a tenantId is compromised — the attacker would also need
     * the SYSTEM_PEPPER, which never leaves Secret Manager.
     *
     * @param {string} value - Raw PII value
     * @param {string} type - Token type label (SSN, CC, SUBJ, ID)
     * @returns {string} Irreversible token string
     */
    const hmacHash = (value, type) => {
      const normalized = value.replace(/[\s\-\.]/g, '').trim();

      // Derive a per-tenant HMAC key via HKDF (32 bytes)
      // IKM: global signing key
      // Salt: SYSTEM_PEPPER (high-entropy, boot-validated)
      // Info: tenantId (domain separation per tenant)
      const pepper = process.env.SYSTEM_PEPPER;
      const tenantInfo = tenantId || 'global';
      const derivedKey = crypto.hkdfSync(
        'sha256',
        this.#provider._sigKey,
        Buffer.from(pepper, 'utf8'),
        tenantInfo,
        32
      );

      const hash = crypto
        .createHmac('sha256', Buffer.from(derivedKey))
        .update(normalized)
        .digest('hex');
      return `[HASHED_${type}:${hash.substring(0, 12)}]`;
    };

    // ── SSN: Multi-format detection ──
    // Matches: 123-45-6789, 123 45 6789, 123.45.6789, 123456789
    const SSN_PATTERNS = [
      /\d{3}-\d{2}-\d{4}/g,           // dash-delimited
      /\d{3}\s\d{2}\s\d{4}/g,         // space-delimited
      /\d{3}\.\d{2}\.\d{4}/g,         // dot-delimited
      /(?<!\d)\d{9}(?!\d)/g,          // contiguous 9-digit (with boundary guards)
    ];
    for (const pattern of SSN_PATTERNS) {
      const matches = result.match(pattern) || [];
      for (const ssn of matches) {
        result = result.replace(ssn, hmacHash(ssn, 'SSN'));
      }
    }

    // ── Credit Card: Multi-format detection ──
    // Matches: 1234-5678-9012-3456, 1234 5678 9012 3456, 1234567890123456
    const CC_PATTERNS = [
      /\d{4}-\d{4}-\d{4}-\d{4}/g,     // dash-delimited
      /\d{4}\s\d{4}\s\d{4}\s\d{4}/g,  // space-delimited
      /(?<!\d)\d{16}(?!\d)/g,          // contiguous 16-digit (with boundary guards)
    ];
    for (const pattern of CC_PATTERNS) {
      const matches = result.match(pattern) || [];
      for (const cc of matches) {
        result = result.replace(cc, hmacHash(cc, 'CC'));
      }
    }

    // ── Subject/Patient ID: patient_id: ABC123 ──
    const pidMatches = result.match(/patient_id:\s*([a-zA-Z0-9]+)/gi) || [];
    for (const pid of pidMatches) {
      const idValue = pid.match(/patient_id:\s*([a-zA-Z0-9]+)/i);
      if (idValue && idValue[1]) {
        result = result.replace(pid, `patient_id: ${hmacHash(idValue[1], 'ID')}`);
      }
    }

    // ── Subject ID fields in JSON: "subject_id": "VALUE" ──
    const subjMatches = result.match(/"subject_id":\s*"([^"]+)"/g) || [];
    for (const subj of subjMatches) {
      const idMatch = subj.match(/"subject_id":\s*"([^"]+)"/);
      if (idMatch && idMatch[1]) {
        result = result.replace(subj, `"subject_id": "${hmacHash(idMatch[1], 'ID')}"`);
      }
    }

    return result;
  }

  /**
   * Get metadata about the underlying key provider.
   * @returns {Promise<object>}
   */
  async getKeyMetadata() {
    return this.#provider.getKeyMetadata();
  }

  // ── Factory ──

  /**
   * Create a SecurityManager with the specified provider type.
   *
   * V5.0: Keys MUST be present in the environment at boot time.
   * The global-scope boot guard in index.js guarantees this.
   *
   * @param {'software'|'hardware'} providerType
   * @param {object} [options] - Provider-specific options
   * @param {string} [options.encryptionKey] - For software provider
   * @param {string} [options.signingKey] - For software provider
   * @returns {SecurityManager}
   */
  static create(providerType = 'software', options = {}) {
    switch (providerType) {
      case 'software': {
        // SECURITY MANDATE: Keys MUST come from GCP Secret Manager (injected
        // into env at boot). Derivation from DATABASE_URL is prohibited —
        // it couples DB credential exposure to PII decryption capability.
        const encKey = options.encryptionKey || process.env.SENTINEL_ENCRYPTION_KEY;
        const sigKey = options.signingKey     || process.env.SENTINEL_SIGNING_KEY;

        if (!encKey) {
          throw new Error(
            '[FATAL_SECURITY_BOOT_FAILURE] SENTINEL_ENCRYPTION_KEY is not set. ' +
            'Fetch this secret from GCP Secret Manager before initializing SecurityManager. ' +
            'The engine will not run in an unencrypted state.'
          );
        }
        if (!sigKey) {
          throw new Error(
            '[FATAL_SECURITY_BOOT_FAILURE] SENTINEL_SIGNING_KEY is not set. ' +
            'Fetch this secret from GCP Secret Manager before initializing SecurityManager. ' +
            'The engine will not run without payload signing.'
          );
        }

        const provider = new SoftwareKmsProvider({
          encryptionKey: encKey,
          signingKey: sigKey,
          keyId: options.keyId || 'sentinel-sw-v50',
        });

        console.log('[SECURITY_MANAGER] Initialized with SoftwareKmsProvider (V5.0). Key source: Secret Manager. PII mode: HMAC-SHA256 (irreversible).');
        return new SecurityManager(provider);
      }

      case 'hardware':
        throw new Error(
          'HardwareHsmProvider is not available until V5.1. ' +
          'Use providerType="software" for V5.0.'
        );

      default:
        throw new Error(`Unknown provider type: ${providerType}. Expected "software" or "hardware".`);
    }
  }
}

module.exports = {
  SecurityManager,
  SoftwareKmsProvider,
  HardwareHsmProvider,
};
