// One-off migration — adds the four Smart Alert columns to vault_documents.
// Run with:  node scripts/add-compliance-columns.js
//
// Safe to re-run: each ALTER is wrapped in try/catch so "Duplicate column"
// errors are ignored.

import { sequelize } from '../src/models/index.js';

const STATEMENTS = [
  {
    label: 'compliance_type',
    sql:
      "ALTER TABLE vault_documents ADD COLUMN compliance_type ENUM(" +
      "'factory_license','fire_noc','pollution_noc','gst_certificate'," +
      "'incorporation','iso_cert','trade_license','esi_pf','other'" +
      ") NULL",
  },
  {
    label: 'expiry_date',
    sql: 'ALTER TABLE vault_documents ADD COLUMN expiry_date DATE NULL',
  },
  {
    label: 'last_alert_tier',
    sql: 'ALTER TABLE vault_documents ADD COLUMN last_alert_tier VARCHAR(10) NULL',
  },
  {
    label: 'last_alert_sent_at',
    sql: 'ALTER TABLE vault_documents ADD COLUMN last_alert_sent_at DATETIME NULL',
  },
];

const isAlreadyExistsError = (msg) =>
  /duplicate column|already exists/i.test(String(msg || ''));

const main = async () => {
  for (const s of STATEMENTS) {
    try {
      await sequelize.query(s.sql);
      console.log(`✅ ${s.label} — added`);
    } catch (e) {
      if (isAlreadyExistsError(e?.message)) {
        console.log(`✓  ${s.label} — already exists (skipping)`);
      } else {
        console.error(`❌ ${s.label} — ERROR:`, e?.message);
        process.exit(1);
      }
    }
  }

  // Verify the columns are present.
  const [rows] = await sequelize.query('DESCRIBE vault_documents');
  const fields = rows.map((r) => r.Field);
  const required = ['compliance_type', 'expiry_date', 'last_alert_tier', 'last_alert_sent_at'];
  const missing = required.filter((f) => !fields.includes(f));

  console.log('\nFinal vault_documents columns:');
  console.log('  ' + fields.join(', '));

  if (missing.length) {
    console.error(`\n❌ Still missing: ${missing.join(', ')}`);
    process.exit(1);
  }
  console.log('\n🎉 All compliance columns present. You can now ship the feature.');
  process.exit(0);
};

main().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
