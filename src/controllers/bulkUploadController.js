import multer from 'multer';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { User, Service, AuditLog, CompanyProfile } from '../models/index.js';

// Keep uploaded CSV/XLSX in memory so we process + discard immediately.
const storage = multer.memoryStorage();
const bulkUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.csv' || ext === '.xlsx' || ext === '.xls') return cb(null, true);
    cb(new Error('Only .csv, .xls, .xlsx files are allowed'), false);
  },
});
export const bulkUploadMiddleware = bulkUpload.single('file');

const parseCsv = (buf) => {
  const text = buf.toString('utf8').replace(/^\ufeff/, ''); // strip BOM
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { headers: [], rows: [] };
  const splitRow = (line) => {
    const out = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; continue; }
      if (c === '"') { inQuote = !inQuote; continue; }
      if (c === ',' && !inQuote) { out.push(cur); cur = ''; continue; }
      cur += c;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const headers = splitRow(lines[0]).map((h) => h.toLowerCase());
  const rows = lines.slice(1).map(splitRow).map((cells) => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cells[i] ?? ''; });
    return obj;
  });
  return { headers, rows };
};

const writeErrorCsv = (fails) => {
  const cols = Object.keys(fails[0].row).concat(['error']);
  const head = cols.join(',');
  const body = fails.map((f) => cols.map((c) => JSON.stringify((c === 'error' ? f.error : f.row[c]) ?? '')).join(',')).join('\n');
  const name = `bulk-errors-${Date.now()}.csv`;
  const dir = path.join(process.cwd(), 'uploads', 'temp');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), `${head}\n${body}`, 'utf8');
  return `/uploads/temp/${name}`;
};

// Bulk import agents.
// CSV columns (case-insensitive): name, mobile, email, assigned_zone, aadhaar
// Duplicates by mobile or email are rejected.
export const bulkAgents = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'CSV file is required' });
    if (!req.file.originalname.toLowerCase().endsWith('.csv')) {
      return res.status(400).json({ success: false, message: 'Only CSV parsing is supported in this build; convert .xlsx to .csv first.' });
    }

    const { rows } = parseCsv(req.file.buffer);
    const defaultPasswordHash = await bcrypt.hash(process.env.DEFAULT_AGENT_PASSWORD || 'Agent@123', 10);
    const successes = [];
    const failures = [];

    for (const row of rows) {
      try {
        if (!row.name || !row.mobile) throw new Error('Missing required field: name or mobile');
        if (row.mobile && (await User.findByMobile(row.mobile))) throw new Error(`Duplicate mobile: ${row.mobile}`);
        if (row.email && (await User.findByEmail(row.email))) throw new Error(`Duplicate email: ${row.email}`);
        const u = await User.create({
          name: row.name,
          mobile: row.mobile,
          email: row.email ? row.email.toLowerCase() : null,
          role: 'agent',
          assigned_zone: row.assigned_zone || null,
          password_hash: row.email ? defaultPasswordHash : null,
          is_active: true,
        });
        successes.push({ id: u.id, name: u.name, mobile: u.mobile });
      } catch (err) {
        failures.push({ row, error: err.message });
      }
    }

    const errorFileUrl = failures.length ? writeErrorCsv(failures) : null;
    await AuditLog.record({ actor: req.user, action: 'bulk.agents', metadata: { ok: successes.length, failed: failures.length } });
    res.json({ success: true, inserted: successes.length, failed: failures.length, errorFileUrl, failures });
  } catch (err) {
    console.error('bulkAgents error:', err);
    res.status(500).json({ success: false, message: err.message || 'Bulk agent upload failed' });
  }
};

