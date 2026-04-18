import 'dotenv/config';
import mysql from 'mysql2/promise';

const testAadhaarAPI = async () => {
  try {
    console.log('Testing Aadhaar Services API Response...');
    
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'Bannu@456',
      database: process.env.DB_NAME || 'flipon_db',
      multipleStatements: false
    });

    console.log('Database connected successfully!');

    // Test query to simulate what the API should return
    const [services] = await connection.execute(`
      SELECT id, name, category, service_type, user_cost, expected_timeline, 
             required_documents, allow_pay_after, description, 
             govt_fees, partner_earning, total_expense, company_margin, remarks,
             is_active, created_at, updated_at
      FROM services 
      WHERE category = 'Aadhaar Services' AND is_active = true
      ORDER BY name
      LIMIT 3
    `);

    console.log('\nAPI Response Simulation (First 3 Aadhaar Services):');
    console.log('====================================================');
    
    services.forEach((service, index) => {
      console.log(`\n${index + 1}. ${service.name}`);
      console.log(JSON.stringify({
        id: service.id,
        name: service.name,
        category: service.category,
        service_type: service.service_type,
        user_cost: service.user_cost,
        govt_fees: service.govt_fees,
        partner_earning: service.partner_earning,
        total_expense: service.total_expense,
        expected_timeline: service.expected_timeline,
        company_margin: service.company_margin,
        remarks: service.remarks,
        allow_pay_after: service.allow_pay_after,
        description: service.description,
        is_active: service.is_active
      }, null, 2));
    });

    // Check if all pricing fields are present
    const requiredFields = ['user_cost', 'govt_fees', 'partner_earning', 'total_expense', 'expected_timeline', 'company_margin', 'remarks'];
    
    console.log('\n\nPricing Fields Verification:');
    console.log('============================');
    
    services.forEach((service, index) => {
      console.log(`\n${index + 1}. ${service.name}:`);
      requiredFields.forEach(field => {
        const value = service[field];
        const status = value !== null && value !== undefined ? 'PRESENT' : 'MISSING';
        console.log(`   ${field}: ${status} (${value})`);
      });
    });

    await connection.end();
    
    console.log('\nAPI Test Complete!');
    console.log('All pricing fields should now be properly returned by the API.');
    
  } catch (error) {
    console.error('Error testing API:', error.message);
    process.exit(1);
  }
};

testAadhaarAPI();
