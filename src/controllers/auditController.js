import { Op } from 'sequelize';
import { AuditLog } from '../models/index.js';

export const listAuditLogs = async (req, res) => {
  try {
    const { action, resource_type, actor_id, from, to, page = 1, limit = 50 } = req.query;
    const where = {};
    if (action) where.action = action;
    if (resource_type) where.resource_type = resource_type;
    if (actor_id) where.actor_id = actor_id;
    if (from || to) {
      where.created_at = {};
      if (from) where.created_at[Op.gte] = new Date(from);
      if (to) where.created_at[Op.lte] = new Date(to);
    }

    const rows = await AuditLog.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });

    res.json({
      success: true,
      data: rows.rows,
      pagination: { page: parseInt(page), limit: parseInt(limit), total: rows.count },
    });
  } catch (err) {
    console.error('listAuditLogs error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch audit logs' });
  }
};
