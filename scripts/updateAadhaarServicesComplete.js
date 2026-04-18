import 'dotenv/config';
import mysql from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';

const updateAadhaarServicesComplete = async () => {
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

    // Complete Aadhaar services with all pricing details
    const aadhaarServices = [
      {
        name: 'New Aadhaar Enrolment',
        category: 'Aadhaar Services',
        service_type: 'common',
        user_cost: 200,
        govt_fees: 0,
        partner_earning: 100,
        total_expense: 100,
        expected_timeline: '1 week',
        company_margin: 100,
        remarks: 'New Aadhaar enrolment',
        required_documents: JSON.stringify([
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'passport_sized_photo', label: 'Passport Size Photo', required: true },
          { type: 'birth_certificate', label: 'Birth Certificate', required: true },
          { type: 'identity_proof', label: 'Identity Proof', required: true },
          { type: 'address_proof', label: 'Address Proof', required: true }
        ]),
        description: 'New Aadhaar card enrolment for residents',
        allow_pay_after: true
      },
      {
        name: 'Aadhaar Name Update',
        category: 'Aadhaar Services',
        service_type: 'common',
        user_cost: 275,
        govt_fees: 75,
        partner_earning: 100,
        total_expense: 175,
        expected_timeline: '2 weeks',
        company_margin: 100,
        remarks: 'Update name in Aadhaar',
        required_documents: JSON.stringify([
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'passport_sized_photo', label: 'Passport Size Photo', required: true },
          { type: 'name_change_document', label: 'Name Change Document', required: true },
          { type: 'identity_proof', label: 'Identity Proof', required: true }
        ]),
        description: 'Update name in existing Aadhaar card',
        allow_pay_after: true
      },
      {
        name: 'Aadhaar Husband Name Update',
        category: 'Aadhaar Services',
        service_type: 'common',
        user_cost: 275,
        govt_fees: 75,
        partner_earning: 100,
        total_expense: 175,
        expected_timeline: '3 weeks',
        company_margin: 100,
        remarks: 'Update husband name in Aadhaar',
        required_documents: JSON.stringify([
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'passport_sized_photo', label: 'Passport Size Photo', required: true },
          { type: 'marriage_certificate', label: 'Marriage Certificate', required: true },
          { type: 'identity_proof', label: 'Identity Proof', required: true }
        ]),
        description: 'Update husband name in existing Aadhaar card',
        allow_pay_after: true
      },
      {
        name: 'Aadhaar Address Update',
        category: 'Aadhaar Services',
        service_type: 'common',
        user_cost: 275,
        govt_fees: 75,
        partner_earning: 100,
        total_expense: 175,
        expected_timeline: '4 weeks',
        company_margin: 100,
        remarks: 'Update address in Aadhaar',
        required_documents: JSON.stringify([
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'passport_sized_photo', label: 'Passport Size Photo', required: true },
          { type: 'address_proof', label: 'Address Proof', required: true },
          { type: 'identity_proof', label: 'Identity Proof', required: true }
        ]),
        description: 'Update address in existing Aadhaar card',
        allow_pay_after: true
      },
      {
        name: 'Aadhaar Date of Birth Update',
        category: 'Aadhaar Services',
        service_type: 'common',
        user_cost: 275,
        govt_fees: 75,
        partner_earning: 100,
        total_expense: 175,
        expected_timeline: '5 weeks',
        company_margin: 100,
        remarks: 'Update DOB in Aadhaar',
        required_documents: JSON.stringify([
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'passport_sized_photo', label: 'Passport Size Photo', required: true },
          { type: 'dob_proof', label: 'Date of Birth Proof', required: true },
          { type: 'identity_proof', label: 'Identity Proof', required: true }
        ]),
        description: 'Update date of birth in existing Aadhaar card',
        allow_pay_after: true
      },
      {
        name: 'Aadhaar Gender Update',
        category: 'Aadhaar Services',
        service_type: 'common',
        user_cost: 275,
        govt_fees: 75,
        partner_earning: 100,
        total_expense: 175,
        expected_timeline: '6 weeks',
        company_margin: 100,
        remarks: 'Update gender in Aadhaar',
        required_documents: JSON.stringify([
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'passport_sized_photo', label: 'Passport Size Photo', required: true },
          { type: 'gender_proof', label: 'Gender Proof', required: true },
          { type: 'identity_proof', label: 'Identity Proof', required: true }
        ]),
        description: 'Update gender in existing Aadhaar card',
        allow_pay_after: true
      },
      {
        name: 'Aadhaar Biometric Update',
        category: 'Aadhaar Services',
        service_type: 'common',
        user_cost: 275,
        govt_fees: 75,
        partner_earning: 100,
        total_expense: 175,
        expected_timeline: '7 weeks',
        company_margin: 100,
        remarks: 'Update biometric in Aadhaar',
        required_documents: JSON.stringify([
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'passport_sized_photo', label: 'Passport Size Photo', required: true },
          { type: 'identity_proof', label: 'Identity Proof', required: true }
        ]),
        description: 'Update biometric data in existing Aadhaar card',
        allow_pay_after: true
      },
      {
        name: 'Aadhaar Mobile Number Update',
        category: 'Aadhaar Services',
        service_type: 'common',
        user_cost: 275,
        govt_fees: 75,
        partner_earning: 100,
        total_expense: 175,
        expected_timeline: '8 weeks',
        company_margin: 100,
        remarks: 'Update mobile number in Aadhaar',
        required_documents: JSON.stringify([
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'mobile_number_proof', label: 'Mobile Number Proof', required: true },
          { type: 'identity_proof', label: 'Identity Proof', required: true }
        ]),
        description: 'Update mobile number in existing Aadhaar card',
        allow_pay_after: true
      },
      {
        name: 'Aadhaar Email ID Update',
        category: 'Aadhaar Services',
        service_type: 'common',
        user_cost: 275,
        govt_fees: 75,
        partner_earning: 100,
        total_expense: 175,
        expected_timeline: '9 weeks',
        company_margin: 100,
        remarks: 'Update email ID in Aadhaar',
        required_documents: JSON.stringify([
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'email_proof', label: 'Email Proof', required: true },
          { type: 'identity_proof', label: 'Identity Proof', required: true }
        ]),
        description: 'Update email ID in existing Aadhaar card',
        allow_pay_after: true
      },
      {
        name: 'Order Aadhaar PVC Card',
        category: 'Aadhaar Services',
        service_type: 'common',
        user_cost: 275,
        govt_fees: 75,
        partner_earning: 100,
        total_expense: 175,
        expected_timeline: '10 weeks',
        company_margin: 100,
        remarks: 'Order Aadhaar PVC card',
        required_documents: JSON.stringify([
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'passport_sized_photo', label: 'Passport Size Photo', required: true },
          { type: 'identity_proof', label: 'Identity Proof', required: true }
        ]),
        description: 'Order PVC card for existing Aadhaar',
        allow_pay_after: true
      },
      {
        name: 'Download Aadhaar',
        category: 'Aadhaar Services',
        service_type: 'common',
        user_cost: 275,
        govt_fees: 75,
        partner_earning: 100,
        total_expense: 175,
        expected_timeline: 'Instant',
        company_margin: 100,
        remarks: 'Download e-Aadhaar',
        required_documents: JSON.stringify([
          { type: 'aadhaar_number', label: 'Aadhaar Number', required: true },
          { type: 'mobile_number', label: 'Registered Mobile Number', required: true }
        ]),
        description: 'Download e-Aadhaar card online',
        allow_pay_after: true
      },
      {
        name: 'Verify Aadhaar Email/Mobile',
        category: 'Aadhaar Services',
        service_type: 'common',
        user_cost: 275,
        govt_fees: 75,
        partner_earning: 100,
        total_expense: 175,
        expected_timeline: 'Instant',
        company_margin: 100,
        remarks: 'Verify email/mobile linked to Aadhaar',
        required_documents: JSON.stringify([
          { type: 'aadhaar_number', label: 'Aadhaar Number', required: true },
          { type: 'mobile_number', label: 'Mobile Number', required: true },
          { type: 'email_id', label: 'Email ID', required: false }
        ]),
        description: 'Verify email and mobile number linked to Aadhaar',
        allow_pay_after: true
      }
    ];

    console.log('Updating/Adding all 12 Aadhaar services with complete pricing data...');
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const service of aadhaarServices) {
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
    
    console.log(`\nAadhaar Services Update Complete!`);
    console.log(`\u2705 Successfully processed: ${successCount} services`);
    console.log(`\u274c Failed to process: ${errorCount} services`);
    
    // Verify the updates
    console.log('\nVerifying updated Aadhaar services...');
    const [verification] = await connection.execute(`
      SELECT name, category, user_cost, govt_fees, partner_earning, total_expense, 
             expected_timeline, company_margin, remarks 
      FROM services 
      WHERE category = 'Aadhaar Services' 
      ORDER BY name
    `);
    
    console.log('\nUpdated Aadhaar Services Verification:');
    console.log('=====================================');
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
      WHERE category = 'Aadhaar Services'
    `);
    
    console.log('Aadhaar Services Summary Statistics:');
    console.log('===================================');
    console.log(`Total Services: ${stats[0].total_services}`);
    console.log(`Total User Cost: Rs.${stats[0].total_user_cost}`);
    console.log(`Total Govt Fees: Rs.${stats[0].total_govt_fees}`);
    console.log(`Total Partner Earnings: Rs.${stats[0].total_partner_earning}`);
    console.log(`Total Expenses: Rs.${stats[0].total_expense}`);
    console.log(`Total Company Margin: Rs.${stats[0].total_company_margin}`);
    
    await connection.end();
    
    console.log('\nAll Aadhaar services have been updated with complete pricing data!');
    console.log('All pricing details including company margin are now properly configured.');
    
  } catch (error) {
    console.error('Error updating Aadhaar services:', error.message);
    process.exit(1);
  }
};

updateAadhaarServicesComplete();
