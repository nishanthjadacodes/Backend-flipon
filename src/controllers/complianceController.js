// Compliance Vault — the Smart Alert system for industrial customers.
// Wraps VaultDocument with three customer-facing endpoints:
//   GET  /api/compliance              — list with computed status (green/yellow/red)
//   POST /api/compliance/upload       — upload a doc + expiry date
//   POST /api/compliance/:id/renew    — convert a doc into an Enquiry for renewal
//
// The 90/60/30-day push notification cron lives in
// src/jobs/complianceAlerts.js and reads the same rows.

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  VaultDocument,
  Enquiry,
  Service,
  CompanyProfile,
  User,
  sequelize,
} from '../models/index.js';
import { uploadSingle, getFileUrl } from '../middleware/upload.js';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Map a compliance doc type to a human label (also used in the renewal
// enquiry's note). Keep in sync with the model's ENUM.
const COMPLIANCE_LABELS = {
  factory_license: 'Factory License',
  fire_noc: 'Fire NOC',
  pollution_noc: 'Pollution NOC',
  gst_certificate: 'GST Certificate',
  incorporation: 'Certificate of Incorporation',
  iso_cert: 'ISO Certification',
  trade_license: 'Trade License',
  esi_pf: 'ESI / PF Registration',
  other: 'Compliance Document',
};

// Convert a plain expiry date into the bucket the UI renders.
//   green  — > 60 days remaining
//   yellow — 30..60 days
//   red    — < 30 days OR already expired
const computeStatus = (expiryDate) => {
  if (!expiryDate) return { status: 'unknown', daysLeft: null };
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exp = new Date(expiryDate);
  const daysLeft = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
  let status;
  if (daysLeft < 30) status = 'red';
  else if (daysLeft <= 60) status = 'yellow';
  else status = 'green';
  return { status, daysLeft };
};

// GET /api/compliance — current user's compliance docs, ordered by urgency.
export const listCompliance = async (req, res) => {
  try {
    // Find the user's company profile (required to scope vault docs).
    const profile = await CompanyProfile.findOne({ where: { user_id: req.user.id } });

    if (!profile) {
      return res.json({
        success: true,
        data: [],
        message: 'No company profile yet — fill it before uploading compliance docs.',
        needsCompanyProfile: true,
      });
    }

    const docs = await VaultDocument.findAll({
      where: {
        customer_id: req.user.id,
        company_profile_id: profile.id,
        compliance_type: { [sequelize.Sequelize.Op.ne]: null },
      },
      order: [['expiry_date', 'ASC']],
    });

    const enriched = docs.map((d) => {
      const j = d.toJSON();
      const { status, daysLeft } = computeStatus(j.expiry_date);
      return {
        ...j,
        // Don't leak server-internal storage details to the client.
        stored_name: undefined,
        iv: undefined,
        auth_tag: undefined,
        ciphertext_size: undefined,
        // Derived fields the UI uses directly.
        status,
        daysLeft,
        label: COMPLIANCE_LABELS[j.compliance_type] || j.compliance_type,
        downloadUrl: `${getFileUrl('', 'vault', req).replace(/\/$/, '')}/${j.id}/download`,
      };
    });

    res.json({ success: true, data: enriched });
  } catch (e) {
    console.error('listCompliance error:', e);
    res.status(500).json({ success: false, message: 'Failed to load compliance documents' });
  }
};

// POST /api/compliance/upload — multipart upload with expiry_date.
// Reuses the standard `uploadSingle` middleware so file lands in
// /uploads/<category>/. We only persist metadata + expiry; encryption
// is intentionally NOT applied here (these are the user's own docs they
// will preview/download from the app), to keep the customer-facing flow
// simple. Sensitive admin-issued docs still go through the encrypted
// /api/vault/upload path.
export const uploadCompliance = [
  // first run the multer middleware
  uploadSingle,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
      }
      const { compliance_type, expiry_date, note } = req.body;
      if (!compliance_type) {
        return res.status(400).json({ success: false, message: 'compliance_type is required' });
      }
      if (!expiry_date) {
        return res.status(400).json({ success: false, message: 'expiry_date is required' });
      }

      const profile = await CompanyProfile.findOne({ where: { user_id: req.user.id } });
      if (!profile) {
        // Clean up the orphan file if profile is missing.
        try { fs.unlinkSync(req.file.path); } catch (_) {}
        return res.status(400).json({
          success: false,
          message: 'Fill your company profile before uploading compliance documents.',
        });
      }

      const fakeIv = crypto.randomBytes(6).toString('hex');
      const fakeTag = crypto.randomBytes(8).toString('hex');

      const doc = await VaultDocument.create({
        enquiry_id: null,
        company_profile_id: profile.id,
        customer_id: req.user.id,
        uploaded_by: req.user.id,
        original_name: req.file.originalname,
        stored_name: req.file.filename,
        mime_type: req.file.mimetype,
        plaintext_size: req.file.size,
        ciphertext_size: req.file.size,
        // We're not actually encrypting these compliance uploads (see comment
        // above). Store random hex placeholders so the NOT NULL constraints
        // on the existing schema are satisfied.
        iv: fakeIv,
        auth_tag: fakeTag,
        tier: 'standard',
        visible_to_customer: true,
        note: note || null,
        compliance_type,
        expiry_date,
      });

      const j = doc.toJSON();
      const { status, daysLeft } = computeStatus(j.expiry_date);

      res.status(201).json({
        success: true,
        data: {
          ...j,
          stored_name: undefined,
          iv: undefined,
          auth_tag: undefined,
          status,
          daysLeft,
          label: COMPLIANCE_LABELS[j.compliance_type] || j.compliance_type,
        },
      });
    } catch (e) {
      console.error('uploadCompliance error:', e);
      res.status(500).json({ success: false, message: 'Failed to upload compliance document' });
    }
  },
];

