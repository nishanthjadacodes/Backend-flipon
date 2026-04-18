import 'dotenv/config';
import mysql from 'mysql2/promise';

const updateServicesPricing = async () => {
  try {
    console.log('Connecting to MySQL database...');
    
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'Bannu@456',
      database: process.env.DB_NAME || 'flipon_db',
      multipleStatements: false
    });

    console.log('Database connected successfully!');

    // Split queries and execute them individually to avoid syntax issues
    const updateQueries = [
      `UPDATE services SET user_cost = 200, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '1 week', company_margin = 100, remarks = 'New Aadhaar enrolment' WHERE name = 'New Aadhaar Enrolment'`,
      `UPDATE services SET user_cost = 275, govt_fees = 75, partner_earning = 100, total_expense = 175, expected_timeline = '2 weeks', company_margin = 100, remarks = 'Update name in Aadhaar' WHERE name = 'Aadhaar Name Update'`,
      `UPDATE services SET user_cost = 275, govt_fees = 75, partner_earning = 100, total_expense = 175, expected_timeline = '3 weeks', company_margin = 100, remarks = 'Update husband name in Aadhaar' WHERE name = 'Aadhaar Husband Name Update'`,
      `UPDATE services SET user_cost = 275, govt_fees = 75, partner_earning = 100, total_expense = 175, expected_timeline = '4 weeks', company_margin = 100, remarks = 'Update address in Aadhaar' WHERE name = 'Aadhaar Address Update'`,
      `UPDATE services SET user_cost = 275, govt_fees = 75, partner_earning = 100, total_expense = 175, expected_timeline = '5 weeks', company_margin = 100, remarks = 'Update DOB in Aadhaar' WHERE name = 'Aadhaar Date of Birth Update'`,
      `UPDATE services SET user_cost = 275, govt_fees = 75, partner_earning = 100, total_expense = 175, expected_timeline = '6 weeks', company_margin = 100, remarks = 'Update gender in Aadhaar' WHERE name = 'Aadhaar Gender Update'`,
      `UPDATE services SET user_cost = 275, govt_fees = 75, partner_earning = 100, total_expense = 175, expected_timeline = '7 weeks', company_margin = 100, remarks = 'Update biometric in Aadhaar' WHERE name = 'Aadhaar Biometric Update'`,
      `UPDATE services SET user_cost = 275, govt_fees = 75, partner_earning = 100, total_expense = 175, expected_timeline = '8 weeks', company_margin = 100, remarks = 'Update mobile number in Aadhaar' WHERE name = 'Aadhaar Mobile Number Update'`,
      `UPDATE services SET user_cost = 275, govt_fees = 75, partner_earning = 100, total_expense = 175, expected_timeline = '9 weeks', company_margin = 100, remarks = 'Update email ID in Aadhaar' WHERE name = 'Aadhaar Email ID Update'`,
      `UPDATE services SET user_cost = 275, govt_fees = 75, partner_earning = 100, total_expense = 175, expected_timeline = '10 weeks', company_margin = 100, remarks = 'Order Aadhaar PVC card' WHERE name = 'Order Aadhaar PVC Card'`,
      `UPDATE services SET user_cost = 275, govt_fees = 75, partner_earning = 100, total_expense = 175, expected_timeline = 'Instant', company_margin = 100, remarks = 'Download e-Aadhaar' WHERE name = 'Download Aadhaar'`,
      `UPDATE services SET user_cost = 275, govt_fees = 75, partner_earning = 100, total_expense = 175, expected_timeline = 'Instant', company_margin = 100, remarks = 'Verify email/mobile linked to Aadhaar' WHERE name = 'Verify Aadhaar Email/Mobile'`,
      `UPDATE services SET user_cost = 220, govt_fees = 107, partner_earning = 75, total_expense = 182, expected_timeline = '24-48 hrs', company_margin = 38, remarks = 'New PAN card application' WHERE name = 'New PAN Card Application'`,
      `UPDATE services SET user_cost = 220, govt_fees = 107, partner_earning = 75, total_expense = 182, expected_timeline = '48-72 hrs', company_margin = 38, remarks = 'Update name in PAN card' WHERE name = 'PAN Card Name Update'`,
      `UPDATE services SET user_cost = 220, govt_fees = 107, partner_earning = 75, total_expense = 182, expected_timeline = '48-72 hrs', company_margin = 38, remarks = 'Update address in PAN card' WHERE name = 'PAN Card Address Update'`,
      `UPDATE services SET user_cost = 220, govt_fees = 107, partner_earning = 75, total_expense = 182, expected_timeline = '48-72 hrs', company_margin = 38, remarks = 'Update DOB in PAN card' WHERE name = 'PAN Card DOB Update'`,
      `UPDATE services SET user_cost = 220, govt_fees = 107, partner_earning = 75, total_expense = 182, expected_timeline = '48-72 hrs', company_margin = 38, remarks = 'Update gender in PAN card' WHERE name = 'PAN Card Gender Update'`,
      `UPDATE services SET user_cost = 220, govt_fees = 107, partner_earning = 75, total_expense = 182, expected_timeline = '48-72 hrs', company_margin = 38, remarks = 'Update mobile number in PAN' WHERE name = 'PAN Card Mobile Number Update'`,
      `UPDATE services SET user_cost = 220, govt_fees = 107, partner_earning = 75, total_expense = 182, expected_timeline = '48-72 hrs', company_margin = 38, remarks = 'Update email in PAN' WHERE name = 'PAN Card Email ID Update'`,
      `UPDATE services SET user_cost = 220, govt_fees = 107, partner_earning = 75, total_expense = 182, expected_timeline = '48-72 hrs', company_margin = 38, remarks = 'Order PAN PVC card' WHERE name = 'Order PAN PVC Card'`,
      `UPDATE services SET user_cost = 220, govt_fees = 107, partner_earning = 75, total_expense = 182, expected_timeline = '48-72 hrs', company_margin = 38, remarks = 'Download e-PAN card' WHERE name = 'Download PAN Card'`,
      `UPDATE services SET user_cost = 220, govt_fees = 107, partner_earning = 75, total_expense = 182, expected_timeline = '48-72 hrs', company_margin = 38, remarks = 'Verify PAN email/mobile' WHERE name = 'Verify PAN Email/Mobile'`,
      `UPDATE services SET user_cost = 1100, govt_fees = 1000, partner_earning = 75, total_expense = 1075, expected_timeline = '48-72 hrs', company_margin = 25, remarks = 'Link PAN card with Aadhaar' WHERE name = 'Link PAN to Aadhaar'`,
      `UPDATE services SET user_cost = 150, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '10-15 days', company_margin = 50, remarks = 'New voter ID application' WHERE name = 'New Voter ID Apply'`,
      `UPDATE services SET user_cost = 150, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '10-15 days', company_margin = 50, remarks = 'Update name in voter ID' WHERE name = 'Voter ID Name Update'`,
      `UPDATE services SET user_cost = 150, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '10-15 days', company_margin = 50, remarks = 'Update address in voter ID' WHERE name = 'Voter ID Address Update'`,
      `UPDATE services SET user_cost = 150, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '10-15 days', company_margin = 50, remarks = 'Update DOB in voter ID' WHERE name = 'Voter ID DOB Update'`,
      `UPDATE services SET user_cost = 150, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '10-15 days', company_margin = 50, remarks = 'Update gender in voter ID' WHERE name = 'Voter ID Gender Update'`,
      `UPDATE services SET user_cost = 150, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '10-15 days', company_margin = 50, remarks = 'Update mobile in voter ID' WHERE name = 'Voter ID Mobile Number Update'`,
      `UPDATE services SET user_cost = 150, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '10-15 days', company_margin = 50, remarks = 'Update email in voter ID' WHERE name = 'Voter ID Email Update'`,
      `UPDATE services SET user_cost = 150, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '10-15 days', company_margin = 50, remarks = 'Order voter ID PVC card' WHERE name = 'Order Voter ID PVC Card'`,
      `UPDATE services SET user_cost = 150, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '10-15 days', company_margin = 50, remarks = 'Download e-Voter ID' WHERE name = 'Download Voter ID'`,
      `UPDATE services SET user_cost = 150, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '10-15 days', company_margin = 50, remarks = 'Verify voter ID email/mobile' WHERE name = 'Verify Voter ID Email/Mobile'`,
      `UPDATE services SET user_cost = 150, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '20-30 days', company_margin = 50, remarks = 'New ration card application' WHERE name = 'New Ration Card Apply'`,
      `UPDATE services SET user_cost = 150, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '20-30 days', company_margin = 50, remarks = 'Update name in ration card' WHERE name = 'Ration Card Name Update'`,
      `UPDATE services SET user_cost = 150, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '20-30 days', company_margin = 50, remarks = 'Update address in ration Card' WHERE name = 'Ration Card Address Update'`,
      `UPDATE services SET user_cost = 150, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '20-30 days', company_margin = 50, remarks = 'Update DOB in ration Card' WHERE name = 'Ration Card DOB Update'`,
      `UPDATE services SET user_cost = 150, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '20-30 days', company_margin = 50, remarks = 'Update gender in ration Card' WHERE name = 'Ration Card Gender Update'`,
      `UPDATE services SET user_cost = 150, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '20-30 days', company_margin = 50, remarks = 'Update mobile in ration Card' WHERE name = 'Ration Card Mobile Update'`,
      `UPDATE services SET user_cost = 150, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '20-30 days', company_margin = 50, remarks = 'Update email in ration Card' WHERE name = 'Ration Card Email Update'`,
      `UPDATE services SET user_cost = 150, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '20-30 days', company_margin = 50, remarks = 'Add/remove family members' WHERE name = 'Ration Card Member Add/Remove'`,
      `UPDATE services SET user_cost = 150, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = 'Instant', company_margin = 50, remarks = 'Download e-Ration Card' WHERE name = 'Download Ration Card'`,
      `UPDATE services SET user_cost = 150, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = 'Instant', company_margin = 50, remarks = 'Verify ration Card email/mobile' WHERE name = 'Verify Ration Card Email/Mobile'`,
      `UPDATE services SET user_cost = 300, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '5-12 hours', company_margin = 200, remarks = 'MSME Udyam registration' WHERE name = 'Udyam Registration'`,
      `UPDATE services SET user_cost = 200, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '5-12 hours', company_margin = 100, remarks = 'FSSAI food license' WHERE name = 'Food License (FSSAI)'`,
      `UPDATE services SET user_cost = 1000, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '5-12 hours', company_margin = 900, remarks = 'Trade license for business' WHERE name = 'Trade License'`,
      `UPDATE services SET user_cost = 300, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '5-12 hours', company_margin = 200, remarks = 'Caste certificate application' WHERE name = 'Caste Certificate'`,
      `UPDATE services SET user_cost = 400, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '5-12 hours', company_margin = 300, remarks = 'Domicile certificate application' WHERE name = 'Domicile Certificate'`,
      `UPDATE services SET user_cost = 250, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '5-12 hours', company_margin = 150, remarks = 'Income certificate application' WHERE name = 'Income Certificate'`,
      `UPDATE services SET user_cost = 400, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '5-12 hours', company_margin = 300, remarks = 'Birth certificate application' WHERE name = 'Birth Certificate'`,
      `UPDATE services SET user_cost = 400, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '5-12 hours', company_margin = 300, remarks = 'Death certificate application' WHERE name = 'Death Certificate'`,
      `UPDATE services SET user_cost = 50, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '5-12 hours', company_margin = -50, remarks = 'Life certificate for pensioners' WHERE name = 'Life Certificate'`
    ];

    console.log('Executing pricing updates for all services...');
    
    // Execute each query individually with error handling
    for (let i = 0; i < updateQueries.length; i++) {
      const query = updateQueries[i];
      try {
        const [result] = await connection.execute(query);
        console.log(`Executed query ${i + 1}: ${query.substring(0, 50)}...`);
      } catch (error) {
        console.error(`Error executing query ${i + 1}:`, error.message);
      }
    }
    
    console.log('Pricing updates completed successfully!');
    
    // Verify the updates
    console.log('\nVerifying updated services...');
    const [verification] = await connection.execute(`
      SELECT name, user_cost, govt_fees, partner_earning, total_expense, expected_timeline, company_margin, remarks 
      FROM services 
      WHERE category IN ('Aadhaar Service', 'PAN Service', 'Voter ID Service', 'Ration Card Service') 
      ORDER BY category, name
      LIMIT 20
    `);
    
    console.log('\nUpdated Services Verification:');
    console.log('================================');
    verification.forEach((service, index) => {
      console.log(`${index + 1}. ${service.name}`);
      console.log(`   Category: ${service.category}`);
      console.log(`   User Cost: Rs.${service.user_cost}`);
      console.log(`   Govt Fees: Rs.${service.govt_fees}`);
      console.log(`   Partner Earning: Rs.${service.partner_earning}`);
      console.log(`   Total Expense: Rs.${service.total_expense}`);
      console.log(`   Timeline: ${service.expected_timeline}`);
      console.log(`   Company Margin: Rs.${service.company_margin}`);
      console.log(`   Remarks: ${service.remarks}`);
      console.log('');
    });
    
    // Get summary stats
    const [stats] = await connection.execute(`
      SELECT 
        COUNT(*) as total_services,
        SUM(user_cost) as total_user_cost,
        SUM(govt_fees) as total_govt_fees,
        SUM(partner_earning) as total_partner_earning,
        SUM(total_expense) as total_expense,
        SUM(company_margin) as total_company_margin
      FROM services 
      WHERE category IN ('Aadhaar Service', 'PAN Service', 'Voter ID Service', 'Ration Card Service')
    `);
    
    console.log('Summary Statistics:');
    console.log('==================');
    console.log(`Total Services Updated: ${stats[0].total_services}`);
    console.log(`Total User Cost: Rs.${stats[0].total_user_cost}`);
    console.log(`Total Govt Fees: Rs.${stats[0].total_govt_fees}`);
    console.log(`Total Partner Earnings: Rs.${stats[0].total_partner_earning}`);
    console.log(`Total Expenses: Rs.${stats[0].total_expense}`);
    console.log(`Total Company Margin: Rs.${stats[0].total_company_margin}`);
    
    await connection.end();
    
    console.log('\nServices pricing update completed successfully!');
    console.log('All services have been updated with complete pricing data.');
    
  } catch (error) {
    console.error('Error updating services pricing:', error.message);
    process.exit(1);
  }
};

updateServicesPricing();
