import { CompanyProfile, User } from '../models/index.js';

// ─── Validators (light — just enough to block malformed input) ───────────────
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const TAN_RE = /^[A-Z]{4}[0-9]{5}[A-Z]$/;
const CIN_RE = /^[A-Z][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;
const MOBILE_RE = /^[6-9][0-9]{9}$/;

const missing = (o, keys) => keys.filter((k) => !o[k] || String(o[k]).trim().length === 0);

// ─── GET /api/company-profile ───────────────────────────────────────────────
export const getCompanyProfile = async (req, res) => {
  try {
    const profile = await CompanyProfile.findOne({ where: { user_id: req.user.id } });
    res.json({ success: true, data: profile });
  } catch (error) {
    console.error('getCompanyProfile error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch company profile' });
  }
};

// ─── PUT /api/company-profile (upsert) ──────────────────────────────────────
export const upsertCompanyProfile = async (req, res) => {
  try {
    const body = req.body || {};

    // Required fields — anything else is optional.
    const required = [
      'legal_entity_name', 'gstin', 'pan',
      'registered_address',
      'kdm_name', 'kdm_mobile',
      'poc_name', 'poc_mobile',
    ];
    const miss = missing(body, required);
    if (miss.length) {
      return res.status(400).json({
        success: false, message: `Missing required fields: ${miss.join(', ')}`,
      });
    }

    // Normalize casing on identifiers (the regexes expect uppercase)
    const normalized = {
      ...body,
      gstin: String(body.gstin).trim().toUpperCase(),
      pan: String(body.pan).trim().toUpperCase(),
      tan: body.tan ? String(body.tan).trim().toUpperCase() : null,
      cin: body.cin ? String(body.cin).trim().toUpperCase() : null,
    };

    const errors = [];
    if (!GSTIN_RE.test(normalized.gstin)) errors.push('Invalid GSTIN format');
    if (!PAN_RE.test(normalized.pan)) errors.push('Invalid PAN format');
    if (normalized.tan && !TAN_RE.test(normalized.tan)) errors.push('Invalid TAN format');
    if (normalized.cin && !CIN_RE.test(normalized.cin)) errors.push('Invalid CIN format');
    if (!MOBILE_RE.test(String(normalized.kdm_mobile))) errors.push('Invalid KDM mobile');
    if (!MOBILE_RE.test(String(normalized.poc_mobile))) errors.push('Invalid PoC mobile');
    if (errors.length) {
      return res.status(400).json({ success: false, message: errors.join('; ') });
    }

    // Whitelist of fields we accept — keeps arbitrary columns out.
    const allowed = [
      'legal_entity_name', 'entity_type', 'brand_name',
      'gstin', 'pan', 'tan', 'cin',
      'registered_address', 'factory_address',
      'kdm_name', 'kdm_designation', 'kdm_mobile', 'kdm_email',
      'poc_name', 'poc_designation', 'poc_mobile', 'poc_email',
      'msme_category', 'nic_code',
    ];
    // Fields that are ENUMs or have defaults — empty string fails validation
    // in Sequelize, so coerce "" to undefined and let the default kick in.
    const enumOrDefaultFields = new Set(['msme_category']);
    const payload = { user_id: req.user.id };
    for (const k of allowed) {
      const v = normalized[k];
      if (v === undefined) continue;
      if (typeof v === 'string' && v.trim() === '') {
        // Skip blank optional fields entirely so DB defaults / null apply.
        if (enumOrDefaultFields.has(k)) continue;
        payload[k] = null; // nullable STRING/TEXT columns accept null
        continue;
      }
      payload[k] = v;
    }

    const existing = await CompanyProfile.findOne({ where: { user_id: req.user.id } });
    let profile;
    if (existing) {
      await existing.update(payload);
      profile = existing;
    } else {
      profile = await CompanyProfile.create(payload);
    }

    res.json({ success: true, data: profile });
  } catch (error) {
    console.error('upsertCompanyProfile error:', error);
    // Surface Sequelize validation + unique-constraint errors so the app
    // can show the user what to fix, instead of a generic "Failed to save".
    if (error?.name === 'SequelizeValidationError' || error?.name === 'SequelizeUniqueConstraintError') {
      const detail = (error.errors || [])
        .map((e) => e.message || `${e.path}: ${e.type}`)
        .join('; ') || error.message;
      return res.status(400).json({ success: false, message: detail });
    }
    res.status(500).json({ success: false, message: error?.message || 'Failed to save company profile' });
  }
};

// ─── POST /api/company-profile/nda/accept ───────────────────────────────────
export const acceptNDA = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (!user.nda_accepted_at) {
      await user.update({ nda_accepted_at: new Date() });
    }

    res.json({
      success: true,
      message: 'NDA accepted',
      nda_accepted_at: user.nda_accepted_at,
    });
  } catch (error) {
    console.error('acceptNDA error:', error);
    res.status(500).json({ success: false, message: 'Failed to record NDA acceptance' });
  }
};

// ─── GET /api/company-profile/status ────────────────────────────────────────
// Lightweight readiness probe used by the customer app before letting a user
// book an industrial service.
export const getB2BReadiness = async (req, res) => {
  try {
    const [profile, user] = await Promise.all([
      CompanyProfile.findOne({ where: { user_id: req.user.id } }),
      User.findByPk(req.user.id, { attributes: ['id', 'nda_accepted_at'] }),
    ]);
    res.json({
      success: true,
      data: {
        profile_complete: !!profile,
        nda_accepted: !!user?.nda_accepted_at,
        nda_accepted_at: user?.nda_accepted_at || null,
      },
    });
  } catch (error) {
    console.error('getB2BReadiness error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch readiness' });
  }
};
