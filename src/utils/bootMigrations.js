// Auto-migrations that run once on server boot.
//
// We DON'T use sequelize.sync({ alter: true }) here — TiDB has crashed in
// the past when sync tries to drop foreign keys and re-add them. Instead
// we apply small, idempotent ALTER TABLE statements wrapped in try/catch
// so "duplicate column" errors are silently swallowed.
//
// Each migration runs at most once per deploy (the 'already exists' check
// short-circuits subsequent runs). Adding new ones is safe — just append
// to the MIGRATIONS array.
//
// This exists because the backend started failing in production whenever
// a deploy added a new model column without first running the matching
// scripts/add-*-columns.js. With auto-migrations on boot, that race is
// gone — schema and code ship together.

import { sequelize } from '../config/database.js';

const isAlreadyExistsError = (msg) =>
  /duplicate column|already exists|duplicate key name/i.test(String(msg || ''));

// Each entry runs as a single SQL statement. Use ALTER TABLE … ADD COLUMN
// for additive changes; never include DROP COLUMN or destructive ops here.
const MIGRATIONS = [
  // Refer & Earn policy (₹20 discount + Priority User flag + anti-poaching)
  {
    label: 'users.is_priority_user',
    sql: 'ALTER TABLE users ADD COLUMN is_priority_user TINYINT(1) NOT NULL DEFAULT 0',
  },
  {
    label: 'users.royalty_forfeited_until',
    sql: 'ALTER TABLE users ADD COLUMN royalty_forfeited_until DATETIME NULL',
  },
  {
    label: 'users.royalty_forfeit_reason',
    sql: 'ALTER TABLE users ADD COLUMN royalty_forfeit_reason VARCHAR(255) NULL',
  },
  {
    label: 'bookings.referral_discount',
    sql: 'ALTER TABLE bookings ADD COLUMN referral_discount DECIMAL(10,2) NULL DEFAULT 0',
  },
  // Smart Alert / Compliance Vault
  {
    label: 'vault_documents.compliance_type',
    sql:
      "ALTER TABLE vault_documents ADD COLUMN compliance_type ENUM(" +
      "'factory_license','fire_noc','pollution_noc','gst_certificate'," +
      "'incorporation','iso_cert','trade_license','esi_pf','other'" +
      ") NULL",
  },
  {
    label: 'vault_documents.expiry_date',
    sql: 'ALTER TABLE vault_documents ADD COLUMN expiry_date DATE NULL',
  },
  {
    label: 'vault_documents.last_alert_tier',
    sql: 'ALTER TABLE vault_documents ADD COLUMN last_alert_tier VARCHAR(10) NULL',
  },
  {
    label: 'vault_documents.last_alert_sent_at',
    sql: 'ALTER TABLE vault_documents ADD COLUMN last_alert_sent_at DATETIME NULL',
  },
];

export const runBootMigrations = async () => {
  let added = 0;
  let skipped = 0;

  for (const m of MIGRATIONS) {
    try {
      await sequelize.query(m.sql);
      console.log(`[boot-migrate] ✅ ${m.label} — added`);
      added += 1;
    } catch (e) {
      if (isAlreadyExistsError(e?.message)) {
        skipped += 1;
        // No log on skip — would be noisy on every deploy.
      } else {
        // Real error — surface it but don't crash the server. The
        // controller/route that needs this column will fail on first
        // hit with a clearer error than a boot crash.
        console.error(`[boot-migrate] ❌ ${m.label}:`, e?.message);
      }
    }
  }

  if (added > 0) {
    console.log(`[boot-migrate] applied ${added} new migration(s); ${skipped} already present`);
  }
};
