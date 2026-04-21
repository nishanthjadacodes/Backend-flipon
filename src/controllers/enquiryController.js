import { Enquiry, EnquiryStage, Service, CompanyProfile, User } from '../models/index.js';
import { getStageTemplate } from '../services/stageTemplates.js';
import { sendPushNotification } from '../services/notificationService.js';

// Helper — fire-and-forget push notification. Never blocks the API response
// or throws up into the request handler.
const notifyCustomerAsync = (customerId, title, body, data = {}) => {
  sendPushNotification(customerId, { title, body, data, priority: 'high' })
    .then((r) => {
      if (!r?.success) console.log('[push] notify failed:', r?.message);
    })
    .catch((e) => console.log('[push] notify error:', e?.message));
};

// Bulk-insert the default stage pipeline for a newly-created enquiry.
// Runs once at enquiry creation time; the first stage is auto-marked
// `in_progress` so the customer sees immediate feedback on the tracker.
const seedDefaultStages = async (enquiry, service) => {
  try {
    const template = getStageTemplate(service);
    const rows = template.map((s, idx) => ({
      enquiry_id: enquiry.id,
      sequence: idx,
      stage_key: s.stage_key,
      label: s.label,
      description: s.description || null,
      status: idx === 0 ? 'in_progress' : 'pending',
      started_at: idx === 0 ? new Date() : null,
    }));
    await EnquiryStage.bulkCreate(rows);
  } catch (e) {
    // Don't fail the enquiry creation because of a stage-seed hiccup.
    console.error('seedDefaultStages failed:', e?.message);
  }
};

// ─── POST /api/enquiries ────────────────────────────────────────────────────
// Customer submits a quote request for an industrial service.
export const createEnquiry = async (req, res) => {
  try {
    const { service_id, notes, urgency, preferred_contact_time } = req.body;
    if (!service_id) {
      return res.status(400).json({ success: false, message: 'service_id is required' });
    }

    const service = await Service.findOne({ where: { id: service_id, is_active: true } });
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }
    if (service.pricing_model !== 'quote') {
      return res.status(400).json({
        success: false,
        message: 'This service uses fixed pricing — please book it directly instead.',
      });
    }

    const [profile, user] = await Promise.all([
      CompanyProfile.findOne({ where: { user_id: req.user.id } }),
      User.findByPk(req.user.id, { attributes: ['id', 'nda_accepted_at'] }),
    ]);
    if (!profile) {
      return res.status(412).json({
        success: false,
        code: 'PROFILE_REQUIRED',
        message: 'Please complete your company profile first.',
      });
    }
    if (!user?.nda_accepted_at) {
      return res.status(412).json({
        success: false,
        code: 'NDA_REQUIRED',
        message: 'Please accept the Digital NDA first.',
      });
    }

    const enquiry = await Enquiry.create({
      customer_id: req.user.id,
      service_id,
      company_profile_id: profile.id,
      notes: notes || null,
      urgency: ['standard', 'urgent', 'fast_track'].includes(urgency) ? urgency : 'standard',
      preferred_contact_time: preferred_contact_time || null,
      status: 'pending',
    });

    // Seed the stage pipeline so the tracker has data immediately.
    await seedDefaultStages(enquiry, service);

    notifyCustomerAsync(
      req.user.id,
      'Enquiry Submitted',
      `Your enquiry for ${service.name} is in the queue for review.`,
      { type: 'enquiry', enquiry_id: enquiry.id, action: 'submitted' },
    );

    res.status(201).json({ success: true, data: enquiry });
  } catch (error) {
    console.error('createEnquiry error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit enquiry' });
  }
};

// ─── GET /api/enquiries/mine ────────────────────────────────────────────────
export const getMyEnquiries = async (req, res) => {
  try {
    const enquiries = await Enquiry.findAll({
      where: { customer_id: req.user.id },
      order: [['created_at', 'DESC']],
      include: [
        { model: Service, as: 'service', attributes: ['id', 'name', 'category'] },
      ],
    });
    res.json({ success: true, data: enquiries });
  } catch (error) {
    console.error('getMyEnquiries error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch enquiries' });
  }
};

