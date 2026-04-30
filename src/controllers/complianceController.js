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
//
// Two callers per spec ("agent or client enters the expiry date"):
//
//   1. Customer uploading their own doc — req.user.role === 'customer'.
//      `customer_id` from req.user.id; profile looked up from req.user.id.
//
//   2. Representative uploading on behalf of a customer (e.g., during a
//      Fire NOC renewal visit) — req.user.role === 'agent' (or admin).
//      Caller must include `customer_id` in the body. We trust the caller's
//      expiry_date entry as the authoritative renewal date.
//
// Reuses the standard `uploadSingle` middleware so file lands in
// /uploads/<category>/. Encryption is NOT applied here (these are the
// customer's own copies they preview from the app). Sensitive admin-issued
// docs still go through the encrypted /api/vault/upload path.
export const uploadCompliance = [
  // first run the multer middleware
  uploadSingle,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
      }
      const { compliance_type, expiry_date, note, customer_id: bodyCustomerId } = req.body;
      if (!compliance_type) {
        return res.status(400).json({ success: false, message: 'compliance_type is required' });
      }
      if (!expiry_date) {
        return res.status(400).json({ success: false, message: 'expiry_date is required' });
      }

      // Decide whose document this is.
      // - 'agent' / admin roles can pass an explicit customer_id to upload
      //   on the customer's behalf.
      // - Everyone else (the typical customer-app caller) uploads for self.
      const STAFF_ROLES = new Set([
        'agent',
        'super_admin',
        'operations_manager',
        'b2b_admin',
        'finance_admin',
        'customer_support',
      ]);
      const isStaff = STAFF_ROLES.has(String(req.user?.role || ''));
      const targetCustomerId =
        isStaff && bodyCustomerId ? bodyCustomerId : req.user.id;

      const profile = await CompanyProfile.findOne({ where: { user_id: targetCustomerId } });
      if (!profile) {
        // Clean up the orphan file if profile is missing.
        try { fs.unlinkSync(req.file.path); } catch (_) {}
        return res.status(400).json({
          success: false,
          message: isStaff && bodyCustomerId
            ? "This customer hasn't filled their company profile yet — they need to do that before you can upload compliance docs on their behalf."
            : 'Fill your company profile before uploading compliance documents.',
        });
      }

      const fakeIv = crypto.randomBytes(6).toString('hex');
      const fakeTag = crypto.randomBytes(8).toString('hex');

      const doc = await VaultDocument.create({
        enquiry_id: null,
        company_profile_id: profile.id,
        customer_id: targetCustomerId,
        // uploaded_by always tracks who actually pressed Upload (audit trail).
        // For rep uploads this is the rep's id, not the customer's.
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

    // Pick the best matching service. Try in order of specificity:
    //   1. Industrial service whose name contains the compliance label
    //   2. Any active industrial/both service
    //   3. Any active service at all (Enquiry.service_id is allowNull:false
    //      so we MUST end up with something — better a generic match than 500)
    const label = COMPLIANCE_LABELS[doc.compliance_type] || doc.compliance_type;
    const service =
      (await Service.findOne({
        where: {
          is_active: true,
          service_type: { [sequelize.Sequelize.Op.in]: ['industrial', 'both'] },
          name: { [sequelize.Sequelize.Op.like]: `%${label.split(' ')[0]}%` },
        },
      })) ||
      (await Service.findOne({
        where: {
          is_active: true,
          service_type: { [sequelize.Sequelize.Op.in]: ['industrial', 'both'] },
        },
      })) ||
      (await Service.findOne({ where: { is_active: true } }));

    if (!service) {
      // No services at all in the DB — surface a clear error to the caller
      // rather than letting Sequelize blow up on the NOT NULL constraint.
      return res.status(500).json({
        success: false,
        message:
          'No services are configured in the system. An admin needs to add at least one service before renewals can be raised.',
      });
    }

    // Auto-assign an available representative so they get instantly pinged
    // to call the customer and schedule pickup. Preference order:
    //   1. Online + active + KYC-verified rep (best — immediately available)
    //   2. Active + KYC-verified rep (good — they'll see it on next app open)
    //   3. None (admin will assign manually from B2B Pipeline)
    let autoAssignedRep = null;
    try {
      autoAssignedRep =
        (await User.findOne({
          where: {
            role: 'agent',
            is_active: true,
            is_kyc_verified: true,
            online_status: true,
          },
          order: [['rating', 'DESC'], ['total_jobs_completed', 'DESC']],
        })) ||
        (await User.findOne({
          where: { role: 'agent', is_active: true, is_kyc_verified: true },
          order: [['rating', 'DESC'], ['total_jobs_completed', 'DESC']],
        }));
    } catch (e) {
      console.warn('[compliance/renew] auto-assign lookup failed:', e?.message);
    }

    // Enquiry.status enum: pending | quoted | accepted | rejected |
    //                      in_progress | completed | cancelled
    // Enquiry.urgency enum: standard | urgent | fast_track
    // (Anything outside these values throws a Sequelize 500.)
    const enquiry = await Enquiry.create({
      service_id: service.id,
      customer_id: req.user.id,
      company_profile_id: profile.id,
      notes:
        `Renewal request for ${label}. Current document expires on ${doc.expiry_date}. ` +
        `Triggered via Compliance Vault → "Renew via FliponeX". ` +
        `Auto-assigned rep: ${autoAssignedRep ? autoAssignedRep.name || autoAssignedRep.id : 'none yet (admin to assign)'}.`,
      urgency: 'urgent',
      preferred_contact_time: null,
      status: 'pending',
      assigned_admin_id: autoAssignedRep ? autoAssignedRep.id : null,
    });

    // Push-notify the assigned rep so they call back immediately. Wrapped in
    // try/catch — never fail the renewal if the push gateway is down.
    if (autoAssignedRep) {
      try {
        const { sendPushNotification } = await import('../services/notificationService.js');
        await sendPushNotification(autoAssignedRep.id, {
          title: '🔔 New Compliance Renewal Lead',
          message: `${label} renewal needed. Customer is waiting — call to schedule pickup.`,
          data: {
            type: 'compliance_renewal_lead',
            enquiry_id: enquiry.id,
            compliance_type: doc.compliance_type,
            customer_id: req.user.id,
          },
          priority: 'high',
        });
      } catch (e) {
        console.warn('[compliance/renew] push to rep failed:', e?.message);
      }
    }

    const repName = autoAssignedRep
      ? autoAssignedRep.name || 'Your assigned representative'
      : null;

    res.status(201).json({
      success: true,
      data: enquiry,
      autoAssignedRep: autoAssignedRep
        ? { id: autoAssignedRep.id, name: autoAssignedRep.name, mobile: autoAssignedRep.mobile }
        : null,
      message: repName
        ? `${repName} has been assigned and will call you shortly to schedule document pickup.`
        : `Renewal logged. A FliponeX representative will reach out shortly to schedule pickup.`,
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
