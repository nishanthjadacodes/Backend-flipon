import { Op } from 'sequelize';
import { Ticket, User, Booking, AuditLog } from '../models/index.js';

const includes = [
  { model: User, as: 'customer', attributes: ['id', 'name', 'mobile', 'email'] },
  { model: User, as: 'assignee', attributes: ['id', 'name', 'email', 'role'] },
  { model: Booking, as: 'booking', attributes: ['id', 'status', 'booking_type'] },
];

export const listTickets = async (req, res) => {
  try {
    const { status, priority, assigned_to, q, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (assigned_to) where.assigned_to = assigned_to;
    if (q) where[Op.or] = [{ subject: { [Op.like]: `%${q}%` } }, { description: { [Op.like]: `%${q}%` } }];

    const tickets = await Ticket.findAndCountAll({
      where,
      include: includes,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });

    res.json({
      success: true,
      data: tickets.rows,
      pagination: { page: parseInt(page), limit: parseInt(limit), total: tickets.count },
    });
  } catch (err) {
    console.error('listTickets error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch tickets' });
  }
};

export const getTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findByPk(req.params.id, { include: includes });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    res.json({ success: true, data: ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch ticket' });
  }
};

export const createTicket = async (req, res) => {
  try {
    const { subject, description, priority, category, customer_id, booking_id } = req.body;
    if (!subject) return res.status(400).json({ success: false, message: 'Subject is required' });
    const ticket = await Ticket.create({
      subject, description, priority, category, customer_id, booking_id,
      created_by: req.user?.id,
      status: 'open',
    });
    await AuditLog.record({ actor: req.user, action: 'ticket.create', resource_type: 'ticket', resource_id: ticket.id });
    res.status(201).json({ success: true, data: ticket });
  } catch (err) {
    console.error('createTicket error:', err);
    res.status(500).json({ success: false, message: 'Failed to create ticket' });
  }
};

export const updateTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findByPk(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    const allowed = ['subject', 'description', 'status', 'priority', 'category', 'assigned_to', 'resolution_note'];
    const updates = {};
    allowed.forEach((k) => { if (k in req.body) updates[k] = req.body[k]; });
    if (updates.status === 'resolved' && !ticket.resolved_at) updates.resolved_at = new Date();
    await ticket.update(updates);
    await AuditLog.record({ actor: req.user, action: 'ticket.update', resource_type: 'ticket', resource_id: ticket.id, metadata: updates });
    res.json({ success: true, data: ticket });
  } catch (err) {
    console.error('updateTicket error:', err);
    res.status(500).json({ success: false, message: 'Failed to update ticket' });
  }
};

export const ticketStats = async (req, res) => {
  try {
    const [open, inProgress, resolved, urgent] = await Promise.all([
      Ticket.count({ where: { status: 'open' } }),
      Ticket.count({ where: { status: 'in_progress' } }),
      Ticket.count({ where: { status: 'resolved' } }),
      Ticket.count({ where: { priority: 'urgent', status: { [Op.notIn]: ['resolved', 'closed'] } } }),
    ]);
    res.json({ success: true, data: { open, inProgress, resolved, urgent } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load ticket stats' });
  }
};