// ─── POST /api/admin/enquiries/:id/quote ────────────────────────────────────
// B2B / Super Admin issues the quote. Transitions enquiry pending → quoted
// and fires an Expo push to the customer so they see it in-app immediately.
export const issueQuoteAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      service_fee,
      govt_fees = 0,
      cycle = 'one_time',
      valid_until,     // ISO date string
      terms,
    } = req.body || {};

    if (service_fee === undefined || service_fee === null || Number.isNaN(Number(service_fee))) {
      return res.status(400).json({ success: false, message: 'service_fee (number) is required' });
    }
    if (!['one_time', 'monthly', 'quarterly', 'half_yearly', 'annual'].includes(cycle)) {
      return res.status(400).json({ success: false, message: 'Invalid cycle' });
    }

    const enquiry = await Enquiry.findByPk(id);
    if (!enquiry) return res.status(404).json({ success: false, message: 'Enquiry not found' });
    if (!['pending', 'quoted'].includes(enquiry.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot issue quote for enquiry in "${enquiry.status}" status`,
      });
    }

    await enquiry.update({
      quote_service_fee: Number(service_fee),
      quote_govt_fees: Number(govt_fees) || 0,
      quote_cycle: cycle,
      quote_valid_until: valid_until ? new Date(valid_until) : null,
      quote_terms: terms || null,
      quote_issued_at: new Date(),
      assigned_admin_id: req.user?.id || null,
      status: 'quoted',
    });

    notifyCustomerAsync(
      enquiry.customer_id,
      'Quote received',
      `Your industrial enquiry has been quoted. Open the app to review and accept.`,
      { type: 'enquiry_quoted', enquiryId: enquiry.id }
    );

    res.json({ success: true, data: enquiry, message: 'Quote issued' });
  } catch (error) {
    console.error('issueQuoteAdmin error:', error);
    res.status(500).json({ success: false, message: 'Failed to issue quote' });
  }
};

// ─── POST /api/admin/enquiries/:id/reject ───────────────────────────────────
// Admin declines to serve the enquiry (outside scope, compliance block, etc.).
export const rejectEnquiryAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    const enquiry = await Enquiry.findByPk(id);
    if (!enquiry) return res.status(404).json({ success: false, message: 'Enquiry not found' });
    if (['accepted', 'in_progress', 'completed'].includes(enquiry.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot reject an enquiry already in "${enquiry.status}" status`,
      });
    }

    await enquiry.update({
      status: 'rejected',
      quote_terms: reason ? `Rejected: ${reason}` : 'Rejected by admin',
      responded_at: new Date(),
      assigned_admin_id: req.user?.id || null,
    });

    notifyCustomerAsync(
      enquiry.customer_id,
      'Enquiry declined',
      reason ? `Your enquiry was declined: ${reason}` : 'Your enquiry was declined by the team.',
      { type: 'enquiry_rejected', enquiryId: enquiry.id }
    );

    res.json({ success: true, data: enquiry, message: 'Enquiry rejected' });
  } catch (error) {
    console.error('rejectEnquiryAdmin error:', error);
    res.status(500).json({ success: false, message: 'Failed to reject enquiry' });
  }
};

// ─── GET /api/admin/enquiries ───────────────────────────────────────────────
// Admin-scoped listing — every enquiry across the platform. Used by the
// B2B/Industrial Admin panel to surface enquiries for pipeline + vault work.
export const listAllEnquiriesForAdmin = async (req, res) => {
  try {
    const { status, urgency, limit = 200, page = 1 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (urgency) where.urgency = urgency;

    const enquiries = await Enquiry.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      include: [
        { model: Service, as: 'service', attributes: ['id', 'name', 'category'] },
        { model: CompanyProfile, as: 'companyProfile', attributes: ['id', 'legal_entity_name', 'brand_name', 'gstin'] },
      ],
      limit: parseInt(limit, 10),
      offset: (parseInt(page, 10) - 1) * parseInt(limit, 10),
    });

    res.json({
      success: true,
      data: enquiries.rows,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: enquiries.count,
      },
    });
  } catch (error) {
    console.error('listAllEnquiriesForAdmin error:', error);
    res.status(500).json({ success: false, message: 'Failed to list enquiries' });
  }
};

// ─── GET /api/enquiries/:id ─────────────────────────────────────────────────
export const getEnquiryById = async (req, res) => {
  try {
    const enquiry = await Enquiry.findOne({
      where: { id: req.params.id, customer_id: req.user.id },
      include: [
        { model: Service, as: 'service' },
        { model: CompanyProfile, as: 'companyProfile' },
      ],
    });
    if (!enquiry) {
      return res.status(404).json({ success: false, message: 'Enquiry not found' });
    }
    res.json({ success: true, data: enquiry });
  } catch (error) {
    console.error('getEnquiryById error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch enquiry' });
  }
};

// ─── GET /api/enquiries/:id/stages ──────────────────────────────────────────
// Customer reads the stage-by-stage tracker for their enquiry.
export const getEnquiryStages = async (req, res) => {
  try {
    const enquiry = await Enquiry.findOne({
      where: { id: req.params.id, customer_id: req.user.id },
      attributes: ['id'],
    });
    if (!enquiry) return res.status(404).json({ success: false, message: 'Enquiry not found' });

    const stages = await EnquiryStage.findAll({
      where: { enquiry_id: enquiry.id },
      order: [['sequence', 'ASC']],
    });
    res.json({ success: true, data: stages });
  } catch (error) {
    console.error('getEnquiryStages error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stages' });
  }
};

