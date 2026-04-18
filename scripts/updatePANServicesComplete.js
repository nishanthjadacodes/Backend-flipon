import 'dotenv/config';
import mysql from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';

const updatePANServicesComplete = async () => {
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

    // Complete PAN services with all pricing details
    const panServices = [
      {
        name: 'New PAN Card Application',
        category: 'PAN Service',
        service_type: 'common',
        user_cost: 220,
        govt_fees: 107,
        partner_earning: 75,
        total_expense: 182,
        expected_timeline: '24-48 hrs',
        company_margin: 38,
        remarks: 'New PAN card application',
        required_documents: JSON.stringify([
          { type: 'passport_sized_photo', label: 'Passport Size Photo', required: true },
          { type: 'identity_proof', label: 'Identity Proof', required: true },
          { type: 'address_proof', label: 'Address Proof', required: true },
          { type: 'dob_proof', label: 'Date of Birth Proof', required: true },
          { type: 'signature', label: 'Signature', required: true }
        ]),
        description: 'New PAN card application for individuals',
        allow_pay_after: true
      },
      {
        name: 'PAN Card Name Update',
        category: 'PAN Service',
        service_type: 'common',
        user_cost: 220,
        govt_fees: 107,
        partner_earning: 75,
        total_expense: 182,
        expected_timeline: '48-72 hrs',
        company_margin: 38,
        remarks: 'Update name in PAN card',
        required_documents: JSON.stringify([
          { type: 'pan_card', label: 'PAN Card', required: true },
          { type: 'passport_sized_photo', label: 'Passport Size Photo', required: true },
          { type: 'name_change_document', label: 'Name Change Document', required: true },
          { type: 'identity_proof', label: 'Identity Proof', required: true }
        ]),
        description: 'Update name in existing PAN card',
        allow_pay_after: true
      },
      {
        name: 'PAN Card Address Update',
        category: 'PAN Service',
        service_type: 'common',
        user_cost: 220,
        govt_fees: 107,
        partner_earning: 75,
        total_expense: 182,
        expected_timeline: '48-72 hrs',
        company_margin: 38,
        remarks: 'Update address in PAN card',
        required_documents: JSON.stringify([
          { type: 'pan_card', label: 'PAN Card', required: true },
          { type: 'passport_sized_photo', label: 'Passport Size Photo', required: true },
          { type: 'address_proof', label: 'Address Proof', required: true },
          { type: 'identity_proof', label: 'Identity Proof', required: true }
        ]),
        description: 'Update address in existing PAN card',
        allow_pay_after: true
      },
      {
        name: 'PAN Card DOB Update',
        category: 'PAN Service',
        service_type: 'common',
        user_cost: 220,
        govt_fees: 107,
        partner_earning: 75,
        total_expense: 182,
        expected_timeline: '48-72 hrs',
        company_margin: 38,
        remarks: 'Update DOB in PAN card',
        required_documents: JSON.stringify([
          { type: 'pan_card', label: 'PAN Card', required: true },
          { type: 'passport_sized_photo', label: 'Passport Size Photo', required: true },
          { type: 'dob_proof', label: 'Date of Birth Proof', required: true },
          { type: 'identity_proof', label: 'Identity Proof', required: true }
        ]),
        description: 'Update date of birth in existing PAN card',
        allow_pay_after: true
      },
      {
        name: 'PAN Card Gender Update',
        category: 'PAN Service',
        service_type: 'common',
        user_cost: 220,
        govt_fees: 107,
        partner_earning: 75,
        total_expense: 182,
        expected_timeline: '48-72 hrs',
        company_margin: 38,
        remarks: 'Update gender in PAN card',
        required_documents: JSON.stringify([
          { type: 'pan_card', label: 'PAN Card', required: true },
          { type: 'passport_sized_photo', label: 'Passport Size Photo', required: true },
          { type: 'gender_proof', label: 'Gender Proof', required: true },
          { type: 'identity_proof', label: 'Identity Proof', required: true }
        ]),
        description: 'Update gender in existing PAN card',
        allow_pay_after: true
      },
      {
        name: 'PAN Card Mobile Number Update',
        category: 'PAN Service',
        service_type: 'common',
        user_cost: 220,
        govt_fees: 107,
        partner_earning: 75,
        total_expense: 182,
        expected_timeline: '48-72 hrs',
        company_margin: 38,
        remarks: 'Update mobile number in PAN',
        required_documents: JSON.stringify([
          { type: 'pan_card', label: 'PAN Card', required: true },
          { type: 'mobile_number_proof', label: 'Mobile Number Proof', required: true },
          { type: 'identity_proof', label: 'Identity Proof', required: true }
        ]),
        description: 'Update mobile number in existing PAN card',
        allow_pay_after: true
      },
      {
        name: 'PAN Card Email ID Update',
        category: 'PAN Service',
        service_type: 'common',
        user_cost: 220,
        govt_fees: 107,
        partner_earning: 75,
        total_expense: 182,
        expected_timeline: '48-72 hrs',
        company_margin: 38,
        remarks: 'Update email in PAN',
        required_documents: JSON.stringify([
          { type: 'pan_card', label: 'PAN Card', required: true },
          { type: 'email_proof', label: 'Email Proof', required: true },
          { type: 'identity_proof', label: 'Identity Proof', required: true }
        ]),
        description: 'Update email ID in existing PAN card',
        allow_pay_after: true
      },
      {
        name: 'Order PAN PVC Card',
        category: 'PAN Service',
        service_type: 'common',
        user_cost: 220,
        govt_fees: 107,
        partner_earning: 75,
        total_expense: 182,
        expected_timeline: '48-72 hrs',
        company_margin: 38,
        remarks: 'Order PAN PVC card',
        required_documents: JSON.stringify([
          { type: 'pan_card', label: 'PAN Card', required: true },
          { type: 'passport_sized_photo', label: 'Passport Size Photo', required: true },
          { type: 'identity_proof', label: 'Identity Proof', required: true }
        ]),
        description: 'Order PVC card for existing PAN',
        allow_pay_after: true
      },
      {
        name: 'Download PAN Card',
        category: 'PAN Service',
        service_type: 'common',
        user_cost: 220,
        govt_fees: 107,
        partner_earning: 75,
        total_expense: 182,
        expected_timeline: '48-72 hrs',
        company_margin: 38,
        remarks: 'Download e-PAN card',
        required_documents: JSON.stringify([
          { type: 'pan_number', label: 'PAN Number', required: true },
          { type: 'aadhaar_number', label: 'Aadhaar Number', required: true },
          { type: 'mobile_number', label: 'Registered Mobile Number', required: true }
        ]),
        description: 'Download e-PAN card online',
        allow_pay_after: true
      },
      {
        name: 'Verify PAN Email/Mobile',
        category: 'PAN Service',
        service_type: 'common',
        user_cost: 220,
        govt_fees: 107,
        partner_earning: 75,
        total_expense: 182,
        expected_timeline: '48-72 hrs',
        company_margin: 38,
        remarks: 'Verify PAN email/mobile',
        required_documents: JSON.stringify([
          { type: 'pan_number', label: 'PAN Number', required: true },
          { type: 'mobile_number', label: 'Mobile Number', required: true },
          { type: 'email_id', label: 'Email ID', required: false }
        ]),
        description: 'Verify email and mobile number linked to PAN',
        allow_pay_after: true
      },
      {
        name: 'Link PAN to Aadhaar',
        category: 'PAN Service',
        service_type: 'common',
        user_cost: 1100,
        govt_fees: 1000,
        partner_earning: 75,
        total_expense: 1075,
        expected_timeline: '48-72 hrs',
        company_margin: 25,
        remarks: 'Link PAN card with Aadhaar',
        required_documents: JSON.stringify([
          { type: 'pan_card', label: 'PAN Card', required: true },
          { type: 'aadhaar_card', label: 'Aadhaar Card', required: true },
          { type: 'mobile_number', label: 'Mobile Number', required: true }
        ]),
        description: 'Link PAN card with Aadhaar',
        allow_pay_after: true
      }
    ];

    console.log('Updating/Adding all 11 PAN services with complete pricing data...');
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const service of panServices) {
      try {
        // Check if service already exists
        const [existingService] = await connection.execute(
          'SELECT id FROM services WHERE name = ?',
          [service.name]
        );

        if (!existingService || existingService.length === 0) {
          // Insert new service
          await connection.execute(
            `INSERT INTO services (
              id, name, category, service_type, user_cost, expected_timeline, 
              required_documents, allow_pay_after, description, 
              is_active, created_at, updated_at, govt_fees, partner_earning, 
              total_expense, company_margin, remarks
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              uuidv4(),
              service.name,
              service.category,
              service.service_type,
              service.user_cost,
              service.expected_timeline,
              service.required_documents,
              service.allow_pay_after ? 1 : 0,
              service.description,
              1,
              new Date(),
              new Date(),
              service.govt_fees,
              service.partner_earning,
              service.total_expense,
              service.company_margin,
              service.remarks
            ]
          );
          console.log(`\u2705 Created: ${service.name}`);
        } else {
          // Update existing service with complete pricing data
          await connection.execute(
            `UPDATE services SET 
              user_cost = ?, govt_fees = ?, partner_earning = ?, total_expense = ?, 
              expected_timeline = ?, company_margin = ?, remarks = ?, 
              updated_at = ? WHERE name = ?`,
            [
              service.user_cost,
              service.govt_fees,
              service.partner_earning,
              service.total_expense,
              service.expected_timeline,
              service.company_margin,
              service.remarks,
              new Date(),
              service.name
            ]
          );
          console.log(`\u2705 Updated: ${service.name}`);
        }
        successCount++;
      } catch (error) {
        console.error(`\u274c Error with ${service.name}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`\nPAN Services Update Complete!`);
    console.log(`\u2705 Successfully processed: ${successCount} services`);
    console.log(`\u274c Failed to process: ${errorCount} services`);
    
    // Verify the updates
    console.log('\nVerifying updated PAN services...');
    const [verification] = await connection.execute(`
      SELECT name, category, user_cost, govt_fees, partner_earning, total_expense, 
             expected_timeline, company_margin, remarks 
      FROM services 
      WHERE category = 'PAN Service' 
      ORDER BY name
    `);
    
    console.log('\nUpdated PAN Services Verification:');
    console.log('==================================');
    verification.forEach((service, index) => {
      console.log(`${index + 1}. ${service.name}`);
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
      WHERE category = 'PAN Service'
    `);
    
    console.log('PAN Services Summary Statistics:');
    console.log('================================');
    console.log(`Total Services: ${stats[0].total_services}`);
    console.log(`Total User Cost: Rs.${stats[0].total_user_cost}`);
    console.log(`Total Govt Fees: Rs.${stats[0].total_govt_fees}`);
    console.log(`Total Partner Earnings: Rs.${stats[0].total_partner_earning}`);
    console.log(`Total Expenses: Rs.${stats[0].total_expense}`);
    console.log(`Total Company Margin: Rs.${stats[0].total_company_margin}`);
    
    await connection.end();
    
    console.log('\nAll PAN services have been updated with complete pricing data!');
    console.log('All pricing details including company margin are now properly configured.');
    
  } catch (error) {
    console.error('Error updating PAN services:', error.message);
    process.exit(1);
  }
};

updatePANServicesComplete();
