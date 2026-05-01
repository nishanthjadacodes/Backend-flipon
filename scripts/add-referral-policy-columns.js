// One-off migration — adds the two columns the Refer & Earn policy fix
// needs:
//   * users.is_priority_user            BOOLEAN — flagged on Gold milestone
//   * bookings.referral_discount        DECIMAL(10,2) — ₹20 first-booking discount
//
// Run with:  node scripts/add-referral-policy-columns.js
//
// Safe to re-run: each ALTER is wrapped in try/catch so "Duplicate column"
// errors are ignored.

import { sequelize } from '../src/models/index.js';

const STATEMENTS = [
  {
    table: 'users',
    label: 'is_priority_user',
    sql:
      'ALTER TABLE users ADD COLUMN is_priority_user TINYINT(1) NOT NULL DEFAULT 0',
  },
  {
    table: 'users',
    label: 'royalty_forfeited_until',
    sql: 'ALTER TABLE users ADD COLUMN royalty_forfeited_until DATETIME NULL',
  },
  {
    table: 'users',
    label: 'royalty_forfeit_reason',
    sql: 'ALTER TABLE users ADD COLUMN royalty_forfeit_reason VARCHAR(255) NULL',
  },
  {
    table: 'bookings',
    label: 'referral_discount',
    sql:
      'ALTER TABLE bookings ADD COLUMN referral_discount DECIMAL(10,2) NULL DEFAULT 0',
  },
];

const isAlreadyExistsError = (msg) =>
  /duplicate column|already exists/i.test(String(msg || ''));

const main = async () => {
  for (const s of STATEMENTS) {
    try {
      await sequelize.query(s.sql);
      console.log(`✅ ${s.table}.${s.label} — added`);
    } catch (e) {
      if (isAlreadyExistsError(e?.message)) {
        console.log(`✓  ${s.table}.${s.label} — already exists (skipping)`);
      } else {
        console.error(`❌ ${s.table}.${s.label} — ERROR:`, e?.message);
        process.exit(1);
      }
    }
  }

  // Verify both tables now expose the new columns.
  for (const t of ['users', 'bookings']) {
    const [rows] = await sequelize.query(`DESCRIBE ${t}`);
    const fields = rows.map((r) => r.Field);
    const expected = t === 'users' ? 'is_priority_user' : 'referral_discount';
    if (!fields.includes(expected)) {
      console.error(`❌ ${t}.${expected} still missing after migration.`);
      process.exit(1);
    }
  }

  console.log('\n🎉 Refer & Earn policy columns present. You can ship the fix.');
  process.exit(0);
};

main().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
