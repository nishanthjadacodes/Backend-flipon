import 'dotenv/config';
import { sequelize } from '../src/config/database.js';
import { Service, syncModels } from '../src/models/index.js';

const cleanupTestServices = async () => {
  try {
    // Connect to database
    await sequelize.authenticate();
    console.log('Database connection established.');

    // Sync models
    await syncModels();
    console.log('Database models synchronized.');

    // Test services to remove (from initial development)
    const testServicesToRemove = [
      'Home Cleaning',
      'AC Repair',
      'Office Cleaning',
      'Home Cleaning Service',
      'AC Repair Service',
      'Office Cleaning Service',
      'Plumbing Service',
      'Electrical Service',
      'Carpentry Service',
      'Painting Service',
      'Pest Control Service',
      'Deep Cleaning Service',
      'Sofa Cleaning Service',
      'Car Cleaning Service',
      'Kitchen Cleaning Service',
      'Bathroom Cleaning Service',
      'Garden Maintenance',
      'Water Tank Cleaning',
      'Full Home Cleaning',
      'Window Cleaning Service'
    ];

    console.log('Removing test services...');

    // Remove test services
    const deletedCount = await Service.destroy({
      where: {
        name: testServicesToRemove
      }
    });

    console.log(`Deleted ${deletedCount} test services`);

    // Check current services in database
    const currentServices = await Service.findAll({
      attributes: ['id', 'name', 'category', 'base_price', 'service_type'],
      order: [['category', 'ASC'], ['name', 'ASC']]
    });

    console.log('\nCurrent services in database:');
    console.log('=====================================');

    let totalServices = 0;
    const categoryCount = {};

    currentServices.forEach(service => {
      console.log(`- ${service.name} (${service.category}) - Rs.${service.base_price}`);
      totalServices++;
      categoryCount[service.category] = (categoryCount[service.category] || 0) + 1;
    });

    console.log('\nService Summary:');
    console.log('==================');
    console.log(`Total Services: ${totalServices}`);
    
    Object.entries(categoryCount).forEach(([category, count]) => {
      console.log(`${category}: ${count} services`);
    });

    // Verify all government services are present
    const expectedServices = [
      // Aadhaar Services
      'DOB update in Aadhaar',
      'Name update in Aadhaar', 
      'Father/Husband name update in Aadhaar',
      'Address update in Aadhaar',
      'Aadhaar PVC Card',
      
      // Welfare Services
      'AYUSMAN CARD',
      'BIRTH CERTIFICATE',
      'All India Old Age Pension Scheme',
      'All India Disability Pension Scheme',
      'Deen Dayal Swasthya Seva Yojana-Goa',
      
      // Certificate Services
      'DOMICILE CERTIFICATE',
      'DRIVING LICENSE',
      'NEW PAN',
      'FASAL BHIMA',
      'GRIHA AADHAR SCHEMA-GOA',
      'JOB CARD',
      
      // State Schemes
      'KISAN SAMRIDHI YOJANA -JHARKHAND',
      'Laadli Laxmi Scheme-Goa',
      'Mukhyamantri Abua Swasthya Yojana - JH(MAAY-JH)',
      'Mukhyamantri Maiya Samman Yojana-JH'
    ];

    const missingServices = expectedServices.filter(expected => 
      !currentServices.some(service => service.name === expected)
    );

    if (missingServices.length > 0) {
      console.log('\nMissing services that need to be seeded:');
      missingServices.forEach(service => console.log(`- ${service}`));
    } else {
      console.log('\nAll expected government services are present! ');
    }

  } catch (error) {
    console.error('Error cleaning up test services:', error);
  } finally {
    await sequelize.close();
    console.log('Database connection closed.');
  }
};

cleanupTestServices();
