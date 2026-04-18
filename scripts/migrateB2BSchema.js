/**
 * One-shot schema migration for the B2B (industrial) flow.
 *
 * - Adds `nda_accepted_at` column to the `users` table (if missing).
 * - Creates the `company_profiles` table (if missing).
 *
 * `CompanyProfile.sync()` in src/models/index.js will also create the table
 * on first server start, but this script guarantees the users-table alter and
 * is safe to run ahead of a deploy. Idempotent — re-run freely.
 *
 * Usage: node scripts/migrateB2BSchema.js
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
      multipleStatements: false,
    });
    console.log('✅ Connected');

    // ─── 1. users.nda_accepted_at ─────────────────────────────────────
    const [userCols] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'users'
          AND COLUMN_NAME  = 'nda_accepted_at'`
    );
    if (userCols.length === 0) {
      console.log('➕ Adding users.nda_accepted_at…');
      await connection.query(`
        ALTER TABLE users
        ADD COLUMN nda_accepted_at DATETIME NULL AFTER assigned_zone
      `);
      console.log('   done.');
    } else {
      console.log('✓ users.nda_accepted_at already exists — skipping');
    }

    // ─── 2. company_profiles table ───────────────────────────────────
    const [tables] = await connection.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'company_profiles'`
    );
    if (tables.length === 0) {
      console.log('➕ Creating company_profiles…');
      await connection.query(`
        CREATE TABLE company_profiles (
          id CHAR(36) NOT NULL,
          user_id CHAR(36) NOT NULL,

          legal_entity_name VARCHAR(150) NOT NULL,
          entity_type VARCHAR(50) NULL,
          brand_name VARCHAR(150) NULL,
          gstin VARCHAR(20) NOT NULL,
          pan VARCHAR(15) NOT NULL,
          tan VARCHAR(15) NULL,
          cin VARCHAR(25) NULL,

          registered_address TEXT NOT NULL,
          factory_address TEXT NULL,

          kdm_name VARCHAR(100) NOT NULL,
          kdm_designation VARCHAR(80) NULL,
          kdm_mobile VARCHAR(15) NOT NULL,
          kdm_email VARCHAR(150) NULL,

          poc_name VARCHAR(100) NOT NULL,
          poc_designation VARCHAR(80) NULL,
          poc_mobile VARCHAR(15) NOT NULL,
          poc_email VARCHAR(150) NULL,

          msme_category ENUM('none','micro','small','medium') NOT NULL DEFAULT 'none',
          nic_code VARCHAR(10) NULL,

          is_verified TINYINT(1) NOT NULL DEFAULT 0,
          verified_at DATETIME NULL,

          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

          PRIMARY KEY (id),
          UNIQUE KEY uniq_company_profile_user (user_id),
          KEY idx_company_profile_gstin (gstin),
          CONSTRAINT fk_company_profile_user
            FOREIGN KEY (user_id) REFERENCES users(id)
            ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('   done.');
    } else {
      console.log('✓ company_profiles already exists — skipping');
    }

    console.log('\n🎉 B2B schema migration complete.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exitCode = 1;
  } finally {
    if (connection) await connection.end();
  }
};

run();
