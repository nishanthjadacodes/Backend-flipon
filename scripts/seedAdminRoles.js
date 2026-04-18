import 'dotenv/config';
import { sequelize } from '../src/config/database.js';
import { AdminRole } from '../src/models/index.js';
import { ROLE_PERMISSIONS } from '../src/constants/permissions.js';

const seedAdminRoles = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established for seeding.');

    await AdminRole.sync({ force: false });

    for (const [roleName, perms] of Object.entries(ROLE_PERMISSIONS)) {
      const [row, created] = await AdminRole.findOrCreate({
        where: { role_name: roleName },
        defaults: { role_name: roleName, permissions: perms },
      });
      if (!created) {
        await row.update({ permissions: perms });
        console.log(`= ${roleName} role permissions updated (${perms.length === 1 && perms[0] === '*' ? 'wildcard' : perms.length + ' permissions'})`);
      } else {
        console.log(`+ ${roleName} role created (${perms.length === 1 && perms[0] === '*' ? 'wildcard' : perms.length + ' permissions'})`);
      }
    }

    console.log('\n✓ Admin roles seed complete.');
  } catch (error) {
    console.error('Error seeding admin roles:', error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
};

seedAdminRoles();
