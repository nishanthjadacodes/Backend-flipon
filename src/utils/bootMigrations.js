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
  // Profile picture URL — Cloudinary URL in production, relative
  // /uploads/avatars/<filename> path on local. Customer + rep apps
  // both display this in the profile screen with a camera overlay
  // button to update it.
  {
    label: 'users.profile_pic',
    sql: 'ALTER TABLE users ADD COLUMN profile_pic VARCHAR(512) NULL',
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
    // Admin "last active" tracking — stamped on every successful admin
    // login so the Admin Controls panel can show "active 2h ago" etc.
    label: 'users.last_login_at',
    sql: 'ALTER TABLE users ADD COLUMN last_login_at DATETIME NULL',
  },
  {
    // Rep online-status heartbeat. Stamped on every PUT /profile/online-status
    // call (agent app heartbeats every 30s while online). Admin's
    // available-reps endpoint treats anything older than 90s as offline,
    // so a rep whose app dies / loses network / is force-closed shows
    // offline within ~1.5 minutes regardless of the explicit toggle.
    label: 'users.last_online_ping_at',
    sql: 'ALTER TABLE users ADD COLUMN last_online_ping_at DATETIME NULL',
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
  // Per-booking price-split snapshot. Without these, Finance & Accounts
  // can only show GROSS revenue (sum of final_price); it can't separate
  // out what the company keeps (margin) vs. what passes through to govt
  // fees + service-partner earnings. Snapshotted at booking-create time
  // so old bookings stay immune to later rate-chart edits.
  {
    label: 'bookings.govt_fees',
    sql: 'ALTER TABLE bookings ADD COLUMN govt_fees DECIMAL(10,2) NULL',
  },
  {
    label: 'bookings.partner_earning',
    sql: 'ALTER TABLE bookings ADD COLUMN partner_earning DECIMAL(10,2) NULL',
  },
  {
    label: 'bookings.company_margin',
    sql: 'ALTER TABLE bookings ADD COLUMN company_margin DECIMAL(10,2) NULL',
  },
  // Applicant name — the person the service is FOR, distinct from the
  // customer who books / pays. Common when a customer books an Aadhaar
  // update for a family member. Captured in the booking form
  // (BookingScreen.tsx) but was silently dropped server-side until this
  // column existed; admin Order Management + agent Earnings Ledger now
  // surface it so reps know who they're serving.
  {
    label: 'bookings.applicant_name',
    sql: 'ALTER TABLE bookings ADD COLUMN applicant_name VARCHAR(100) NULL',
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

  // NOTE: previously this function returned early when `pending.length === 0`.
  // That worked for ADD COLUMN-only migrations but silently SKIPPED the
  // RELAXATIONS step in step 3 — meaning any MODIFY COLUMN added to the
  // RELAXATIONS list AFTER the columns were first added would never run
  // because the function always exited at this guard. We now always
  // proceed; step 2 just becomes a no-op when there are no pending adds.
  if (pending.length > 0) {
    console.log(`[boot-migrate] applying ${pending.length} pending migration(s)…`);
  }

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

  // ─── Step 3: schema relaxations ────────────────────────────────────────
  // MODIFY COLUMN statements that drop NOT NULL / change a default. These
  // are idempotent — running on an already-relaxed column is a no-op
  // (TiDB silently accepts), so we don't need a probe step. We just try
  // each one and log the result.
  for (const r of RELAXATIONS) {
    try {
      await sequelize.query(r.sql);
      console.log(`[boot-migrate] ✅ ${r.label} — relaxed`);
    } catch (e) {
      console.error(`[boot-migrate] ❌ ${r.label}:`, e?.message);
    }
  }
};

// MODIFY COLUMN statements applied unconditionally on every boot.
// Add entries here when you need to drop a NOT NULL or change a column
// type — they're idempotent so re-running causes no harm.
const RELAXATIONS = [
  // Compliance Register — personal-tracker rows aren't tied to a B2B
  // company profile, so company_profile_id has to allow NULL. Without
  // this relaxation, the customer's "Add row" upload fails with
  // "Column 'company_profile_id' cannot be null".
  {
    label: 'vault_documents.company_profile_id → NULL',
    sql: 'ALTER TABLE vault_documents MODIFY COLUMN company_profile_id CHAR(36) NULL',
  },
  // Cloudinary secure URLs run 200-300 chars routinely (full domain +
  // versioned path + UUID-like filename). The original VARCHAR(128) cap
  // was big enough for the local-disk basename fallback but too small
  // for the production Cloudinary URLs — uploads were failing with
  // "Data too long for column 'stored_name' [ER_DATA_TOO_LONG]". 512
  // covers any URL we realistically see.
  {
    label: 'vault_documents.stored_name → VARCHAR(512)',
    sql: 'ALTER TABLE vault_documents MODIFY COLUMN stored_name VARCHAR(512) NOT NULL',
  },
];
