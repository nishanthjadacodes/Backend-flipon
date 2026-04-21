import { Op } from 'sequelize';
import { Ticket, TicketMessage, User, Booking, AuditLog } from '../models/index.js';
import { sendPushNotification } from '../services/notificationService.js';
import { getIoInstance } from '../config/socket.js';

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

// GET /api/admin/tickets/:id/messages
// Returns the full chronological thread for a ticket.
export const listTicketMessages = async (req, res) => {
  try {
    const ticket = await Ticket.findByPk(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    const messages = await TicketMessage.findAll({
      where: { ticket_id: ticket.id },
      order: [['created_at', 'ASC']],
    });
    res.json({ success: true, data: messages });
  } catch (err) {
    console.error('listTicketMessages error:', err);
    res.status(500).json({ success: false, message: 'Failed to load messages' });
  }
};

// POST /api/admin/tickets/:id/messages  { body }
// Admin sends a chat message on the ticket thread. Triggers an Expo push
// notification to the linked customer so they see it in-app immediately,
// and broadcasts a socket event to any connected clients in user_<customer_id>.
export const sendTicketMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { body } = req.body || {};
    if (!body || !String(body).trim()) {
      return res.status(400).json({ success: false, message: 'Message body is required' });
    }
    const ticket = await Ticket.findByPk(id, { include: [{ model: User, as: 'customer' }] });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const msg = await TicketMessage.create({
      ticket_id: ticket.id,
      sender_id: req.user?.id || null,
      sender_role: req.user?.role || 'support',
      sender_name: req.user?.name || 'Support',
      body: String(body).trim(),
      channel: 'chat',
    });

    // Socket push for live chat UIs.
    try {
      const io = getIoInstance();
      if (io && ticket.customer_id) {
        io.to(`user_${ticket.customer_id}`).emit('ticket_message', {
          ticketId: ticket.id,
          message: msg,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.warn('[ticket_message] socket emit failed:', e?.message);
    }

    // Out-of-band notification for offline / backgrounded customer app.
    if (ticket.customer_id) {
      sendPushNotification(ticket.customer_id, {
        title: `Support · ${ticket.subject}`,
        message: String(body).trim().slice(0, 140),
        data: { type: 'ticket_message', ticketId: ticket.id },
        priority: 'high',
      }).catch((e) => console.warn('[ticket_message] push failed:', e?.message));
    }

    await AuditLog.record({
      actor: req.user,
      action: 'ticket.message.send',
      resource_type: 'ticket',
      resource_id: ticket.id,
    });

    res.status(201).json({ success: true, data: msg });
  } catch (err) {
    console.error('sendTicketMessage error:', err);
    res.status(500).json({ success: false, message: 'Failed to send message' });
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