// Bulk import B2B / industrial customers (per FliponeX framework section 4
// "Bulk Data Management for Industrial Hubs").
//
// CSV columns (case-insensitive — first row is the header):
//   gstin, company_name, poc_name, poc_mobile, poc_email,
//   pan, cin, tan, entity_type, brand_name,
//   registered_address, factory_address,
//   kdm_name, kdm_mobile, kdm_email,
//   msme_category, nic_code
//
// Required columns: gstin, company_name, poc_name, poc_mobile.
// Everything else is optional and can be left blank.
//
// For each row we:
//   1. Find or create the User (matched on poc_mobile, role=customer).
//   2. Upsert CompanyProfile keyed by user_id (one profile per user).
//
// Duplicates of GSTIN across rows are flagged but not blocked — same GSTIN
// can legitimately have multiple POCs in different states.
export const bulkB2BCustomers = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'CSV file is required' });
    if (!req.file.originalname.toLowerCase().endsWith('.csv')) {
      return res.status(400).json({
        success: false,
        message: 'Only CSV parsing is supported in this build; convert .xlsx to .csv first.',
      });
    }

    const { rows } = parseCsv(req.file.buffer);
    const successes = [];
    const failures = [];

    const blank = (v) => (v == null || String(v).trim() === '' ? null : String(v).trim());

    for (const row of rows) {
      try {
        const gstin = blank(row.gstin);
        const company_name = blank(row.company_name) || blank(row['legal_entity_name']);
        const poc_name = blank(row.poc_name);
        const poc_mobile = blank(row.poc_mobile);

        if (!gstin) throw new Error('Missing GSTIN');
        if (!company_name) throw new Error('Missing company name (column: company_name)');
        if (!poc_name) throw new Error('Missing PoC name');
        if (!poc_mobile) throw new Error('Missing PoC mobile');

        // Reuse the customer User if their mobile is already on file;
        // otherwise create a fresh customer account. The PoC mobile is
        // also the login mobile — they get an OTP on first sign-in.
        let user = await User.findByMobile(poc_mobile);
        if (!user) {
          user = await User.create({
            mobile: poc_mobile,
            email: blank(row.poc_email) ? row.poc_email.toLowerCase() : null,
            name: poc_name,
            role: 'customer',
            is_active: true,
            is_verified: true, // bulk-imported, treated as pre-verified
          });
        }

        // Upsert the CompanyProfile (UNIQUE per user_id).
        const profileFields = {
          user_id: user.id,
          legal_entity_name: company_name,
          entity_type: blank(row.entity_type),
          brand_name: blank(row.brand_name),
          gstin,
          pan: blank(row.pan) || 'PENDING000A',  // PAN is NOT NULL on the model; placeholder for incomplete imports
          tan: blank(row.tan),
          cin: blank(row.cin),
          registered_address: blank(row.registered_address) || 'To be confirmed',
          factory_address: blank(row.factory_address),
          kdm_name: blank(row.kdm_name) || poc_name,
          kdm_mobile: blank(row.kdm_mobile) || poc_mobile,
          kdm_email: blank(row.kdm_email) || blank(row.poc_email),
          poc_name,
          poc_designation: blank(row.poc_designation),
          poc_mobile,
          poc_email: blank(row.poc_email),
          msme_category: ['none', 'micro', 'small', 'medium'].includes((row.msme_category || '').toLowerCase())
            ? row.msme_category.toLowerCase()
            : 'none',
          nic_code: blank(row.nic_code),
        };

        const existingProfile = await CompanyProfile.findOne({ where: { user_id: user.id } });
        if (existingProfile) {
          await existingProfile.update(profileFields);
          successes.push({ user_id: user.id, gstin, action: 'updated' });
        } else {
          await CompanyProfile.create(profileFields);
          successes.push({ user_id: user.id, gstin, action: 'created' });
        }
      } catch (err) {
        failures.push({ row, error: err.message });
      }
    }

    const errorFileUrl = failures.length ? writeErrorCsv(failures) : null;
    await AuditLog.record({
      actor: req.user,
      action: 'bulk.b2b_customers',
      metadata: { ok: successes.length, failed: failures.length },
    });
    res.json({
      success: true,
      inserted: successes.length,
      failed: failures.length,
      errorFileUrl,
      failures,
    });
  } catch (err) {
    console.error('bulkB2BCustomers error:', err);
    res.status(500).json({ success: false, message: err.message || 'Bulk B2B upload failed' });
  }
};

// Bulk import services.
// CSV columns: name, category, user_cost, service_type, expected_timeline, description
export const bulkServices = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'CSV file is required' });
    if (!req.file.originalname.toLowerCase().endsWith('.csv')) {
      return res.status(400).json({ success: false, message: 'Only CSV parsing is supported in this build.' });
    }

    const { rows } = parseCsv(req.file.buffer);
    const successes = [];
    const failures = [];

    for (const row of rows) {
      try {
        if (!row.name || !row.category || !row.user_cost) throw new Error('Missing name/category/user_cost');
        const exists = await Service.findOne({ where: { name: row.name } });
        if (exists) throw new Error(`Duplicate service name: ${row.name}`);
        const s = await Service.create({
          name: row.name,
          category: row.category,
          user_cost: Number(row.user_cost),
          service_type: row.service_type || 'both',
          expected_timeline: row.expected_timeline || null,
          description: row.description || null,
          is_active: true,
        });
        successes.push({ id: s.id, name: s.name });
      } catch (err) {
        failures.push({ row, error: err.message });
      }
    }

    const errorFileUrl = failures.length ? writeErrorCsv(failures) : null;
    await AuditLog.record({ actor: req.user, action: 'bulk.services', metadata: { ok: successes.length, failed: failures.length } });
    res.json({ success: true, inserted: successes.length, failed: failures.length, errorFileUrl, failures });
  } catch (err) {
    console.error('bulkServices error:', err);
    res.status(500).json({ success: false, message: err.message || 'Bulk service upload failed' });
  }
};
