// Frees admin role seats so /signup can hand them out again.
//
// Two modes:
//
//   (default)   Clears only the four NON-super-admin roles, leaving
//               your existing super_admin account alone. Useful when
//               you want to keep the founder login working.
//
//   --all       Also clears super_admin. You'll be logged out of any
//               open dashboard session — use this when you want a
//               truly blank slate and intend to immediately
//               re-register the founder via /signup.
//
// Delete strength:
//
//   (default)   SOFT delete — sets is_active = false. Reversible, but
//               the email address stays on the inactive row, so trying
//               to re-sign-up with the SAME email will 409 on the
//               "email already exists" check.
//
//   --hard      Permanently DELETE the rows. Cannot be undone. Use
//               this combo (`--all --hard`) when you want to start
//               over and re-use the same emails (e.g.
//               admin@fliponex.com).
//
// Other flags:
//
//   --dry       Print what would change, no writes. Always run this
//               first before --hard.
//   --confirm   Required alongside --all to acknowledge that you
//               understand it deletes the currently-logged-in
//               super_admin too.
//
// USAGE EXAMPLES:
//
//   node scripts/reset-admin-seats.js --dry             # preview
//   node scripts/reset-admin-seats.js                   # soft clear non-super
//   node scripts/reset-admin-seats.js --all --confirm   # soft clear EVERYONE
//   node scripts/reset-admin-seats.js --all --hard --confirm   # nuke EVERYONE

import 'dotenv/config';
import { sequelize } from '../src/config/database.js';

const NON_SUPER_ROLES = [
  'operations_manager',
  'b2b_admin',
  'finance_admin',
  'customer_support',
];
const ALL_ADMIN_ROLES = ['super_admin', ...NON_SUPER_ROLES];

const args = process.argv.slice(2);
const hard = args.includes('--hard');
const dry = args.includes('--dry');
const all = args.includes('--all');
const confirmed = args.includes('--confirm');

const targetRoles = all ? ALL_ADMIN_ROLES : NON_SUPER_ROLES;

if (all && !confirmed && !dry) {
  console.error('');
  console.error('--all clears the super_admin account too — including the one you log in with.');
  console.error('Re-run with `--confirm` if you really want that:');
  console.error('');
  console.error('   node scripts/reset-admin-seats.js --all --confirm');
  console.error('   node scripts/reset-admin-seats.js --all --hard --confirm');
  console.error('');
  process.exit(1);
}

(async () => {
  try {
    await sequelize.authenticate();
    console.log('[db] connected');

    const [allAdmins] = await sequelize.query(
      `SELECT id, name, email, role, is_active
         FROM users
        WHERE role IN ('super_admin','operations_manager','b2b_admin','finance_admin','customer_support')
        ORDER BY role, created_at DESC`,
    );

    console.log('');
    console.log(`Mode: ${all ? 'ALL admin roles' : 'NON-super-admin roles only'} · ${hard ? 'HARD delete' : 'SOFT delete (is_active=0)'} · ${dry ? 'DRY RUN' : 'LIVE'}`);
    console.log('Current admin rows in DB:');
    console.log('─'.repeat(80));
    for (const a of allAdmins) {
      const targeted = targetRoles.includes(a.role);
      const action = !targeted
        ? '  KEEP  '
        : (a.is_active || hard ? ' CLEAR  ' : '  (already inactive)  ');
      console.log(
        `${action}  ${String(a.role).padEnd(20)}  ${String(a.email).padEnd(35)}  ${a.name}`,
      );
    }
    console.log('─'.repeat(80));

    const targets = allAdmins.filter(
      (a) => targetRoles.includes(a.role) && (hard || a.is_active),
    );
    if (targets.length === 0) {
      console.log('Nothing to do — no targeted rows to clear.');
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
        { replacements: { roles: targetRoles } },
      );
      console.log('');
      console.log(`[ok] HARD-DELETED ${meta?.affectedRows ?? targets.length} admin row(s).`);
      if (all) {
        console.log('     All admin seats are now empty AND emails are freed up.');
        console.log('     Visit /signup to register your founder account first — pick super_admin.');
      } else {
        console.log('     Non-super-admin seats are now empty AND those emails are freed up.');
      }
    } else {
      const [, meta] = await sequelize.query(
        `UPDATE users
            SET is_active = 0, updated_at = NOW()
          WHERE role IN (:roles) AND is_active = 1`,
        { replacements: { roles: targetRoles } },
      );
      console.log('');
      console.log(`[ok] DEACTIVATED ${meta?.affectedRows ?? targets.length} admin row(s).`);
      console.log('     Seats are free for fresh /signup registrations.');
      console.log('     NOTE: the email addresses on the deactivated rows still exist.');
      console.log('     Re-using the SAME email at signup will 409. Use --hard to drop emails too.');
    }

    // Post-state summary.
    const [after] = await sequelize.query(
      `SELECT role, COUNT(*) AS total, SUM(is_active) AS active
         FROM users
        WHERE role IN ('super_admin','operations_manager','b2b_admin','finance_admin','customer_support')
        GROUP BY role`,
    );
    console.log('');
    console.log('Post-cleanup seat status:');
    console.log('─'.repeat(60));
    for (const role of ALL_ADMIN_ROLES) {
      const row = after.find((r) => r.role === role);
      if (row) {
        console.log(`${String(role).padEnd(20)}  active=${row.active}/${row.total}`);
      } else {
        console.log(`${String(role).padEnd(20)}  (no rows — free for signup)`);
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
