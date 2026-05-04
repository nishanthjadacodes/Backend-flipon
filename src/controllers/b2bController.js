import { Op } from 'sequelize';
import { Booking, Enquiry, CompanyProfile, User, Service, AuditLog } from '../models/index.js';
import { sendPushNotification } from '../services/notificationService.js';
import { getIoInstance } from '../config/socket.js';

// Friendly label used in push notification copy for each milestone.
const MILESTONE_LABELS = {
  application_submitted: 'Application Submitted',
  under_review: 'Under Review',
  inspection: 'Inspection Scheduled',
  noc_issued: 'NOC Issued',
};

// B2B pipeline = industrial enquiries + industrial bookings grouped by stage.
//
// Customers first create an Enquiry (pending → quoted → accepted), then an
// accepted enquiry converts into a Booking (booking_type='industrial') which
// drives the milestone flow. Both lifecycles feed the same kanban so B2B
// Admin can work the case from first submission through NOC issuance.
//
// Stages:
//   application_submitted → enquiries in pending/quoted + bookings not yet moved
//   under_review          → accepted enquiries / bookings in assigned|accepted|documents_collected
//   inspection            → bookings with submission_details.inspection_at set
//   noc_issued            → bookings with submission_details.noc_status === 'issued'
//   completed             → booking.status === 'completed'
//   cancelled             → booking/enquiry cancelled|rejected
export const b2bPipeline = async (req, res) => {
  try {
    const [bookings, enquiries] = await Promise.all([
      Booking.findAll({
        where: { booking_type: 'industrial' },
        include: [
          { model: Service, as: 'service', attributes: ['id', 'name', 'category'] },
          { model: User, as: 'agent', attributes: ['id', 'name'] },
          { model: User, as: 'customer', attributes: ['id', 'name', 'email'] },
        ],
        order: [['created_at', 'DESC']],
        limit: 500,
      }),
      Enquiry.findAll({
        // Surface every "open" enquiry plus accepted ones that haven't
        // been converted to a booking yet. Accepted enquiries are the
        // signal to the admin that they need to click Convert-to-Booking;
        // we filter out any whose booking has already been created
        // further down to avoid duplicate cards.
        where: { status: { [Op.in]: ['pending', 'quoted', 'accepted', 'rejected'] } },
        include: [
          { model: Service, as: 'service', attributes: ['id', 'name', 'category'] },
          { model: User, as: 'customer', attributes: ['id', 'name', 'email'] },
          { model: CompanyProfile, as: 'companyProfile', attributes: ['id', 'legal_entity_name', 'brand_name', 'gstin'] },
        ],
        order: [['created_at', 'DESC']],
        limit: 500,
      }),
    ]);

    const stages = {
      application_submitted: [],
      under_review: [],
      inspection: [],
      noc_issued: [],
      completed: [],
      cancelled: [],
    };

    // Build a Set of enquiry IDs that already have a corresponding booking
    // — the Convert-to-Booking action stamps "enquiry:<id>" into the
    // booking's notes. Without this filter, an accepted enquiry plus its
    // converted booking would show as two cards in the same column.
    const convertedEnquiryIds = new Set();
    bookings.forEach((b) => {
      const m = String(b.notes || '').match(/enquiry:([0-9a-f-]{8,})/i);
      if (m) convertedEnquiryIds.add(m[1]);
    });

    // Normalise enquiry rows to a "card" shape the frontend can render
    // alongside booking cards. Marked with kind:'enquiry' so the UI can
    // show a distinct badge + quote/accept actions. Quote fields are
    // included so the detail panel can show the quoted total + cycle
    // when the admin opens an accepted enquiry to convert it.
    enquiries.forEach((e) => {
      // Skip accepted enquiries that have already been converted into a
      // booking — the booking card is now the source of truth for them.
      if (e.status === 'accepted' && convertedEnquiryIds.has(e.id)) return;

      const card = {
        kind: 'enquiry',
        id: e.id,
        status: e.status,
        created_at: e.created_at,
        price_quoted: e.quote_service_fee || null,
        service: e.service,
        customer: e.customer,
        company: e.companyProfile,
        urgency: e.urgency,
        notes: e.notes || null,
        quote_service_fee: e.quote_service_fee,
        quote_govt_fees: e.quote_govt_fees,
        quote_cycle: e.quote_cycle,
        quote_valid_until: e.quote_valid_until,
        quote_terms: e.quote_terms,
      };
      if (e.status === 'rejected') stages.cancelled.push(card);
      else stages.application_submitted.push(card);
    });

    // Booking cards — same existing logic, tagged kind:'booking' for the UI.
    bookings.forEach((b) => {
      const sd = b.submission_details || {};
      const card = Object.assign({ kind: 'booking' }, b.toJSON());
      if (b.status === 'completed') stages.completed.push(card);
      else if (b.status === 'cancelled') stages.cancelled.push(card);
      else if (sd.noc_status === 'issued') stages.noc_issued.push(card);
      else if (sd.inspection_at) stages.inspection.push(card);
      else if (['assigned', 'accepted', 'documents_collected'].includes(b.status)) stages.under_review.push(card);
      else stages.application_submitted.push(card);
    });

    res.json({ success: true, data: stages });
  } catch (err) {
    console.error('b2bPipeline error:', err);
    res.status(500).json({ success: false, message: 'Failed to load B2B pipeline' });
  }
};

