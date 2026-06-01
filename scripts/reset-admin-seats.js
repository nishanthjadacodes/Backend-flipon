// Frees every admin role seat EXCEPT super_admin by setting
// is_active = false on those accounts. The signup endpoint counts
// only active rows when enforcing per-role uniqueness, so after
// running this:
//
//   • super_admin row(s) stay live — you can still log in with the
//     existing super-admin credentials, dashboard keeps working
//   • operations_manager, b2b_admin, finance_admin, customer_support
//     seats become available for fresh /signup registrations
//
// Soft delete (is_active = false) by design — keeps history, audit
// trail, and the option to reactivate later via Admin Controls. Pass
// `--hard` to actually DELETE the rows instead (irreversible).
//
// USAGE:
//
//   node scripts/reset-admin-seats.js          # soft delete
//   node scripts/reset-admin-seats.js --hard   # permanently delete
//   node scripts/reset-admin-seats.js --dry    # print what would change, no writes

import 'dotenv/config';
import { sequelize } from '../src/config/database.js';

const ADMIN_ROLES_TO_CLEAR = [
  'operations_manager',
  'b2b_admin',
  'finance_admin',
  'customer_support',
];

const args = process.argv.slice(2);
const hard = args.includes('--hard');
const dry = args.includes('--dry');

(async () => {
  try {
    await sequelize.authenticate();
    console.log('[db] connected');

    // List current admin rows so the operator can see what's about to
    // change before any writes happen.
    const [allAdmins] = await sequelize.query(
      `SELECT id, name, email, role, is_active
         FROM users
        WHERE role IN ('super_admin','operations_manager','b2b_admin','finance_admin','customer_support')
        ORDER BY role, created_at DESC`,
    );

    console.log('');
    console.log('Current admin rows in DB:');
    console.log('─'.repeat(80));
    for (const a of allAdmins) {
      const keep = a.role === 'super_admin' ? '  KEEP  ' : (a.is_active ? ' CLEAR  ' : '  (already inactive)  ');
      console.log(
        `${keep}  ${String(a.role).padEnd(20)}  ${String(a.email).padEnd(35)}  ${a.name}`,
      );
    }
    console.log('─'.repeat(80));

    const targets = allAdmins.filter(
      (a) => ADMIN_ROLES_TO_CLEAR.includes(a.role) && (hard || a.is_active),
    );
    if (targets.length === 0) {
      console.log('Nothing to do — no non-super-admin accounts to clear.');
      return;
    }

    if (dry) {
      console.log('');
      console.log(`DRY RUN — would ${hard ? 'DELETE' : 'deactivate'} ${targets.length} row(s). No writes performed.`);
      return;
    }

    if (hard) {
      const [, meta] = await sequelize.query(
        `DELETE FROM users WHERE role IN (:roles)`,
        { replacements: { roles: ADMIN_ROLES_TO_CLEAR } },
      );
      console.log('');
      console.log(`[ok] HARD-DELETED ${meta?.affectedRows ?? targets.length} non-super-admin rows.`);
    } else {
      const [, meta] = await sequelize.query(
        `UPDATE users
            SET is_active = 0, updated_at = NOW()
          WHERE role IN (:roles) AND is_active = 1`,
        { replacements: { roles: ADMIN_ROLES_TO_CLEAR } },
      );
      console.log('');
      console.log(`[ok] DEACTIVATED ${meta?.affectedRows ?? targets.length} non-super-admin row(s).`);
      console.log('     Seats are now free for fresh /signup registrations.');
      console.log('     To restore later, set is_active = 1 in Admin Controls.');
    }

    // Show the new state.
    const [after] = await sequelize.query(
      `SELECT role, COUNT(*) AS total, SUM(is_active) AS active
         FROM users
        WHERE role IN ('super_admin','operations_manager','b2b_admin','finance_admin','customer_support')
        GROUP BY role`,
    );
    console.log('');
    console.log('Post-cleanup seat status:');
    console.log('─'.repeat(60));
    for (const r of after) {
      console.log(`${String(r.role).padEnd(20)}  active=${r.active}/${r.total}`);
    }
    for (const role of ['super_admin', ...ADMIN_ROLES_TO_CLEAR]) {
      if (!after.find((r) => r.role === role)) {
        console.log(`${role.padEnd(20)}  active=0/0  (no rows — free for signup)`);
      }
    }
    console.log('─'.repeat(60));
  } catch (err) {
    console.error('[error]', err?.message || err);
    process.exitCode = 1;
  } finally {
    await sequelize.close().catch(() => {});
  }
})();
