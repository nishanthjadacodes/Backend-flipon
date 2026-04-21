import { PlatformConfig, AuditLog } from '../models/index.js';

// Keys the admin panel shows / edits. Adding a new key here is all that's
// needed to surface it in the UI — GET returns this list, PUT accepts any
// subset of it. Secret fields are masked on read so Razorpay keys (etc.)
// can be stored without leaking through to the frontend.
const CONFIG_SCHEMA = [
  { key: 'payment_gateway_provider', label: 'Payment gateway provider', type: 'enum', options: ['razorpay', 'stripe', 'disabled'], default: 'razorpay' },
  { key: 'payment_gateway_mode', label: 'Gateway mode', type: 'enum', options: ['test', 'live'], default: 'test' },
  { key: 'razorpay_key_id', label: 'Razorpay key ID', type: 'string', default: '' },
  { key: 'razorpay_key_secret', label: 'Razorpay key secret', type: 'string', default: '', secret: true },
  { key: 'tax_percentage', label: 'Tax percentage', type: 'number', default: '18' },
  { key: 'royalty_percentage', label: 'Monthly royalty percentage', type: 'number', default: '2' },
  { key: 'agent_commission_percentage', label: 'Default agent commission percentage', type: 'number', default: '70' },
  { key: 'urgent_surcharge_percentage', label: 'Urgent request surcharge percentage', type: 'number', default: '25' },
];

const MASK = '••••••••';

const serialize = (row, schemaEntry) => ({
  key: row.key,
  value: row.is_secret ? (row.value ? MASK : '') : (row.value ?? ''),
  label: schemaEntry?.label || row.key,
  type: schemaEntry?.type || 'string',
  options: schemaEntry?.options || null,
  is_secret: row.is_secret,
  has_value: Boolean(row.value),
  updated_at: row.updated_at,
});

export const getConfig = async (req, res) => {
  try {
    const rows = await PlatformConfig.findAll();
    const byKey = new Map(rows.map((r) => [r.key, r]));

    const data = CONFIG_SCHEMA.map((entry) => {
      const row = byKey.get(entry.key);
      if (row) return serialize(row, entry);
      return {
        key: entry.key,
        value: entry.secret ? '' : String(entry.default ?? ''),
        label: entry.label,
        type: entry.type,
        options: entry.options || null,
        is_secret: !!entry.secret,
        has_value: false,
        updated_at: null,
      };
    });

    res.json({ success: true, data });
  } catch (err) {
    console.error('getConfig error:', err);
    res.status(500).json({ success: false, message: 'Failed to load platform config' });
  }
};

export const updateConfig = async (req, res) => {
  try {
    const updates = req.body && typeof req.body === 'object' ? req.body : {};
    const schemaByKey = new Map(CONFIG_SCHEMA.map((e) => [e.key, e]));
    const applied = [];

    for (const [key, raw] of Object.entries(updates)) {
      const schemaEntry = schemaByKey.get(key);
      if (!schemaEntry) continue; // ignore unknown keys silently
      // Skip masked values — the UI sends the mask back when the field is
      // unchanged, so treat it as "keep existing".
      if (schemaEntry.secret && (raw === MASK || raw === undefined)) continue;

      let value = raw;
      if (schemaEntry.type === 'number') {
        if (raw === '' || raw === null) {
          value = null;
        } else if (!Number.isFinite(Number(raw))) {
          return res.status(400).json({ success: false, message: `"${key}" must be a number` });
        } else {
          value = String(Number(raw));
        }
      } else if (schemaEntry.type === 'enum') {
        if (raw !== null && raw !== '' && !schemaEntry.options.includes(raw)) {
          return res.status(400).json({ success: false, message: `"${key}" must be one of ${schemaEntry.options.join(', ')}` });
        }
        value = raw;
      } else {
        value = raw == null ? null : String(raw);
      }

      const existing = await PlatformConfig.findOne({ where: { key } });
      if (existing) {
        await existing.update({ value, is_secret: !!schemaEntry.secret });
      } else {
        await PlatformConfig.create({ key, value, is_secret: !!schemaEntry.secret });
      }
      applied.push(key);
    }

    await AuditLog.record({
      actor: req.user,
      action: 'platform_config.update',
      resource_type: 'platform_config',
      metadata: { keys: applied },
    });

    // Return the refreshed config so the UI updates in-place.
    return getConfig(req, res);
  } catch (err) {
    console.error('updateConfig error:', err);
    res.status(500).json({ success: false, message: 'Failed to update platform config' });
  }
};
