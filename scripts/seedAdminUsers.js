import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { sequelize } from '../src/config/database.js';
import { User, syncModels } from '../src/models/index.js';
import { ADMIN_ROLE_NAMES } from '../src/constants/permissions.js';

// Creates one admin user per role with a known default password.
// Re-runs are safe: skips accounts whose email already exists (does NOT reset passwords).
const DEFAULT_PASSWORD = 'Admin@123';

const ADMINS = [
  { role: 'super_admin',        email: 'admin@flipon.local',       mobile: '9999999999', name: 'Super Admin' },
  { role: 'operations_manager', email: 'operations@flipon.local',  mobile: '9999999001', name: 'Operations Manager' },
  { role: 'b2b_admin',          email: 'b2b@flipon.local',         mobile: '9999999002', name: 'B2B / Industrial Admin' },
  { role: 'finance_admin',      email: 'finance@flipon.local',     mobile: '9999999003', name: 'Finance & Accounts Admin' },
  { role: 'customer_support',   email: 'support@flipon.local',     mobile: '9999999004', name: 'Customer Support Admin' },
];

const run = async () => {
  try {
    await sequelize.authenticate();
    console.log('DB connected.');
    await syncModels();

    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    for (const spec of ADMINS) {
      if (!ADMIN_ROLE_NAMES.includes(spec.role)) {
        console.warn(`skip ${spec.email}: role ${spec.role} not in ADMIN_ROLE_NAMES`);
        continue;
      }

      // Prefer match-by-email. Fall back: attach password + role to existing mobile-only super admin.
      let user = await User.findByEmail(spec.email);
      if (!user && spec.role === 'super_admin') {
        user = await User.findByMobile(spec.mobile);
      }

      if (!user) {
        user = await User.create({
          email: spec.email.toLowerCase(),
          mobile: spec.mobile,
          name: spec.name,
          role: spec.role,
          password_hash: passwordHash,
          is_verified: true,
          is_active: true,
        });
        console.log(`+ created ${spec.role} → ${spec.email}`);
      } else {
        const updates = { role: spec.role, name: user.name || spec.name, is_active: true, is_verified: true };
        if (!user.email) updates.email = spec.email.toLowerCase();
        if (!user.password_hash) updates.password_hash = passwordHash;
        await user.update(updates);
        console.log(`= updated ${spec.role} → ${user.email || spec.email}${user.password_hash ? '' : ' (password set)'}`);
      }
    }

    console.log(`\n✓ Admin users seed complete. Default password: ${DEFAULT_PASSWORD}`);
    console.log('  Change via POST /api/auth/admin/change-password after first login.');
  } catch (error) {
    console.error('Error seeding admin users:', error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
};

run();
