// One-shot script for bootstrapping (or resetting) an admin account
// on the FliponeX backend. Uses raw SQL via the same Sequelize
// connection the API uses, intentionally bypassing the User model so
// schema-drift columns the live DB hasn't received yet (e.g.
// profile_pic before its migration runs) can't trip up the insert.
//
// USAGE (from c:/Users/hp/flipon-backend):
//
//   node scripts/create-admin.js <email> <password> <name> <mobile> <role>
//
// Example:
//
//   node scripts/create-admin.js admin@fliponex.com "MyStrong#Pass1" "Khooshi Sanatan" "+916206192330" super_admin
//
// `role` must be one of:
//   super_admin | operations_manager | b2b_admin | finance_admin | customer_support
//
// If the email already exists, the script UPDATES password + role
// instead of failing — handy for "forgot password" resets.

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sequelize } from '../src/config/database.js';

const ADMIN_ROLES = [
  'super_admin',
  'operations_manager',
  'b2b_admin',
  'finance_admin',
  'customer_support',
];

const [, , email, password, name, mobile, role] = process.argv;

if (!email || !password || !name || !mobile || !role) {
  console.error('Missing argument. Expected:');
  console.error('  node scripts/create-admin.js <email> <password> <name> <mobile> <role>');
  console.error('');
  console.error('Example:');
  console.error('  node scripts/create-admin.js admin@fliponex.com "MyPass#1" "Khooshi Sanatan" "+916206192330" super_admin');
  process.exit(1);
}

if (!ADMIN_ROLES.includes(role)) {
  console.error(`Invalid role "${role}". Must be one of: ${ADMIN_ROLES.join(', ')}`);
  process.exit(1);
}

(async () => {
  try {
    await sequelize.authenticate();
    console.log('[db] connected');

    const password_hash = await bcrypt.hash(password, 10);
    const normalizedEmail = email.toLowerCase();

    // Raw query against ONLY columns that exist on every backend version.
    // Bypasses Sequelize's model so missing nullable columns the live DB
    // hasn't received yet (e.g. profile_pic before its boot-migration
    // runs) can't break this script. Touches the absolute minimum row
    // shape needed for login: id, name, email, mobile, role, hash, the
    // two flag columns, plus timestamps.

    const [rows] = await sequelize.query(
      'SELECT id FROM users WHERE email = :email LIMIT 1',
      { replacements: { email: normalizedEmail } },
    );

    if (rows.length > 0) {
      const id = rows[0].id;
      await sequelize.query(
        `UPDATE users
           SET name = :name,
               mobile = :mobile,
               role = :role,
               password_hash = :password_hash,
               is_active = 1,
               is_verified = 1,
               updated_at = NOW()
         WHERE id = :id`,
        { replacements: { id, name, mobile, role, password_hash } },
      );
      console.log(`[ok] UPDATED existing admin: ${id}`);
    } else {
      const newId = crypto.randomUUID();
      await sequelize.query(
        `INSERT INTO users (id, name, email, mobile, role, password_hash, is_active, is_verified, created_at, updated_at)
         VALUES (:id, :name, :email, :mobile, :role, :password_hash, 1, 1, NOW(), NOW())`,
        {
          replacements: {
            id: newId,
            name,
            email: normalizedEmail,
            mobile,
            role,
            password_hash,
          },
        },
      );
      console.log(`[ok] CREATED new admin: ${newId}`);
    }

    console.log(`     email:    ${normalizedEmail}`);
    console.log(`     role:     ${role}`);
    console.log(`     password: (set, hashed)`);
    console.log('');
    console.log('You can now sign in at the admin dashboard /login screen with this email + password.');
  } catch (err) {
    console.error('[error]', err?.message || err);
    process.exitCode = 1;
  } finally {
    await sequelize.close().catch(() => {});
  }
})();