// Move a B2B case to a named milestone — updates submission_details JSON and
// fires an automated client notification per the PDF's Industrial Liaisoning
// Tracker spec ("Triggering automated notifications to the client").
export const updateMilestone = async (req, res) => {
  try {
    const { id } = req.params;
    const { milestone, note } = req.body;
    const allowed = ['application_submitted', 'under_review', 'inspection', 'noc_issued'];
    if (!allowed.includes(milestone)) {
      return res.status(400).json({ success: false, message: `Invalid milestone. Allowed: ${allowed.join(', ')}` });
    }
    const booking = await Booking.findByPk(id, {
      include: [
        { model: Service, as: 'service', attributes: ['id', 'name', 'category'] },
        { model: User, as: 'customer', attributes: ['id', 'name'] },
      ],
    });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.booking_type !== 'industrial') {
      return res.status(400).json({ success: false, message: 'Only industrial bookings have milestones' });
    }
    const sd = booking.submission_details || {};
    const now = new Date().toISOString();
    if (milestone === 'inspection') sd.inspection_at = now;
    if (milestone === 'noc_issued') { sd.noc_status = 'issued'; sd.noc_issued_at = now; }
    sd.milestone = milestone;
    sd.milestone_note = note || null;
    sd.milestone_updated_at = now;
    sd.milestone_updated_by = req.user?.id || null;

    await booking.update({ submission_details: sd });
    await AuditLog.record({
      actor: req.user,
      action: `b2b.milestone.${milestone}`,
      resource_type: 'booking',
      resource_id: id,
      metadata: { milestone, note: note || null },
    });

    // Automated client notification — push + socket.
    const label = MILESTONE_LABELS[milestone] || milestone;
    const serviceName = booking.service?.name || 'Your industrial file';
    const notifyResult = { socket: false, push: { success: false, message: null } };

    try {
      const io = getIoInstance();
      if (io && booking.customer_id) {
        io.to(`user_${booking.customer_id}`).emit('milestone_update', {
          bookingId: booking.id,
          milestone,
          label,
          note: note || null,
          serviceName,
          timestamp: now,
        });
        notifyResult.socket = true;
      }
    } catch (e) {
      console.warn('[updateMilestone] socket emit failed:', e?.message);
    }

    if (booking.customer_id) {
      try {
        const pushResult = await sendPushNotification(booking.customer_id, {
          title: `Update · ${label}`,
          message: note
            ? `${serviceName}: ${note}`
            : `${serviceName} has moved to "${label}".`,
          data: {
            type: 'milestone_update',
            bookingId: booking.id,
            milestone,
          },
          priority: 'high',
        });
        notifyResult.push = {
          success: !!pushResult?.success,
          message: pushResult?.message || null,
        };
      } catch (e) {
        console.warn('[updateMilestone] push failed:', e?.message);
        notifyResult.push = { success: false, message: e?.message || 'push failed' };
      }
    }

    res.json({
      success: true,
      data: booking,
      notification: notifyResult,
    });
  } catch (err) {
    console.error('updateMilestone error:', err);
    res.status(500).json({ success: false, message: 'Failed to update milestone' });
  }
};
