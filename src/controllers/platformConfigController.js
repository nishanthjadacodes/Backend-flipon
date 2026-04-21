import { PlatformConfig, AuditLog } from '../models/index.js';

// Keys the admin panel shows / edits. Adding a new key here is all that's
// needed to surface it in the UI — GET returns this list, PUT accepts any
// subset of it. Secret fields are masked on read so Razorpay keys (etc.)
// can be stored without leaking through to the frontend.
const CONFIG_SCHEMA = [
  // Financial Configuration (Super Admin — PDF section 1)
  { key: 'payment_gateway_provider', group: 'finance', label: 'Payment gateway provider', type: 'enum', options: ['razorpay', 'stripe', 'disabled'], default: 'razorpay' },
  { key: 'payment_gateway_mode', group: 'finance', label: 'Gateway mode', type: 'enum', options: ['test', 'live'], default: 'test' },
  { key: 'razorpay_key_id', group: 'finance', label: 'Razorpay key ID', type: 'string', default: '' },
  { key: 'razorpay_key_secret', group: 'finance', label: 'Razorpay key secret', type: 'string', default: '', secret: true },
  { key: 'tax_percentage', group: 'finance', label: 'Tax percentage', type: 'number', default: '18' },
  { key: 'royalty_percentage', group: 'finance', label: 'Monthly royalty percentage', type: 'number', default: '2' },
  { key: 'agent_commission_percentage', group: 'finance', label: 'Default agent commission percentage', type: 'number', default: '70' },
  { key: 'urgent_surcharge_percentage', group: 'finance', label: 'Urgent request surcharge percentage', type: 'number', default: '25' },

  // Website & App marketing copy (customer-facing PDF section)
  { key: 'brand_name', group: 'brand', label: 'Brand name', type: 'string', default: 'FliponeX' },
  { key: 'brand_tagline', group: 'brand', label: 'Headline', type: 'string', default: "India's 1 Doorstep Digital Service — At Your Home & Office!" },
  { key: 'brand_subheadline', group: 'brand', label: 'Sub-headline', type: 'text', default: 'From Aadhaar updates to Industrial Licensing, access 100+ Government and Digital Services with one click. Skip the Queues, Stay Online! Choose FliponeX.' },
  { key: 'brand_cta_primary', group: 'brand', label: 'Primary CTA', type: 'string', default: 'Download App, Book Now, Pay Later.' },
  { key: 'brand_cta_secondary', group: 'brand', label: 'Secondary CTA', type: 'string', default: 'Safe · Secure · Reliable — Stop Waiting in Queues, Book FliponeX.' },

  // Core value propositions (stored as a single editable block)
  { key: 'value_props', group: 'brand', label: 'Why FliponeX? (value props — one per line)', type: 'text', default:
    'Expert at Your Doorstep: Certified professionals visit your home or office.\n' +
    'Pay After Service: Pay only once the task is successfully completed.\n' +
    '100% Secure & Confidential: Documents are encrypted and kept confidential.\n' +
    'Real-time Tracking: Monitor your application status live through our app.'
  },

  // Banner copy
  { key: 'banner_b2c', group: 'brand', label: 'B2C banner copy', type: 'string', default: 'PAN, Aadhaar, or Voter ID? No more office visits!' },
  { key: 'banner_b2b', group: 'brand', label: 'B2B banner copy', type: 'string', default: 'Industrial Licensing & GST? Focus on growth, we handle the files.' },
  { key: 'banner_fasttrack', group: 'brand', label: 'Fast-track banner copy', type: 'string', default: '90-Minute Urgency Mode! For those urgent digital needs.' },
  { key: 'banner_referral', group: 'brand', label: 'Referral banner copy', type: 'string', default: 'Refer & Earn! Make your friends smart and earn rewards.' },

  // Support & contact
  { key: 'support_helpline', group: 'support', label: 'Helpline', type: 'string', default: '+91-7482872330' },
  { key: 'support_hours', group: 'support', label: 'Support hours', type: 'string', default: 'Mon–Sat, 9:00 AM – 8:00 PM' },
  { key: 'support_whatsapp', group: 'support', label: 'WhatsApp support URL', type: 'string', default: 'https://wa.me/7482872330' },
  { key: 'support_email', group: 'support', label: 'Support email', type: 'string', default: 'support@fliponex.com' },
  { key: 'support_office_address', group: 'support', label: 'Corporate office address', type: 'text', default: 'S. No.-11/1, Quepem, South Goa, Goa-403705' },

  // Legal policies
  { key: 'policy_privacy', group: 'legal', label: 'Privacy policy', type: 'text', default: 'FliponeX Digital respects your privacy. We use your documents solely for the requested service. Once the task is concluded, sensitive data is securely purged from our active systems. We never sell your data to third parties.' },
  { key: 'policy_refund', group: 'legal', label: 'Refund & cancellation policy', type: 'text', default:
    'Free Cancellation: cancel at no cost up to 1 hour before the scheduled slot.\n' +
    'Visiting Fee: if the agent reaches the location and the service is cancelled, a ₹99 visiting fee applies.\n' +
    'Refunds: if service cannot be completed due to government portal downtime, the service fee is refunded (excluding the nominal visiting charge).'
  },
  { key: 'policy_terms', group: 'legal', label: 'Terms & conditions', type: 'text', default:
    'Customers must provide original and authentic documents for all applications.\n' +
    'Submission of fraudulent documents will lead to immediate service termination.\n' +
    'Service success is subject to Government portal availability.\n' +
    'Payment is mandatory immediately upon job completion by the agent.\n' +
    'All services are subject to government regulations.'
  },

  // FAQs (one Q per line; answer after the arrow)
  { key: 'faq_list', group: 'support', label: 'FAQ list (one per line, "Question → Answer")', type: 'text', default:
    'How to verify my agent? → Every agent is KYC-verified. Check the agent ID card in the app before the task starts.\n' +
    'Which payment modes are accepted? → UPI, cards, net-banking, and cash-on-completion.\n' +
    'Is my payment secure? → Yes — all payments run through Razorpay with PCI-DSS compliance.\n' +
    'Timeline for Aadhaar Services? → Typically same-day for in-home updates; 3–7 working days for portal-side updates.\n' +
    'Timeline for PAN Services? → 7–15 working days depending on NSDL/UTI processing.\n' +
    'Timeline for Voter Services? → 15–30 days subject to Election Commission portal.\n' +
    'Timeline for other Services? → Shown on each service page; fast-track option reduces SLA by up to 40%.'
  },

  { key: 'grievance_cta', group: 'support', label: 'Grievance redressal CTA', type: 'string', default: 'Raise a Ticket for delays, agent behaviour, task pending, or payment issues.' },
];

const MASK = '••••••••';

const serialize = (row, schemaEntry) => ({
  key: row.key,
  value: row.is_secret ? (row.value ? MASK : '') : (row.value ?? ''),
  label: schemaEntry?.label || row.key,
  type: schemaEntry?.type || 'string',
  group: schemaEntry?.group || 'misc',
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
        group: entry.group || 'misc',
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
