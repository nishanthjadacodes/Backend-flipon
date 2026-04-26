/**
 * One-shot migration: add `booking_number` (sequential int, unique) and
 * `dynamic_fields` (JSON) to the bookings table.
 *
 *   - booking_number: customer-facing sequential ID. App displays it as
 *     "Flip#001". Auto-assigned by the createBooking controller.
 *   - dynamic_fields: snapshot of whatever the customer entered into the
 *     service-defined Personal Details fields. Lets the admin see exactly
 *     what was provided.
 *
 * Idempotent — checks for column existence before altering. Backfills
 * existing rows with sequential booking_numbers in created_at order.
 *
 * Usage:
 *   node scripts/migrateBookingColumns.js
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
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings'
       AND COLUMN_NAME IN ('booking_number', 'dynamic_fields')
  `);
  const existing = new Set(cols.map((c) => c.COLUMN_NAME));

  if (!existing.has('booking_number')) {
    console.log('  + adding booking_number…');
    await conn.query(`ALTER TABLE bookings ADD COLUMN booking_number INT NULL`);
    await conn.query(`ALTER TABLE bookings ADD UNIQUE INDEX idx_booking_number (booking_number)`);
    console.log('  ✓ added');
  } else {
    console.log('  = booking_number already exists');
  }

  if (!existing.has('dynamic_fields')) {
    console.log('  + adding dynamic_fields…');
    await conn.query(`ALTER TABLE bookings ADD COLUMN dynamic_fields JSON NULL`);
    console.log('  ✓ added');
  } else {
    console.log('  = dynamic_fields already exists');
  }

  // Backfill any rows that currently have booking_number = NULL with
  // sequential numbers in chronological order. Done in a single
  // user-variable update so we don't depend on a separate counter table.
  const [pending] = await conn.query(
    'SELECT COUNT(*) AS n FROM bookings WHERE booking_number IS NULL',
  );
  if (pending[0].n > 0) {
    console.log(`  ↻ backfilling ${pending[0].n} rows with sequential numbers…`);
    // Find the current max so we don't collide with rows that already have one.
    const [maxRow] = await conn.query(
      'SELECT COALESCE(MAX(booking_number), 0) AS m FROM bookings',
    );
    const start = maxRow[0].m;
    await conn.query(`SET @rownum := ${start}`);
    await conn.query(`
      UPDATE bookings
         SET booking_number = (@rownum := @rownum + 1)
       WHERE booking_number IS NULL
       ORDER BY created_at ASC
    `);
    console.log('  ✓ backfilled');
  }

  console.log('\n✅ Migration complete');
  await conn.end();
};

run().catch((e) => {
  console.error('❌ migration failed:', e?.message || e);
  process.exit(1);
});
