/**
 * SENTINEL ENGINE V4.9-RC — Security Manager (Sovereign Abstraction)
 * ═══════════════════════════════════════════════════════════════════
 * Hardware-agnostic cryptographic operations using the Repository Pattern.
 *
 * Architecture:
 *   KeyProvider (interface) → SoftwareKmsProvider (V4.9)
 *                           → HardwareHsmProvider (V5.0 — future)
 *
 * All PII encryption, field-level tokenization, and payload signing
 * flows through this manager. Swapping to Cloud HSM in V5.0 requires
 * ONLY changing the provider type in the factory — zero business logic
 * refactoring.
 *
 * Current Provider: SoftwareKmsProvider
 *   - AES-256-GCM for symmetric encryption/decryption
 *   - HMAC-SHA256 for payload signing/verification
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
 */

// ─────────────────────────────────────────────────────
//  SOFTWARE KMS PROVIDER (V4.9 — Current)
//  Uses Node.js crypto with keys from Secret Manager
// ─────────────────────────────────────────────────────

class SoftwareKmsProvider {
  /**
   * @param {object} params
   * @param {string} params.encryptionKey - 32-byte hex key for AES-256-GCM
   * @param {string} params.signingKey - HMAC signing key
   * @param {string} [params.keyId] - Key identifier for metadata
   */
  constructor({ encryptionKey, signingKey, keyId = 'sentinel-sw-v49' }) {
    if (!encryptionKey || encryptionKey.length < 32) {
      throw new Error('SoftwareKmsProvider: encryptionKey must be at least 32 characters (hex).');
    }
    if (!signingKey || signingKey.length < 16) {
      throw new Error('SoftwareKmsProvider: signingKey must be at least 16 characters.');
    }

    // Derive a 32-byte key from the provided key material
    this._encKey = crypto.createHash('sha256').update(encryptionKey).digest();
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
//  HARDWARE HSM PROVIDER (V5.0 — Placeholder)
// ─────────────────────────────────────────────────────

class HardwareHsmProvider {
  constructor() {
    throw new Error(
      'HardwareHsmProvider is reserved for V5.0 "Sovereign" release. ' +
      'Use SoftwareKmsProvider for V4.9-RC.'
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
   * Encrypt a string field (e.g. PII).
   * Returns a base64-encoded ciphertext.
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
   * Tokenize PII fields in a text string using encrypted tokens.
   * Replaces SSN, CC, and patient ID patterns with encrypted references.
   * @param {string} text
   * @returns {Promise<string>}
   */
  async tokenizePII(text) {
    let result = text;

    // SSN pattern: 123-45-6789
    const ssnMatches = result.match(/\d{3}-\d{2}-\d{4}/g) || [];
    for (const ssn of ssnMatches) {
      const token = await this.encryptField(ssn);
      result = result.replace(ssn, `[SSN_ENC:${token.substring(0, 12)}]`);
    }

    // Credit card: 1234-5678-9012-3456
    const ccMatches = result.match(/\d{4}-\d{4}-\d{4}-\d{4}/g) || [];
    for (const cc of ccMatches) {
      const token = await this.encryptField(cc);
      result = result.replace(cc, `[CC_ENC:${token.substring(0, 12)}]`);
    }

    // Patient ID: patient_id: ABC123
    const pidMatches = result.match(/patient_id:\s*[a-zA-Z0-9]+/gi) || [];
    for (const pid of pidMatches) {
      const token = await this.encryptField(pid);
      result = result.replace(pid, `patient_id: [SUBJ_ENC:${token.substring(0, 12)}]`);
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
            'SECURITY_BOOT_FAILURE: SENTINEL_ENCRYPTION_KEY is not set. ' +
            'Fetch this secret from GCP Secret Manager before initializing SecurityManager. ' +
            'The engine will not run in an unencrypted state.'
          );
        }
        if (!sigKey) {
          throw new Error(
            'SECURITY_BOOT_FAILURE: SENTINEL_SIGNING_KEY is not set. ' +
            'Fetch this secret from GCP Secret Manager before initializing SecurityManager. ' +
            'The engine will not run without payload signing.'
          );
        }

        const provider = new SoftwareKmsProvider({
          encryptionKey: encKey,
          signingKey: sigKey,
          keyId: options.keyId || 'sentinel-sw-v49',
        });

        console.log('[SECURITY_MANAGER] Initialized with SoftwareKmsProvider. Key source: Secret Manager.');
        return new SecurityManager(provider);
      }

      case 'hardware':
        throw new Error(
          'HardwareHsmProvider is not available until V5.0. ' +
          'Use providerType="software" for V4.9-RC.'
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
