import 'dotenv/config';
import { sequelize } from '../src/config/database.js';

// Idempotent schema migration: adds admin-login fields + extends role ENUM.
// Safe to re-run. No destructive statements.
const run = async () => {
  const q = sequelize.getQueryInterface();
  try {
    await sequelize.authenticate();
    console.log('DB connected.');

    const table = await q.describeTable('users');

    if (!table.password_hash) {
      await sequelize.query(
        "ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NULL AFTER email"
      );
      console.log('+ users.password_hash added');
    } else {
      console.log('= users.password_hash already present');
    }

    // Add unique index on email (ignoring NULLs) if missing
    const [indexes] = await sequelize.query("SHOW INDEX FROM users WHERE Key_name = 'users_email_unique'");
    if (indexes.length === 0) {
      try {
        await sequelize.query("CREATE UNIQUE INDEX users_email_unique ON users(email)");
        console.log('+ unique index on users.email added');
      } catch (e) {
        console.warn('! could not add unique index on email (likely duplicate emails exist):', e.message);
      }
    } else {
      console.log('= users.email unique index already present');
    }

    // Expand role ENUM
    await sequelize.query(
      "ALTER TABLE users MODIFY COLUMN role ENUM('super_admin','operations_manager','b2b_admin','finance_admin','customer_support','agent','customer') NOT NULL DEFAULT 'agent'"
    );
    console.log('+ users.role ENUM extended to 7 values');

    console.log('\n✓ Migration complete.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
};

run();