// ─── PATCH /api/enquiries/:id/stages/:stageId (admin) ───────────────────────
// Admin advances or annotates a stage. Sends a push to the customer on any
// state change or note update so they see real-time progress.
export const updateEnquiryStage = async (req, res) => {
  try {
    const { status, admin_note, document_id } = req.body;

    const stage = await EnquiryStage.findByPk(req.params.stageId);
    if (!stage || stage.enquiry_id !== req.params.id) {
      return res.status(404).json({ success: false, message: 'Stage not found' });
    }

    const updates = {};
    if (status) {
      if (!['pending', 'in_progress', 'done', 'blocked', 'skipped'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
      }
      updates.status = status;
      if (status === 'in_progress' && !stage.started_at) updates.started_at = new Date();
      if (status === 'done' && !stage.completed_at) updates.completed_at = new Date();
    }
    if (admin_note !== undefined) updates.admin_note = admin_note;
    if (document_id !== undefined) updates.document_id = document_id;

    await stage.update(updates);

    // Notify the customer
    const enquiry = await Enquiry.findByPk(stage.enquiry_id, { attributes: ['id', 'customer_id'] });
    if (enquiry) {
      const verb = updates.status === 'done' ? 'completed'
        : updates.status === 'blocked' ? 'blocked'
        : updates.status === 'in_progress' ? 'started'
        : 'updated';
      notifyCustomerAsync(
        enquiry.customer_id,
        'Application Update',
        `${stage.label} — ${verb}.`,
        { type: 'enquiry', enquiry_id: enquiry.id, stage_id: stage.id, action: 'stage_update' },
      );
    }

    res.json({ success: true, data: stage });
  } catch (error) {
    console.error('updateEnquiryStage error:', error);
    res.status(500).json({ success: false, message: 'Failed to update stage' });
  }
};

// ─── POST /api/enquiries/:id/accept ─────────────────────────────────────────
export const acceptQuote = async (req, res) => {
  try {
    const enquiry = await Enquiry.findOne({
      where: { id: req.params.id, customer_id: req.user.id },
    });
    if (!enquiry) return res.status(404).json({ success: false, message: 'Enquiry not found' });
    if (enquiry.status !== 'quoted') {
      return res.status(400).json({ success: false, message: `Cannot accept — current status is '${enquiry.status}'.` });
    }
    await enquiry.update({ status: 'accepted', responded_at: new Date() });

    notifyCustomerAsync(
      enquiry.customer_id,
      'Quote Accepted',
      'We have recorded your acceptance. Invoice is on the way.',
      { type: 'enquiry', enquiry_id: enquiry.id, action: 'accepted' },
    );

    res.json({ success: true, data: enquiry });
  } catch (error) {
    console.error('acceptQuote error:', error);
    res.status(500).json({ success: false, message: 'Failed to accept quote' });
  }
};

// ─── POST /api/enquiries/:id/reject ─────────────────────────────────────────
export const rejectQuote = async (req, res) => {
  try {
    const enquiry = await Enquiry.findOne({
      where: { id: req.params.id, customer_id: req.user.id },
    });
    if (!enquiry) return res.status(404).json({ success: false, message: 'Enquiry not found' });
    if (enquiry.status !== 'quoted') {
      return res.status(400).json({ success: false, message: `Cannot reject — current status is '${enquiry.status}'.` });
    }
    await enquiry.update({ status: 'rejected', responded_at: new Date() });

    notifyCustomerAsync(
      enquiry.customer_id,
      'Enquiry Rejected',
      'You have rejected the quote. Submit a new enquiry if you change your mind.',
      { type: 'enquiry', enquiry_id: enquiry.id, action: 'rejected' },
    );

    res.json({ success: true, data: enquiry });
  } catch (error) {
    console.error('rejectQuote error:', error);
    res.status(500).json({ success: false, message: 'Failed to reject quote' });
  }
};

// ─── POST /api/enquiries/:id/cancel ─────────────────────────────────────────
export const cancelEnquiry = async (req, res) => {
  try {
    const enquiry = await Enquiry.findOne({
      where: { id: req.params.id, customer_id: req.user.id },
    });
    if (!enquiry) return res.status(404).json({ success: false, message: 'Enquiry not found' });
    if (!['pending', 'quoted'].includes(enquiry.status)) {
      return res.status(400).json({ success: false, message: 'Enquiry is already in progress or completed.' });
    }
    await enquiry.update({ status: 'cancelled' });

    notifyCustomerAsync(
      enquiry.customer_id,
      'Enquiry Cancelled',
      'Your enquiry has been cancelled.',
      { type: 'enquiry', enquiry_id: enquiry.id, action: 'cancelled' },
    );

    res.json({ success: true, data: enquiry });
  } catch (error) {
    console.error('cancelEnquiry error:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel enquiry' });
  }
};
