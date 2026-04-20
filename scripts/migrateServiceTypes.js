/**
 * One-shot migration: normalize service_type column.
 *
 * Problem: the customer API filters on `service_type IN ('consumer','both')`
 * (and `('industrial','both')`) but earlier seeds wrote legacy values like
 * 'common', 'government_document', 'welfare', 'certificate', 'state_scheme',
 * 'home_service', 'industrial_service', 'government', etc.  Those rows are
 * invisible to the filter, so the customer app sees an empty list.
 *
 * This script maps all non-industrial legacy values → 'consumer', and leaves
 * 'industrial' and 'both' untouched.  Safe to re-run (idempotent).
 *
 * Run: node scripts/migrateServiceTypes.js
 */

import 'dotenv/config';
import mysql from 'mysql2/promise';

const LEGACY_INDUSTRIAL = new Set([
  'industrial',
  'industrial_service',
  'b2b',
]);

const KEEP_AS_IS = new Set(['consumer', 'industrial', 'both']);

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
      ssl: process.env.DB_SSL === 'true'
        ? { minVersion: 'TLSv1.2', rejectUnauthorized: true }
        : undefined,
    });
    console.log('✅ Connected');

    // Snapshot of current distribution
    const [before] = await connection.query(
      'SELECT service_type, COUNT(*) AS n FROM services GROUP BY service_type'
    );
    console.log('\nBefore:');
    before.forEach((r) => console.log(`  ${r.service_type || '(null)'} → ${r.n}`));

    // Inspect current column definition — the ENUM may not include 'consumer' yet.
    const [colInfo] = await connection.query(
      `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'services' AND COLUMN_NAME = 'service_type'`
    );
    const columnType = colInfo?.[0]?.COLUMN_TYPE || '';
    console.log(`\nCurrent column type: ${columnType}`);

    // Step 0 — widen the ENUM temporarily so updates don't truncate.
    // Include every legacy value we might have seen plus the canonical set.
    console.log("\n🔧 Widening ENUM to permit legacy + canonical values…");
    await connection.query(`
      ALTER TABLE services
      MODIFY COLUMN service_type
      ENUM('common','consumer','industrial','both','government','welfare',
           'certificate','state_scheme','government_document','home_service',
           'industrial_service','b2b','government_scheme')
      NOT NULL DEFAULT 'consumer'
    `);

    // Step 1 — anything industrial-ish → 'industrial'
    const [indResult] = await connection.query(
      `UPDATE services SET service_type = 'industrial'
       WHERE service_type IN (?)`,
      [[...LEGACY_INDUSTRIAL].filter((v) => v !== 'industrial')]
    );
    console.log(`🏭 Normalized ${indResult.affectedRows} rows → 'industrial'`);

    // Step 2 — everything else that isn't in the canonical set → 'consumer'
    const [conResult] = await connection.query(
      `UPDATE services SET service_type = 'consumer'
       WHERE service_type NOT IN (?)
          OR service_type IS NULL`,
      [[...KEEP_AS_IS]]
    );
    console.log(`👤 Normalized ${conResult.affectedRows} rows → 'consumer'`);

    // Step 3 — tighten the ENUM back to the Sequelize model's declared set.
    console.log("🔒 Locking ENUM back to ('consumer','industrial','both')…");
    await connection.query(`
      ALTER TABLE services
      MODIFY COLUMN service_type
      ENUM('consumer','industrial','both')
      NOT NULL DEFAULT 'both'
    `);

    // Snapshot after
    const [after] = await connection.query(
      'SELECT service_type, COUNT(*) AS n FROM services GROUP BY service_type'
    );
    console.log('\nAfter:');
    after.forEach((r) => console.log(`  ${r.service_type || '(null)'} → ${r.n}`));

    console.log('\n🎉 Migration complete — /services?type=consumer and ?type=industrial will now return rows.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exitCode = 1;
  } finally {
    if (connection) await connection.end();
  }
};

run();
