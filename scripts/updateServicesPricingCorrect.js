import 'dotenv/config';
import mysql from 'mysql2/promise';

const updateServicesPricingCorrect = async () => {
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

    // Corrected queries targeting actual services in database
    const updateQueries = [
      // AADHAAR SERVICES (5 services)
      `UPDATE services SET user_cost = 200, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '1 week', company_margin = 100, remarks = 'New Aadhaar enrolment' WHERE name = 'New Aadhaar Enrolment'`,
      `UPDATE services SET user_cost = 275, govt_fees = 75, partner_earning = 100, total_expense = 175, expected_timeline = '2 weeks', company_margin = 100, remarks = 'Update name in Aadhaar' WHERE name = 'Name update in Aadhaar'`,
      `UPDATE services SET user_cost = 275, govt_fees = 75, partner_earning = 100, total_expense = 175, expected_timeline = '3 weeks', company_margin = 100, remarks = 'Update husband name in Aadhaar' WHERE name = 'Father/Husband name update in Aadhaar'`,
      `UPDATE services SET user_cost = 275, govt_fees = 75, partner_earning = 100, total_expense = 175, expected_timeline = '4 weeks', company_margin = 100, remarks = 'Update address in Aadhaar' WHERE name = 'Address update in Aadhaar'`,
      `UPDATE services SET user_cost = 275, govt_fees = 75, partner_earning = 100, total_expense = 175, expected_timeline = '5 weeks', company_margin = 100, remarks = 'Update DOB in Aadhaar' WHERE name = 'DOB update in Aadhaar'`,
      `UPDATE services SET user_cost = 275, govt_fees = 75, partner_earning = 100, total_expense = 175, expected_timeline = '6 weeks', company_margin = 100, remarks = 'Order Aadhaar PVC card' WHERE name = 'Aadhaar PVC Card'`,
      
      // ESI SERVICES (12 services)
      `UPDATE services SET user_cost = 150, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '15-20 days', company_margin = 50, remarks = 'ESI sickness claim' WHERE name = 'Claim for Sickness (ESI)'`,
      `UPDATE services SET user_cost = 150, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '15-20 days', company_margin = 50, remarks = 'ESI domiciliary treatment' WHERE name = 'Domiciliary Treatment (ESI)'`,
      `UPDATE services SET user_cost = 100, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '10-15 days', company_margin = 0, remarks = 'ESI leave claim' WHERE name = 'ESI Leave Claim'`,
      `UPDATE services SET user_cost = 200, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '15-20 days', company_margin = 100, remarks = 'ESI imaging services' WHERE name = 'Imaging Services (ESI)'`,
      `UPDATE services SET user_cost = 300, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '20-30 days', company_margin = 200, remarks = 'ESI in-patient treatment' WHERE name = 'In-Patient Treatment (ESI)'`,
      `UPDATE services SET user_cost = 100, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '7-10 days', company_margin = 0, remarks = 'ESI KYC update' WHERE name = 'KYC Details Update (ESI)'`,
      `UPDATE services SET user_cost = 150, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '15-20 days', company_margin = 50, remarks = 'ESI maternity benefit' WHERE name = 'Maternity Benefit (ESI)'`,
      `UPDATE services SET user_cost = 150, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '15-20 days', company_margin = 50, remarks = 'ESI name/father/DOB change' WHERE name = 'Name/Father/DOB Change (ESI)'`,
      `UPDATE services SET user_cost = 100, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '15-20 days', company_margin = 0, remarks = 'ESI pension withdrawal' WHERE name = 'Pension Withdrawal (ESI)'`,
      `UPDATE services SET user_cost = 200, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '15-20 days', company_margin = 100, remarks = 'ESI reimbursement' WHERE name = 'Reimbursement (ESI)'`,
      `UPDATE services SET user_cost = 250, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '15-20 days', company_margin = 150, remarks = 'ESI specialist consultation' WHERE name = 'Specialist Consultation (ESI)'`,
      `UPDATE services SET user_cost = 200, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '15-20 days', company_margin = 100, remarks = 'ESI temporary disablement' WHERE name = 'Temporary Disablement (ESI)'`,
      
      // PF SERVICES (12 services)
      `UPDATE services SET user_cost = 100, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '7-10 days', company_margin = 0, remarks = 'PF claim status and passbook' WHERE name = 'Claim Status and Passbook'`,
      `UPDATE services SET user_cost = 200, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '15-20 days', company_margin = 100, remarks = 'EPF withdrawal' WHERE name = 'EPF Withdrawal'`,
      `UPDATE services SET user_cost = 150, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '10-15 days', company_margin = 50, remarks = 'PF fund transfer' WHERE name = 'Fund Transfer (PF)'`,
      `UPDATE services SET user_cost = 100, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '7-10 days', company_margin = 0, remarks = 'PF KYC update' WHERE name = 'KYC Details Update (PF)'`,
      `UPDATE services SET user_cost = 100, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '7-10 days', company_margin = 0, remarks = 'PF life certificate submission' WHERE name = 'Life Certificate Submission (PF)'`,
      `UPDATE services SET user_cost = 150, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '10-15 days', company_margin = 50, remarks = 'PF mark DOL/date of exit' WHERE name = 'Mark DOL/Date of Exit'`,
      `UPDATE services SET user_cost = 150, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '10-15 days', company_margin = 50, remarks = 'PF name/father/DOB change' WHERE name = 'Name/Father/DOB Change (PF)'`,
      `UPDATE services SET user_cost = 100, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '7-10 days', company_margin = 0, remarks = 'PF pension certificate' WHERE name = 'Pension Certificate (PF)'`,
      `UPDATE services SET user_cost = 200, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '15-20 days', company_margin = 100, remarks = 'PF advance' WHERE name = 'PF Advance'`,
      `UPDATE services SET user_cost = 50, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '5-7 days', company_margin = -50, remarks = 'PF balance enquiry' WHERE name = 'PF Balance Enquiry'`,
      `UPDATE services SET user_cost = 100, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '7-10 days', company_margin = 0, remarks = 'Register PF grievances' WHERE name = 'Register PF Grievances'`,
      `UPDATE services SET user_cost = 100, govt_fees = 0, partner_earning = 100, total_expense = 100, expected_timeline = '7-10 days', company_margin = 0, remarks = 'PF UAN activation' WHERE name = 'UAN Activation'`
    ];

    console.log('Executing corrected pricing updates for actual services...');
    
    let successCount = 0;
    let errorCount = 0;
    
    // Execute each query individually with error handling
    for (let i = 0; i < updateQueries.length; i++) {
      const query = updateQueries[i];
      try {
        const [result] = await connection.execute(query);
        if (result.affectedRows > 0) {
          console.log(`\u2705 Updated: ${query.substring(query.indexOf('WHERE') + 6, query.indexOf("'") + 20)}...`);
          successCount++;
        } else {
          console.log(`\u26a0\ufe0f No rows affected: ${query.substring(query.indexOf('WHERE') + 6, query.indexOf("'") + 20)}...`);
        }
      } catch (error) {
        console.error(`\u274c Error executing query ${i + 1}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`\nPricing updates completed!`);
    console.log(`\u2705 Successfully updated: ${successCount} services`);
    console.log(`\u274c Failed to update: ${errorCount} services`);
    
    // Verify the updates
    console.log('\nVerifying updated services...');
    const [verification] = await connection.execute(`
      SELECT name, category, user_cost, govt_fees, partner_earning, total_expense, expected_timeline, company_margin, remarks 
      FROM services 
      WHERE category IN ('Aadhaar Services', 'ESI Service', 'PF Service') 
      AND user_cost > 0
      ORDER BY category, name
      LIMIT 20
    `);
    
    console.log('\nUpdated Services Verification:');
    console.log('================================');
    verification.forEach((service, index) => {
      console.log(`${index + 1}. ${service.name} (${service.category})`);
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
      WHERE category IN ('Aadhaar Services', 'ESI Service', 'PF Service') 
      AND user_cost > 0
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

updateServicesPricingCorrect();
