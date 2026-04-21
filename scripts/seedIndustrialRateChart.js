/**
 * Seed the 14 services from the Industrial Services Rate Chart.
 *
 * Idempotent: upserts by name. Safe to re-run.
 * Also adds the new Service columns (indicative_price_from/to, pricing_unit)
 * if they don't exist yet — saves the user from running a separate migration.
 *
 * Usage:
 *   node scripts/seedIndustrialRateChart.js
 *
 * Env it reads (same as other scripts): DB_HOST, DB_PORT, DB_USER,
 * DB_PASSWORD, DB_NAME, DB_SSL.
 */

import 'dotenv/config';
import mysql from 'mysql2/promise';

const SSL = process.env.DB_SSL === 'true'
  ? { minVersion: 'TLSv1.2', rejectUnauthorized: true }
  : undefined;

// ─── Rate-chart data — mirrors the PDF you shared ───────────────────────
// user_cost is deliberately NULL (quote-based). indicative_price_from is
// the "starting at" fee we show on the catalog card.
const SERVICES = [
  // 1. Statutory Registrations & Licensing (govt fees extra, per actuals)
  { category: 'Statutory Registrations', name: 'Trade License (New/Renewal)',   from: 1500,  to: 3000,  timeline: '7-10 Working Days',    unit: 'one_time' },
  { category: 'Statutory Registrations', name: 'Factory License Registration', from: 5000,  to: 15000, timeline: '15-20 Working Days',   unit: 'one_time' },
  { category: 'Statutory Registrations', name: 'MSME / Udyam Registration',     from: 5000,  to: 15000, timeline: '7-10 Working Days',    unit: 'one_time' },
  { category: 'Statutory Registrations', name: 'Pollution NOC (CTO/CTE)',       from: 5000,  to: 15000, timeline: '7-10 Working Days',    unit: 'one_time' },
  { category: 'Statutory Registrations', name: 'ISO Certification (9001, 14001, etc.)', from: 5000, to: 15000, timeline: '7-10 Working Days', unit: 'one_time' },
  { category: 'Statutory Registrations', name: 'Import/Export Code (IEC)',      from: 5000,  to: 15000, timeline: '7-10 Working Days',    unit: 'one_time' },

  // 2. Compliance & Monthly Recurring Filings
  { category: 'Compliance & Recurring', name: 'GST Return Filing (GSTR-1, 3B)',  from: 1000, to: 5000, timeline: 'Monthly / Quarterly',         unit: 'per_filing' },
  { category: 'Compliance & Recurring', name: 'EPF & ESIC Compliance',           from: 50,   to: 100,  timeline: 'Monthly (Min. ₹1,500)',       unit: 'per_employee' },
  { category: 'Compliance & Recurring', name: 'Income Tax Audit & Support',      from: 1000, to: 5000, timeline: 'Annual',                       unit: 'one_time' },
  { category: 'Compliance & Recurring', name: 'Professional Tax (PT) Filing',    from: 1000, to: 2000, timeline: 'Annual',                       unit: 'one_time' },

  // 3. On-Site Digital & Legal Support
  { category: 'Digital & Legal Support', name: 'Digital Signature (DSC)',        from: 1500, to: 2500, timeline: 'Class 3 (2-Year Validity)',    unit: 'one_time' },
  { category: 'Digital & Legal Support', name: 'Labour Law Consultation',        from: 2500, to: 2500, timeline: 'Per Consultation Visit',        unit: 'per_visit' },
  { category: 'Digital & Legal Support', name: 'Safety Audit Documentation',     from: 5000, to: null, timeline: 'Per Assessment Report',         unit: 'per_report' },
  { category: 'Digital & Legal Support', name: 'GeM Portal Registration',        from: 2000, to: 4000, timeline: 'For Govt. Tenders',             unit: 'one_time' },
];

// Terms & conditions from the rate chart footer — saved on each service so
// the app can show them in the "About pricing" section of ServiceDetails.
const SHARED_DESCRIPTION =
  'Industrial service with quote-based pricing. Government fees / challans are extra, as per actuals. ' +
  'Payment policy: 50% advance for fresh registrations; 100% on completion for recurring filings. ' +
  'Urgent (24-hour) requests attract a 25% surcharge on the professional fee.';

const run = async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'flipon_db',
    ssl: SSL,
  });

  console.log(`▶︎ connected: ${process.env.DB_USER}@${process.env.DB_HOST}/${process.env.DB_NAME}`);

  // 1. Ensure new columns exist (idempotent ALTERs)
  const existingCols = (await conn.query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'services'
  `))[0].map((r) => r.COLUMN_NAME);

  const add = async (col, ddl) => {
    if (existingCols.includes(col)) {
      console.log(`  ✓ column ${col} already present`);
      return;
    }
    await conn.query(`ALTER TABLE services ADD COLUMN ${col} ${ddl}`);
    console.log(`  + added column ${col}`);
  };
  await add('indicative_price_from', 'DECIMAL(10,2) NULL');
  await add('indicative_price_to',   'DECIMAL(10,2) NULL');
  await add(
    'pricing_unit',
    "ENUM('one_time','per_filing','per_employee','per_visit','per_report') DEFAULT 'one_time'"
  );

  // 2. Upsert each rate-chart service
  let created = 0;
  let updated = 0;
  for (const svc of SERVICES) {
    const [rows] = await conn.query('SELECT id FROM services WHERE name = ? LIMIT 1', [svc.name]);
    if (rows.length) {
      await conn.query(
        `UPDATE services SET
           category = ?,
           service_type = 'industrial',
           pricing_model = 'quote',
           user_cost = NULL,
           govt_fees = NULL,
           expected_timeline = ?,
           indicative_price_from = ?,
           indicative_price_to = ?,
           pricing_unit = ?,
           description = ?,
           is_active = TRUE,
           updated_at = NOW()
         WHERE id = ?`,
        [svc.category, svc.timeline, svc.from, svc.to, svc.unit, SHARED_DESCRIPTION, rows[0].id],
      );
      updated += 1;
      console.log(`  ↻ updated "${svc.name}"`);
    } else {
      await conn.query(
        `INSERT INTO services (
           id, name, category, service_type, pricing_model,
           user_cost, govt_fees, expected_timeline,
           indicative_price_from, indicative_price_to, pricing_unit,
           description, is_active, created_at, updated_at
         ) VALUES (
           UUID(), ?, ?, 'industrial', 'quote',
           NULL, NULL, ?,
           ?, ?, ?,
           ?, TRUE, NOW(), NOW()
         )`,
        [svc.name, svc.category, svc.timeline, svc.from, svc.to, svc.unit, SHARED_DESCRIPTION],
      );
      created += 1;
      console.log(`  + inserted "${svc.name}"`);
    }
  }

  console.log(`\n✅ Done. Created ${created}, updated ${updated} (total ${SERVICES.length}).`);
  await conn.end();
};

run().catch((e) => {
  console.error('❌ seed failed:', e?.message || e);
  process.exit(1);
});
