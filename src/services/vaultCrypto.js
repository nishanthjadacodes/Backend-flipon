import crypto from 'crypto';

/**
 * AES-256-GCM encryption for vault documents.
 *
 * Design:
 *   • Key comes from env var VAULT_ENCRYPTION_KEY (64 hex chars = 32 bytes).
 *     Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
 *   • Fresh random 12-byte IV per file — NEVER reused.
 *   • GCM's 16-byte auth tag stored alongside ciphertext as integrity check.
 *   • On disk: plain ciphertext bytes. IV + auth tag live in the DB row
 *     (VaultDocument.iv / auth_tag, hex-encoded).
 *
 * Why GCM: authenticated encryption. If someone tampers with the on-disk
 * blob, decryption fails loudly instead of silently returning garbage.
 *
 * Key rotation: keep the old key around as VAULT_ENCRYPTION_KEY_OLD and
 * re-encrypt rows in a batch job. Not implemented yet — single key for now.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;     // GCM recommended
const AUTH_TAG_BYTES = 16;

const loadKey = () => {
  const hex = process.env.VAULT_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      'VAULT_ENCRYPTION_KEY env var missing. Generate with: ' +
        'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  const buf = Buffer.from(hex, 'hex');
  if (buf.length !== 32) {
    throw new Error(`VAULT_ENCRYPTION_KEY must be 32 bytes hex (got ${buf.length})`);
  }
  return buf;
};

export const vaultCryptoReady = () => {
  try { loadKey(); return true; } catch (_) { return false; }
};

/**
 * Encrypt a plaintext buffer.
 * @param {Buffer} plaintext
 * @returns {{ ciphertext: Buffer, ivHex: string, authTagHex: string }}
 */
export const encryptBuffer = (plaintext) => {
  const key = loadKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext,
    ivHex: iv.toString('hex'),
    authTagHex: authTag.toString('hex'),
  };
};

/**
 * Decrypt a ciphertext buffer. Throws if the auth tag doesn't match.
 * @param {Buffer} ciphertext
 * @param {string} ivHex
 * @param {string} authTagHex
 * @returns {Buffer} plaintext
 */
export const decryptBuffer = (ciphertext, ivHex, authTagHex) => {
  const key = loadKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  if (iv.length !== IV_BYTES) throw new Error('Invalid IV length');
  if (authTag.length !== AUTH_TAG_BYTES) throw new Error('Invalid auth tag length');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
};
