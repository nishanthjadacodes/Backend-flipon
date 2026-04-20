import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  VaultDocument,
  VaultAccessLog,
  Enquiry,
  CompanyProfile,
  User,
} from '../models/index.js';
import { encryptBuffer, decryptBuffer, vaultCryptoReady } from '../services/vaultCrypto.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VAULT_DIR = path.join(__dirname, '../../uploads/vault');
if (!fs.existsSync(VAULT_DIR)) fs.mkdirSync(VAULT_DIR, { recursive: true });

// Ensure the vault key is present at boot so failures surface immediately
// rather than on first upload.
if (!vaultCryptoReady()) {
  console.warn('[vault] VAULT_ENCRYPTION_KEY is not set — uploads will fail until it is configured.');
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const logAccess = async (req, vaultDocId, action) => {
  try {
    await VaultAccessLog.create({
      vault_document_id: vaultDocId,
      actor_user_id: req.user.id,
      actor_role: req.user.role,
      action,
      ip_address: req.ip,
      user_agent: (req.headers['user-agent'] || '').slice(0, 500),
    });
  } catch (e) {
    console.warn('[vault] failed to log access:', e?.message);
  }
};

// Verify the caller is allowed to touch vault docs for a given enquiry.
// Customers: must own the enquiry. Admins: must have DOCUMENT_VAULT perm
// (the route-level middleware handles that) AND only act on rows within
// their scope (we don't tenant-scope admins further right now).
const checkEnquiryAccess = async (req, enquiryId) => {
  if (!enquiryId) return { ok: false, code: 400, message: 'enquiry_id is required' };
  const enquiry = await Enquiry.findByPk(enquiryId);
  if (!enquiry) return { ok: false, code: 404, message: 'Enquiry not found' };

  const isAdmin = req.user?.role && req.user.role !== 'customer';
  const isOwner = enquiry.customer_id === req.user.id;
  if (!isAdmin && !isOwner) {
    return { ok: false, code: 403, message: 'Not authorised for this enquiry' };
  }
  return { ok: true, enquiry, isAdmin };
};

// ─── POST /api/vault/upload ─────────────────────────────────────────────────
// Admin uploads a document into an enquiry's vault. Multipart via existing
// upload middleware — the file lands in memory/disk, we read, encrypt, write
// to vault/ directory, persist metadata.
export const uploadVaultDocument = async (req, res) => {
  try {
    if (!vaultCryptoReady()) {
      return res.status(500).json({ success: false, message: 'Vault encryption not configured' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const { enquiry_id, tier = 'standard', note, visible_to_customer = true } = req.body;

    const check = await checkEnquiryAccess(req, enquiry_id);
    if (!check.ok) {
      // Clean up the temp file written by multer before we return
      try { fs.unlinkSync(req.file.path); } catch (_) {}
      return res.status(check.code).json({ success: false, message: check.message });
    }
    const { enquiry } = check;

    // Load the company_profile that owns this enquiry — we denormalise
    // customer_id + company_profile_id onto the vault row for fast scoping.
    const profile = await CompanyProfile.findByPk(enquiry.company_profile_id);
    if (!profile) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
      return res.status(400).json({ success: false, message: 'Enquiry has no linked company profile' });
    }

    // Read, encrypt, write
    const plaintext = fs.readFileSync(req.file.path);
    const { ciphertext, ivHex, authTagHex } = encryptBuffer(plaintext);
    const storedName = `${crypto.randomBytes(16).toString('hex')}.enc`;
    fs.writeFileSync(path.join(VAULT_DIR, storedName), ciphertext);

    // Discard the temp plaintext upload
    try { fs.unlinkSync(req.file.path); } catch (_) {}

    const allowedTiers = ['standard', 'sensitive', 'deliverable'];
    const doc = await VaultDocument.create({
      enquiry_id: enquiry.id,
      company_profile_id: profile.id,
      customer_id: enquiry.customer_id,
      uploaded_by: req.user.id,
      original_name: req.file.originalname,
      stored_name: storedName,
      mime_type: req.file.mimetype,
      plaintext_size: plaintext.length,
      ciphertext_size: ciphertext.length,
      iv: ivHex,
      auth_tag: authTagHex,
      tier: allowedTiers.includes(tier) ? tier : 'standard',
      visible_to_customer: String(visible_to_customer) !== 'false',
      note: note || null,
    });

    await logAccess(req, doc.id, 'upload');
    res.status(201).json({
      success: true,
      data: {
        id: doc.id,
        enquiry_id: doc.enquiry_id,
        original_name: doc.original_name,
        mime_type: doc.mime_type,
        plaintext_size: doc.plaintext_size,
        tier: doc.tier,
        visible_to_customer: doc.visible_to_customer,
        note: doc.note,
        created_at: doc.created_at,
      },
    });
  } catch (error) {
    console.error('uploadVaultDocument error:', error);
    res.status(500).json({ success: false, message: 'Vault upload failed' });
  }
};

// ─── GET /api/vault/enquiry/:enquiryId ──────────────────────────────────────
// List vault docs attached to an enquiry. Customers see only
// visible_to_customer=true rows; admins see everything.
export const listVaultDocumentsForEnquiry = async (req, res) => {
  try {
    const { enquiryId } = req.params;
    const check = await checkEnquiryAccess(req, enquiryId);
    if (!check.ok) return res.status(check.code).json({ success: false, message: check.message });

    const where = { enquiry_id: enquiryId };
    if (!check.isAdmin) where.visible_to_customer = true;

    const docs = await VaultDocument.findAll({
      where,
      order: [['created_at', 'DESC']],
      attributes: [
        'id', 'enquiry_id', 'original_name', 'mime_type', 'plaintext_size',
        'tier', 'visible_to_customer', 'note', 'uploaded_by', 'created_at',
      ],
    });

    // Log the enumeration itself — one row per list call, not per doc.
    if (docs.length) await logAccess(req, docs[0].id, 'list');

    res.json({ success: true, data: docs });
  } catch (error) {
    console.error('listVaultDocumentsForEnquiry error:', error);
    res.status(500).json({ success: false, message: 'Failed to load vault documents' });
  }
};

// ─── GET /api/vault/:id/download ────────────────────────────────────────────
// Decrypt and stream the plaintext. Every call is audit-logged.
export const downloadVaultDocument = async (req, res) => {
  try {
    if (!vaultCryptoReady()) {
      return res.status(500).json({ success: false, message: 'Vault encryption not configured' });
    }
    const doc = await VaultDocument.findByPk(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

    // Ownership check — customer gets own enquiry; admins allowed via route perm.
    const isAdmin = req.user?.role && req.user.role !== 'customer';
    if (!isAdmin) {
      if (doc.customer_id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Not authorised' });
      }
      if (!doc.visible_to_customer) {
        return res.status(403).json({ success: false, message: 'Document not available yet' });
      }
    }

    const onDisk = path.join(VAULT_DIR, doc.stored_name);
    if (!fs.existsSync(onDisk)) {
      return res.status(410).json({ success: false, message: 'Encrypted file missing on disk' });
    }

    let plaintext;
    try {
      const ciphertext = fs.readFileSync(onDisk);
      plaintext = decryptBuffer(ciphertext, doc.iv, doc.auth_tag);
    } catch (cryptoErr) {
      console.error('[vault] decrypt failed for', doc.id, cryptoErr?.message);
      return res.status(500).json({ success: false, message: 'Failed to decrypt document (integrity check failed)' });
    }

    await logAccess(req, doc.id, 'download');

    // Safer filename for Content-Disposition (strip quotes)
    const safeName = String(doc.original_name).replace(/"/g, '').slice(0, 255);
    res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
    res.setHeader('Content-Length', String(plaintext.length));
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.end(plaintext);
  } catch (error) {
    console.error('downloadVaultDocument error:', error);
    res.status(500).json({ success: false, message: 'Download failed' });
  }
};

// ─── DELETE /api/vault/:id ──────────────────────────────────────────────────
// Admin-only (routed with DOCUMENT_VAULT). Soft-delete would be safer but we
// also want the on-disk ciphertext to be wiped — do a hard delete of both
// the row and the file. Audit log row stays.
export const deleteVaultDocument = async (req, res) => {
  try {
    const doc = await VaultDocument.findByPk(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

    const onDisk = path.join(VAULT_DIR, doc.stored_name);
    await logAccess(req, doc.id, 'delete');
    try {
      if (fs.existsSync(onDisk)) fs.unlinkSync(onDisk);
    } catch (e) {
      console.warn('[vault] failed to remove on-disk ciphertext:', e?.message);
    }
    await doc.destroy();
    res.json({ success: true, message: 'Vault document deleted' });
  } catch (error) {
    console.error('deleteVaultDocument error:', error);
    res.status(500).json({ success: false, message: 'Delete failed' });
  }
};
