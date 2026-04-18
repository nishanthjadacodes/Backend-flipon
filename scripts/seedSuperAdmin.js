import 'dotenv/config';
import { sequelize } from '../src/config/database.js';
import { User, syncModels } from '../src/models/index.js';

const seedSuperAdmin = async () => {
  try {
    // Connect to database
    await sequelize.authenticate();
    console.log('Database connection established.');

    // Sync models
    await syncModels();
    console.log('Database models synchronized.');

    // Check if super admin already exists
    const existingSuperAdmin = await User.findOne({
      where: { role: 'super_admin' }
    });

    if (existingSuperAdmin) {
      console.log('Super admin user already exists:');
      console.log(`Mobile: ${existingSuperAdmin.mobile}`);
      console.log(`Role: ${existingSuperAdmin.role}`);
      console.log(`ID: ${existingSuperAdmin.id}`);
      return;
    }

    // Create super admin user
    const superAdmin = await User.create({
      mobile: '9999999999', // Default super admin mobile
      name: 'Super Admin',
      role: 'super_admin',
      is_verified: true,
      is_active: true,
      online_status: false
    });

    console.log('Super admin user created successfully:');
    console.log(`Mobile: ${superAdmin.mobile}`);
    console.log(`Name: ${superAdmin.name}`);
    console.log(`Role: ${superAdmin.role}`);
    console.log(`ID: ${superAdmin.id}`);
    console.log('\nTo login as super admin:');
    console.log('1. Send OTP to: 9999999999');
    console.log('2. Use OTP: 123456 (for testing)');
    console.log('3. You will receive a JWT token with super_admin role');

  } catch (error) {
    console.error('Error creating super admin:', error);
  } finally {
    await sequelize.close();
    console.log('Database connection closed.');
  }
};

seedSuperAdmin();
