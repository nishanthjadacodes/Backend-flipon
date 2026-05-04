import { Enquiry, EnquiryStage, Service, CompanyProfile, User, Booking, sequelize } from '../models/index.js';
import { Op } from 'sequelize';
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
// Customer accepts the quote we sent earlier. Three things happen:
//   1. Enquiry.status flips quoted → accepted.
//   2. We push a confirmation back to the customer (kept brief; no
//      payment-method copy here — admin handles the next step).
//   3. We push every admin so they know to assign a rep / convert
//      this enquiry into a Booking.
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
      'Acceptance recorded. Our admin will assign a service representative shortly.',
      { type: 'enquiry', enquiry_id: enquiry.id, action: 'accepted' },
    );

    // Notify every admin — fire-and-forget, never blocks the response.
    (async () => {
      try {
        const customer = await User.findByPk(enquiry.customer_id, { attributes: ['name'] });
        const service = enquiry.service_id
          ? await Service.findByPk(enquiry.service_id, { attributes: ['name'] })
          : null;
        const ADMIN_ROLES = [
          'super_admin', 'operations_manager', 'b2b_admin',
          'finance_admin', 'customer_support',
        ];
        const admins = await User.findAll({
          where: { role: { [Op.in]: ADMIN_ROLES }, is_active: true },
          attributes: ['id'],
        });
        const title = '✅ Quote accepted';
        const body = `${customer?.name || 'Customer'} accepted the quote for ${service?.name || 'an industrial service'}. Convert to a Booking and assign a rep.`;
        await Promise.all(
          admins.map((a) =>
            sendPushNotification(a.id, {
              title, body,
              data: { type: 'enquiry_accepted', enquiry_id: enquiry.id },
              priority: 'high',
            }).catch(() => {}),
          ),
        );
      } catch (e) {
        console.log('[acceptQuote] admin fanout failed:', e?.message);
      }
    })();

    res.json({ success: true, data: enquiry });
  } catch (error) {
    console.error('acceptQuote error:', error);
    res.status(500).json({ success: false, message: 'Failed to accept quote' });
  }
};

// ─── POST /api/admin/enquiries/:id/convert-to-booking ───────────────────────
// Once the customer accepts the quote, an admin "promotes" the enquiry
// into a Booking row so the standard rep-assignment + execution flow
// can take over. Idempotent: if a booking already exists for this
// enquiry (matched on Booking.notes containing the enquiry id, since
// we don't have a foreign-key column yet), the existing one is returned.
export const convertEnquiryToBooking = async (req, res) => {
  try {
    const enquiry = await Enquiry.findByPk(req.params.id);
    if (!enquiry) return res.status(404).json({ success: false, message: 'Enquiry not found' });
    if (enquiry.status !== 'accepted') {
      return res.status(400).json({
        success: false,
        message: `Cannot convert — enquiry status is '${enquiry.status}', expected 'accepted'.`,
      });
    }
    if (!enquiry.service_id) {
      return res.status(400).json({
        success: false,
        message: 'Enquiry has no service_id — cannot create booking.',
      });
    }

    // Reuse if a booking was already converted (avoid duplicate Booking
    // rows when the admin double-clicks).
    const existing = await Booking.findOne({
      where: {
        customer_id: enquiry.customer_id,
        service_id: enquiry.service_id,
        notes: { [Op.like]: `%enquiry:${enquiry.id}%` },
      },
    });
    if (existing) {
      return res.json({
        success: true,
        data: existing,
        message: 'Booking already exists for this enquiry.',
      });
    }

    // Compute next booking_number — best-effort, NULL on failure.
    let bookingNumber = null;
    try {
      const [rows] = await sequelize.query(
        'SELECT COALESCE(MAX(booking_number), 0) + 1 AS next FROM bookings',
      );
      bookingNumber = rows?.[0]?.next || null;
    } catch (_) { /* fall through with NULL */ }

    const customer = await User.findByPk(enquiry.customer_id, {
      attributes: ['name', 'mobile', 'email'],
    });

    const totalQuoted =
      Number(enquiry.quote_service_fee || 0) + Number(enquiry.quote_govt_fees || 0);

    const booking = await Booking.create({
      customer_id: enquiry.customer_id,
      service_id: enquiry.service_id,
      booking_type: 'industrial',
      customer_name: customer?.name || null,
      customer_mobile: customer?.mobile || null,
      customer_email: customer?.email || null,
      service_address: 'To be confirmed by representative',
      status: 'pending',                 // ready for admin to assign a rep
      price_quoted: totalQuoted,
      priority: enquiry.urgency === 'urgent' ? 'urgent'
                : enquiry.urgency === 'fast_track' ? 'high'
                : 'medium',
      booking_number: bookingNumber,
      notes: [
        `Converted from B2B enquiry:${enquiry.id}`,
        enquiry.notes ? `Customer notes: ${enquiry.notes}` : null,
        enquiry.quote_terms ? `Quoted terms: ${enquiry.quote_terms}` : null,
        enquiry.quote_cycle ? `Billing cycle: ${enquiry.quote_cycle}` : null,
      ].filter(Boolean).join('\n'),
    });

    // Tell the customer their job is officially in the work queue.
    notifyCustomerAsync(
      enquiry.customer_id,
      '🚀 Work scheduled',
      'Admin has scheduled your service. A representative will be assigned shortly.',
      { type: 'booking_created', booking_id: booking.id, enquiry_id: enquiry.id },
    );

    res.json({
      success: true,
      data: booking,
      message: 'Enquiry converted to booking. Assign a representative from Order Management.',
    });
  } catch (error) {
    console.error('convertEnquiryToBooking error:', error);
    res.status(500).json({ success: false, message: 'Failed to convert enquiry' });
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
