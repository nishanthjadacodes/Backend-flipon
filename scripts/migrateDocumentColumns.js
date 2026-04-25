/**
 * One-shot migration: relax `documents.document_type` and `documents.category`
 * from ENUM to VARCHAR.
 *
 * The original schema hardcoded 14 doc types in the ENUM. The booking flow
 * sends ANY type from service.required_documents (voter_id_card,
 * disability_certificate, bank_passbook, additional_document_*, etc.) so
 * Sequelize validation rejected them and the customer saw "Failed to
 * upload document".
 *
 * Idempotent — checks current column type before altering. Safe to re-run.
 *
 * Usage:
 *   node scripts/migrateDocumentColumns.js
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const SSL = process.env.DB_SSL === 'true'
  ? { minVersion: 'TLSv1.2', rejectUnauthorized: true }
  : undefined;

const run = async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'flipon_db',
    ssl: SSL,
  });
  console.log(`▶︎ ${process.env.DB_USER}@${process.env.DB_HOST}/${process.env.DB_NAME}`);

  const [cols] = await conn.query(`
    SELECT COLUMN_NAME, COLUMN_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'documents'
       AND COLUMN_NAME IN ('document_type', 'category')
  `);

  const types = Object.fromEntries(cols.map((c) => [c.COLUMN_NAME, c.COLUMN_TYPE]));
  console.log('  current document_type:', types.document_type);
  console.log('  current category:     ', types.category);

  if (types.document_type && types.document_type.toLowerCase().startsWith('enum')) {
    console.log('  altering document_type → VARCHAR(80)…');
    await conn.query(`ALTER TABLE documents MODIFY COLUMN document_type VARCHAR(80) NOT NULL`);
    console.log('  ✓ done');
  } else {
    console.log('  document_type already non-ENUM — skipping');
  }

  if (types.category && types.category.toLowerCase().startsWith('enum')) {
    console.log('  altering category → VARCHAR(40)…');
    await conn.query(
      `ALTER TABLE documents MODIFY COLUMN category VARCHAR(40) NOT NULL DEFAULT 'booking'`,
    );
    console.log('  ✓ done');
  } else {
    console.log('  category already non-ENUM — skipping');
  }

  console.log('\n✅ Migration complete');
  await conn.end();
};

run().catch((e) => {
  console.error('❌ migration failed:', e?.message || e);
  process.exit(1);
});
