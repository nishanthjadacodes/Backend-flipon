/**
 * Creates the `enquiries` table if it doesn't exist. `Enquiry.sync()` in
 * models/index.js already handles this on server start; this script exists
 * so you can run the migration without restarting the server.
 *
 * Idempotent — safe to re-run.
 *
 * Usage: node scripts/migrateEnquirySchema.js
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
      ssl: process.env.DB_SSL === 'true'
        ? { minVersion: 'TLSv1.2', rejectUnauthorized: true }
        : undefined,
    });
    console.log('✅ Connected');

    const [tables] = await connection.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'enquiries'`
    );
    if (tables.length) {
      console.log('✓ enquiries already exists — skipping');
      return;
    }

    console.log('➕ Creating enquiries…');
    await connection.query(`
      CREATE TABLE enquiries (
        id CHAR(36) NOT NULL,
        customer_id CHAR(36) NOT NULL,
        service_id CHAR(36) NOT NULL,
        company_profile_id CHAR(36) NULL,

        notes TEXT NULL,
        urgency ENUM('standard','urgent','fast_track') NOT NULL DEFAULT 'standard',
        preferred_contact_time VARCHAR(80) NULL,

        status ENUM('pending','quoted','accepted','rejected','in_progress','completed','cancelled')
               NOT NULL DEFAULT 'pending',

        quote_service_fee DECIMAL(10,2) NULL,
        quote_govt_fees   DECIMAL(10,2) NULL,
        quote_cycle       VARCHAR(20) NULL,
        quote_valid_until DATETIME NULL,
        quote_terms       TEXT NULL,
        quote_issued_at   DATETIME NULL,
        assigned_admin_id CHAR(36) NULL,

        responded_at DATETIME NULL,
        completed_at DATETIME NULL,

        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

        PRIMARY KEY (id),
        KEY idx_enq_customer (customer_id),
        KEY idx_enq_service  (service_id),
        KEY idx_enq_status   (status),
        KEY idx_enq_admin    (assigned_admin_id),

        CONSTRAINT fk_enq_customer FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_enq_service  FOREIGN KEY (service_id)  REFERENCES services(id) ON DELETE RESTRICT,
        CONSTRAINT fk_enq_company  FOREIGN KEY (company_profile_id) REFERENCES company_profiles(id) ON DELETE SET NULL,
        CONSTRAINT fk_enq_admin    FOREIGN KEY (assigned_admin_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('   done.');

    console.log('\n🎉 enquiries table ready.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exitCode = 1;
  } finally {
    if (connection) await connection.end();
  }
};

run();
