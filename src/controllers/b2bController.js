import { Op } from 'sequelize';
import { Booking, User, Service, AuditLog } from '../models/index.js';

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

// Move a B2B case to a named milestone — updates submission_details JSON.
export const updateMilestone = async (req, res) => {
  try {
    const { id } = req.params;
    const { milestone, note } = req.body;
    const allowed = ['application_submitted', 'under_review', 'inspection', 'noc_issued'];
    if (!allowed.includes(milestone)) {
      return res.status(400).json({ success: false, message: `Invalid milestone. Allowed: ${allowed.join(', ')}` });
    }
    const booking = await Booking.findByPk(id);
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
    await booking.update({ submission_details: sd });
    await AuditLog.record({ actor: req.user, action: `b2b.milestone.${milestone}`, resource_type: 'booking', resource_id: id });
    res.json({ success: true, data: booking });
  } catch (err) {
    console.error('updateMilestone error:', err);
    res.status(500).json({ success: false, message: 'Failed to update milestone' });
  }
};
