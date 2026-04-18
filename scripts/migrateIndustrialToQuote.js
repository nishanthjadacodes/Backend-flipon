/**
 * Industrial services don't have catalog pricing. Convert them to the
 * quote-based pricing model and strip pricing/timeline columns so the
 * customer app never shows a fake price.
 *
 * 1. Adds `pricing_model` column to services (if missing)
 * 2. Marks all service_type='industrial' rows as pricing_model='quote'
 * 3. NULLs user_cost / govt_fees / partner_earning / total_expense /
 *    company_margin / expected_timeline on those rows
 *
 * Idempotent — safe to re-run.
 *
 * Usage: node scripts/migrateIndustrialToQuote.js
 */

import 'dotenv/config';
import mysql from 'mysql2/promise';

const run = async () => {
  let connection;
  try {
    console.log('🔌 Connecting to MySQL…');
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'Bannu@456',
      database: process.env.DB_NAME || 'flipon_db',
    });
    console.log('✅ Connected');

    // 1. Ensure pricing_model column exists
    const [cols] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'services'
          AND COLUMN_NAME = 'pricing_model'`
    );
    if (cols.length === 0) {
      console.log('➕ Adding services.pricing_model…');
      await connection.query(`
        ALTER TABLE services
        ADD COLUMN pricing_model ENUM('fixed','quote') NOT NULL DEFAULT 'fixed'
        AFTER service_type
      `);
    } else {
      console.log('✓ services.pricing_model already exists');
    }

    // 2. Allow NULLs on the price/timeline columns — these are optional for quote services
    console.log('🔧 Relaxing NOT NULL on pricing columns…');
    await connection.query(`ALTER TABLE services MODIFY COLUMN user_cost DECIMAL(10,2) NULL`);

    // 3. Flip industrial rows to quote + clear legacy pricing data
    const [upd] = await connection.query(`
      UPDATE services
         SET pricing_model      = 'quote',
             user_cost          = NULL,
             govt_fees          = NULL,
             partner_earning    = NULL,
             total_expense      = NULL,
             company_margin     = NULL,
             expected_timeline  = NULL
       WHERE service_type = 'industrial'
    `);
    console.log(`🏭 Updated ${upd.affectedRows} industrial services → quote (price fields cleared)`);

    // Distribution snapshot
    const [snap] = await connection.query(
      `SELECT service_type, pricing_model, COUNT(*) AS n
         FROM services
        GROUP BY service_type, pricing_model
        ORDER BY service_type, pricing_model`
    );
    console.log('\nSnapshot:');
    snap.forEach((r) => console.log(`  ${r.service_type} · ${r.pricing_model} → ${r.n}`));

    console.log('\n🎉 Industrial services are now quote-based.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exitCode = 1;
  } finally {
    if (connection) await connection.end();
  }
};

run();
