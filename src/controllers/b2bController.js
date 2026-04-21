import { Op } from 'sequelize';
import { Booking, User, Service, AuditLog } from '../models/index.js';
import { sendPushNotification } from '../services/notificationService.js';
import { getIoInstance } from '../config/socket.js';

// Friendly label used in push notification copy for each milestone.
const MILESTONE_LABELS = {
  application_submitted: 'Application Submitted',
  under_review: 'Under Review',
  inspection: 'Inspection Scheduled',
  noc_issued: 'NOC Issued',
};

// B2B pipeline = industrial bookings shown grouped by status stage.
// Stages map to Booking.status: pending → assigned → accepted → documents_collected → submitted → completed.
// Additional surface: NOC status is tracked via Booking.submission_details JSON.
export const b2bPipeline = async (req, res) => {
  try {
    const rows = await Booking.findAll({
      where: { booking_type: 'industrial' },
      include: [
        { model: Service, as: 'service', attributes: ['id', 'name', 'category'] },
        { model: User, as: 'agent', attributes: ['id', 'name'] },
        { model: User, as: 'customer', attributes: ['id', 'name', 'email'] },
      ],
      order: [['created_at', 'DESC']],
      limit: 500,
    });

    const stages = {
      application_submitted: [],
      under_review: [],
      inspection: [],
      noc_issued: [],
      completed: [],
      cancelled: [],
    };

    rows.forEach((b) => {
      const sd = b.submission_details || {};
      if (b.status === 'completed') stages.completed.push(b);
      else if (b.status === 'cancelled') stages.cancelled.push(b);
      else if (sd.noc_status === 'issued') stages.noc_issued.push(b);
      else if (sd.inspection_at) stages.inspection.push(b);
      else if (['assigned', 'accepted', 'documents_collected'].includes(b.status)) stages.under_review.push(b);
      else stages.application_submitted.push(b);
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
