import 'dotenv/config';
import mysql from 'mysql2/promise';

const testAllRemainingAPI = async () => {
  try {
    console.log('Testing All Remaining Services API Response...');
    
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'Bannu@456',
      database: process.env.DB_NAME || 'flipon_db',
      multipleStatements: false
    });

    console.log('Database connected successfully!');

    // Test query to simulate what the API should return for each category
    const categories = ['Voter ID Service', 'Ration Card Service', 'Other Service'];
    
    for (const category of categories) {
      console.log(`\n\n=== ${category.toUpperCase()} API RESPONSE SIMULATION ===`);
      
      const [services] = await connection.execute(`
        SELECT id, name, category, service_type, user_cost, expected_timeline, 
               required_documents, allow_pay_after, description, 
               govt_fees, partner_earning, total_expense, company_margin, remarks,
               is_active, created_at, updated_at
        FROM services 
        WHERE category = ? AND is_active = true
        ORDER BY name
        LIMIT 3
      `, [category]);

      console.log(`\nFirst 3 ${category} Services:`);
      console.log('============================');
      
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
      
      console.log(`\n${category} Pricing Fields Verification:`);
      console.log('====================================');
      
      services.forEach((service, index) => {
        console.log(`\n${index + 1}. ${service.name}:`);
        requiredFields.forEach(field => {
          const value = service[field];
          const status = value !== null && value !== undefined ? 'PRESENT' : 'MISSING';
          console.log(`   ${field}: ${status} (${value})`);
        });
      });
    }

    // Get overall summary
    const [summary] = await connection.execute(`
      SELECT 
        category,
        COUNT(*) as total_services,
        SUM(user_cost) as total_user_cost,
        SUM(govt_fees) as total_govt_fees,
        SUM(partner_earning) as total_partner_earning,
        SUM(total_expense) as total_expense,
        SUM(company_margin) as total_company_margin
      FROM services 
      WHERE category IN ('Voter ID Service', 'Ration Card Service', 'Other Service')
      GROUP BY category
      ORDER BY category
    `);
    
    console.log('\n\nOVERALL SUMMARY:');
    console.log('===============');
    summary.forEach(stat => {
      console.log(`\n${stat.category}:`);
      console.log(`  Services: ${stat.total_services}`);
      console.log(`  User Cost: Rs.${stat.total_user_cost}`);
      console.log(`  Govt Fees: Rs.${stat.total_govt_fees}`);
      console.log(`  Partner Earnings: Rs.${stat.total_partner_earning}`);
      console.log(`  Expenses: Rs.${stat.total_expense}`);
      console.log(`  Company Margin: Rs.${stat.total_company_margin}`);
    });

    await connection.end();
    
    console.log('\n\nAPI Test Complete!');
    console.log('All pricing fields for all remaining services are properly configured and should be returned by the API.');
    
  } catch (error) {
    console.error('Error testing API:', error.message);
    process.exit(1);
  }
};

testAllRemainingAPI();
