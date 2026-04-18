import { Enquiry, Service, CompanyProfile, User } from '../models/index.js';

// ─── POST /api/enquiries ────────────────────────────────────────────────────
// Customer submits a quote request for an industrial service.
export const createEnquiry = async (req, res) => {
  try {
    const { service_id, notes, urgency, preferred_contact_time } = req.body;
    if (!service_id) {
      return res.status(400).json({ success: false, message: 'service_id is required' });
    }

    // Gate — only quote-based services can be enquired. Fixed-price services
    // must go through the Booking flow instead.
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

    // NDA + Company Profile gate — enforced here so the API can't be called
    // out-of-band to bypass the mobile-app checks.
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
    res.json({ success: true, data: enquiry });
  } catch (error) {
    console.error('cancelEnquiry error:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel enquiry' });
  }
};
