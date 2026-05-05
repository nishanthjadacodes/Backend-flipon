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
  // Razorpay payment trail — without these the verifyPayment controller
  // silently drops the transaction id / amount / paid timestamp because
  // Sequelize ignores fields not declared on the model AND the columns
  // never existed in the DB. Result: paid bookings looked unpaid in admin.
  {
    label: 'bookings.payment_method',
    sql: 'ALTER TABLE bookings ADD COLUMN payment_method VARCHAR(32) NULL',
  },
  {
    label: 'bookings.transaction_id',
    sql: 'ALTER TABLE bookings ADD COLUMN transaction_id VARCHAR(64) NULL',
  },
  {
    label: 'bookings.amount_paid',
    sql: 'ALTER TABLE bookings ADD COLUMN amount_paid DECIMAL(10,2) NULL',
  },
  {
    label: 'bookings.paid_at',
    sql: 'ALTER TABLE bookings ADD COLUMN paid_at DATETIME NULL',
  },
  // B2B / Industrial enquiry quote fields. Without these the
  // "Send Quote to Customer" button in the admin dashboard fails
  // silently because enquiry.update({...quote fields}) → Unknown column.
  {
    label: 'enquiries.quote_service_fee',
    sql: 'ALTER TABLE enquiries ADD COLUMN quote_service_fee DECIMAL(10,2) NULL',
  },
  {
    label: 'enquiries.quote_govt_fees',
    sql: 'ALTER TABLE enquiries ADD COLUMN quote_govt_fees DECIMAL(10,2) NULL',
  },
  {
    label: 'enquiries.quote_cycle',
    sql: 'ALTER TABLE enquiries ADD COLUMN quote_cycle VARCHAR(20) NULL',
  },
  {
    label: 'enquiries.quote_valid_until',
    sql: 'ALTER TABLE enquiries ADD COLUMN quote_valid_until DATETIME NULL',
  },
  {
    label: 'enquiries.quote_terms',
    sql: 'ALTER TABLE enquiries ADD COLUMN quote_terms TEXT NULL',
  },
  {
    label: 'enquiries.quote_issued_at',
    sql: 'ALTER TABLE enquiries ADD COLUMN quote_issued_at DATETIME NULL',
  },
  {
    label: 'enquiries.assigned_admin_id',
    sql: 'ALTER TABLE enquiries ADD COLUMN assigned_admin_id CHAR(36) NULL',
  },
  {
    label: 'enquiries.responded_at',
    sql: 'ALTER TABLE enquiries ADD COLUMN responded_at DATETIME NULL',
  },
  {
    label: 'enquiries.completed_at',
    sql: 'ALTER TABLE enquiries ADD COLUMN completed_at DATETIME NULL',
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
  // Compliance register fields — customer-owned tracker per the new
  // mockup. document_name lets users register any renewable doc (not
  // just the predefined compliance_type enum), issuing_authority is the
  // statutory dept / concerned office, document_number is the reference
  // number on the doc, issue_date is when the doc was originally issued.
  {
    label: 'vault_documents.document_name',
    sql: 'ALTER TABLE vault_documents ADD COLUMN document_name VARCHAR(255) NULL',
  },
  {
    label: 'vault_documents.issuing_authority',
    sql: 'ALTER TABLE vault_documents ADD COLUMN issuing_authority VARCHAR(255) NULL',
  },
  {
    label: 'vault_documents.document_number',
    sql: 'ALTER TABLE vault_documents ADD COLUMN document_number VARCHAR(100) NULL',
  },
  {
    label: 'vault_documents.issue_date',
    sql: 'ALTER TABLE vault_documents ADD COLUMN issue_date DATE NULL',
  },
];

// Probe a table once for its current column list — much faster than
// trying each ALTER and catching duplicate-column errors. We then only
// run the ALTERs whose column doesn't already exist.
const tableColumnsCache = new Map();
const getColumns = async (table) => {
  if (tableColumnsCache.has(table)) return tableColumnsCache.get(table);
  try {
    const [rows] = await sequelize.query(`DESCRIBE ${table}`);
    const set = new Set(rows.map((r) => r.Field));
    tableColumnsCache.set(table, set);
    return set;
  } catch (e) {
    // Table doesn't exist yet (sequelize.sync hasn't run). Treat as empty.
    return new Set();
  }
};

// Extract table name from "ALTER TABLE <name> ADD COLUMN ...".
const extractTable = (sql) => {
  const m = sql.match(/ALTER\s+TABLE\s+(\w+)/i);
  return m ? m[1] : null;
};
// Extract column name from "ADD COLUMN <name> ...".
const extractColumn = (sql) => {
  const m = sql.match(/ADD\s+COLUMN\s+(\w+)/i);
  return m ? m[1] : null;
};

// Group ALTER ADD COLUMN statements by table so we can issue one
// combined ALTER TABLE per table (10x faster on TiDB than N separate
// statements — avoids the per-statement metadata-lock dance).
const groupByTable = (pending) => {
  const grouped = new Map();
  for (const m of pending) {
    const t = extractTable(m.sql);
    const colDef = m.sql.replace(/^ALTER\s+TABLE\s+\w+\s+/i, ''); // "ADD COLUMN ..."
    if (!t) continue;
    if (!grouped.has(t)) grouped.set(t, []);
    grouped.get(t).push({ label: m.label, fragment: colDef });
  }
  return grouped;
};

export const runBootMigrations = async () => {
  // Step 1: skip every migration whose target column already exists.
  // One DESCRIBE per affected table — way cheaper than N failing ALTERs.
  const pending = [];
  for (const m of MIGRATIONS) {
    const table = extractTable(m.sql);
    const column = extractColumn(m.sql);
    if (!table || !column) continue;
    const existing = await getColumns(table);
    if (existing.has(column)) continue;       // already present, skip
    pending.push(m);
  }

  if (pending.length === 0) {
    return;                                    // nothing to do, silent
  }

  console.log(`[boot-migrate] applying ${pending.length} pending migration(s)…`);

  // Step 2: combine multiple ADD COLUMNs per table into one ALTER
  // statement. MySQL/TiDB lets you stack them with commas.
  const grouped = groupByTable(pending);
  let added = 0;
  for (const [table, cols] of grouped.entries()) {
    const combined = `ALTER TABLE ${table} ${cols.map((c) => c.fragment).join(', ')}`;
    try {
      await sequelize.query(combined);
      for (const c of cols) console.log(`[boot-migrate] ✅ ${c.label} — added`);
      added += cols.length;
    } catch (e) {
      if (isAlreadyExistsError(e?.message)) {
        // Race: another process added it between DESCRIBE and ALTER.
        // Retry one column at a time so the rest still succeed.
        for (const c of cols) {
          try {
            await sequelize.query(`ALTER TABLE ${table} ${c.fragment}`);
            console.log(`[boot-migrate] ✅ ${c.label} — added (retry)`);
            added += 1;
          } catch (e2) {
            if (!isAlreadyExistsError(e2?.message)) {
              console.error(`[boot-migrate] ❌ ${c.label}:`, e2?.message);
            }
          }
        }
      } else {
        console.error(`[boot-migrate] ❌ batch on ${table} failed:`, e?.message);
      }
    }
  }

  if (added > 0) {
    console.log(`[boot-migrate] applied ${added} new column(s)`);
  }
};