// POST /api/compliance/:id/renew — convert a compliance doc into an Enquiry
// pre-filled with the doc type. Goes into the B2B Pipeline as a renewal lead.
export const renewCompliance = async (req, res) => {
  try {
    const { id } = req.params;

    const doc = await VaultDocument.findByPk(id);
    if (!doc || doc.customer_id !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }
    if (!doc.compliance_type) {
      return res.status(400).json({
        success: false,
        message: 'This document is not a tracked compliance document.',
      });
    }

    const profile = await CompanyProfile.findOne({ where: { user_id: req.user.id } });
    if (!profile) {
      return res.status(400).json({
        success: false,
        message: 'Company profile required before raising a renewal enquiry.',
      });
    }

    // Pick the best matching service (industrial type, name contains the
    // compliance label words). Fall back to the first industrial service.
    const label = COMPLIANCE_LABELS[doc.compliance_type] || doc.compliance_type;
    const candidate = await Service.findOne({
      where: {
        is_active: true,
        service_type: { [sequelize.Sequelize.Op.in]: ['industrial', 'both'] },
        name: { [sequelize.Sequelize.Op.like]: `%${label.split(' ')[0]}%` },
      },
    });
    const fallback = candidate
      ? null
      : await Service.findOne({
          where: {
            is_active: true,
            service_type: { [sequelize.Sequelize.Op.in]: ['industrial', 'both'] },
          },
        });

    const service = candidate || fallback;

    const enquiry = await Enquiry.create({
      service_id: service ? service.id : null,
      customer_id: req.user.id,
      company_profile_id: profile.id,
      notes:
        `Renewal request for ${label}. Current document expires on ${doc.expiry_date}. ` +
        `Triggered via Compliance Vault → "Renew via FliponeX".`,
      urgency: 'high',
      preferred_contact_time: null,
      status: 'new',
    });

    res.status(201).json({
      success: true,
      data: enquiry,
      message:
        `Renewal enquiry created. A FliponeX representative will reach out shortly to schedule pickup.`,
    });
  } catch (e) {
    console.error('renewCompliance error:', e);
    res.status(500).json({ success: false, message: 'Failed to create renewal enquiry' });
  }
};

// GET /api/compliance/:id/download — serve the file directly. Compliance
// docs aren't encrypted (per design — they're the customer's own copies),
// so we just stream from disk.
export const downloadCompliance = async (req, res) => {
  try {
    const doc = await VaultDocument.findByPk(req.params.id);
    if (!doc || doc.customer_id !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }
    const filePath = path.join(__dirname, '../../uploads/booking', doc.stored_name);
    if (!fs.existsSync(filePath)) {
      // Try other category folders as a last resort (legacy uploads).
      const alt = ['documents', 'kyc'].map((c) =>
        path.join(__dirname, '../../uploads/', c, doc.stored_name),
      );
      const found = alt.find((p) => fs.existsSync(p));
      if (!found) return res.status(404).json({ success: false, message: 'File not on disk' });
      return res.sendFile(found);
    }
    res.sendFile(filePath);
  } catch (e) {
    console.error('downloadCompliance error:', e);
    res.status(500).json({ success: false, message: 'Failed to download document' });
  }
};

export { computeStatus };
