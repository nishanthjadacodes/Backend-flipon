import 'dotenv/config';
import mysql from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';

const updateAllRemainingServices = async () => {
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

    // VOTER ID SERVICES (10 services)
    const voterIdServices = [
      {
        name: 'New Voter ID Apply',
        category: 'Voter ID Service',
        service_type: 'common',
        user_cost: 150,
        govt_fees: 0,
        partner_earning: 100,
        total_expense: 100,
        expected_timeline: '10-15 days',
        company_margin: 50,
        remarks: 'New voter ID application',
        required_documents: JSON.stringify([
          { type: 'passport_sized_photo', label: 'Passport Size Photo', required: true },
          { type: 'identity_proof', label: 'Identity Proof', required: true },
          { type: 'address_proof', label: 'Address Proof', required: true },
          { type: 'dob_proof', label: 'Date of Birth Proof', required: true }
        ]),
        description: 'New voter ID card application',
        allow_pay_after: true
      },
      {
        name: 'Voter ID Name Update',
        category: 'Voter ID Service',
        service_type: 'common',
        user_cost: 150,
        govt_fees: 0,
        partner_earning: 100,
        total_expense: 100,
        expected_timeline: '10-15 days',
        company_margin: 50,
        remarks: 'Update name in voter ID',
        required_documents: JSON.stringify([
          { type: 'voter_id_card', label: 'Voter ID Card', required: true },
          { type: 'passport_sized_photo', label: 'Passport Size Photo', required: true },
          { type: 'name_change_document', label: 'Name Change Document', required: true },
          { type: 'identity_proof', label: 'Identity Proof', required: true }
        ]),
        description: 'Update name in existing voter ID card',
        allow_pay_after: true
      },
      {
        name: 'Voter ID Address Update',
        category: 'Voter ID Service',
        service_type: 'common',
        user_cost: 150,
        govt_fees: 0,
        partner_earning: 100,
        total_expense: 100,
        expected_timeline: '10-15 days',
        company_margin: 50,
        remarks: 'Update address in voter ID',
        required_documents: JSON.stringify([
          { type: 'voter_id_card', label: 'Voter ID Card', required: true },
          { type: 'passport_sized_photo', label: 'Passport Size Photo', required: true },
          { type: 'address_proof', label: 'Address Proof', required: true },
          { type: 'identity_proof', label: 'Identity Proof', required: true }
        ]),
        description: 'Update address in existing voter ID card',
        allow_pay_after: true
      },
      {
        name: 'Voter ID DOB Update',
        category: 'Voter ID Service',
        service_type: 'common',
        user_cost: 150,
        govt_fees: 0,
        partner_earning: 100,
        total_expense: 100,
        expected_timeline: '10-15 days',
        company_margin: 50,
        remarks: 'Update DOB in voter ID',
        required_documents: JSON.stringify([
          { type: 'voter_id_card', label: 'Voter ID Card', required: true },
          { type: 'passport_sized_photo', label: 'Passport Size Photo', required: true },
          { type: 'dob_proof', label: 'Date of Birth Proof', required: true },
          { type: 'identity_proof', label: 'Identity Proof', required: true }
        ]),
        description: 'Update date of birth in existing voter ID card',
        allow_pay_after: true
      },
      {
        name: 'Voter ID Gender Update',
        category: 'Voter ID Service',
        service_type: 'common',
        user_cost: 150,
        govt_fees: 0,
        partner_earning: 100,
        total_expense: 100,
        expected_timeline: '10-15 days',
        company_margin: 50,
        remarks: 'Update gender in voter ID',
        required_documents: JSON.stringify([
          { type: 'voter_id_card', label: 'Voter ID Card', required: true },
          { type: 'passport_sized_photo', label: 'Passport Size Photo', required: true },
          { type: 'gender_proof', label: 'Gender Proof', required: true },
          { type: 'identity_proof', label: 'Identity Proof', required: true }
        ]),
        description: 'Update gender in existing voter ID card',
        allow_pay_after: true
      },
      {
        name: 'Voter ID Mobile Number Update',
        category: 'Voter ID Service',
        service_type: 'common',
        user_cost: 150,
        govt_fees: 0,
        partner_earning: 100,
        total_expense: 100,
        expected_timeline: '10-15 days',
        company_margin: 50,
        remarks: 'Update mobile in voter ID',
        required_documents: JSON.stringify([
          { type: 'voter_id_card', label: 'Voter ID Card', required: true },
          { type: 'mobile_number_proof', label: 'Mobile Number Proof', required: true },
          { type: 'identity_proof', label: 'Identity Proof', required: true }
        ]),
        description: 'Update mobile number in existing voter ID card',
        allow_pay_after: true
      },
      {
        name: 'Voter ID Email Update',
        category: 'Voter ID Service',
        service_type: 'common',
        user_cost: 150,
        govt_fees: 0,
        partner_earning: 100,
        total_expense: 100,
        expected_timeline: '10-15 days',
        company_margin: 50,
        remarks: 'Update email in voter ID',
        required_documents: JSON.stringify([
          { type: 'voter_id_card', label: 'Voter ID Card', required: true },
          { type: 'email_proof', label: 'Email Proof', required: true },
          { type: 'identity_proof', label: 'Identity Proof', required: true }
        ]),
        description: 'Update email ID in existing voter ID card',
        allow_pay_after: true
      },
      {
        name: 'Order Voter ID PVC Card',
        category: 'Voter ID Service',
        service_type: 'common',
        user_cost: 150,
        govt_fees: 0,
        partner_earning: 100,
        total_expense: 100,
        expected_timeline: '10-15 days',
        company_margin: 50,
        remarks: 'Order voter ID PVC card',
        required_documents: JSON.stringify([
          { type: 'voter_id_card', label: 'Voter ID Card', required: true },
          { type: 'passport_sized_photo', label: 'Passport Size Photo', required: true },
          { type: 'identity_proof', label: 'Identity Proof', required: true }
        ]),
        description: 'Order PVC card for existing voter ID',
        allow_pay_after: true
      },
      {
        name: 'Download Voter ID',
        category: 'Voter ID Service',
        service_type: 'common',
        user_cost: 150,
        govt_fees: 0,
        partner_earning: 100,
        total_expense: 100,
        expected_timeline: '10-15 days',
        company_margin: 50,
        remarks: 'Download e-Voter ID',
        required_documents: JSON.stringify([
          { type: 'voter_id_number', label: 'Voter ID Number', required: true },
          { type: 'mobile_number', label: 'Registered Mobile Number', required: true }
        ]),
        description: 'Download e-Voter ID card online',
        allow_pay_after: true
      },
      {
        name: 'Verify Voter ID Email/Mobile',
        category: 'Voter ID Service',
        service_type: 'common',
        user_cost: 150,
        govt_fees: 0,
        partner_earning: 100,
        total_expense: 100,
        expected_timeline: '10-15 days',
        company_margin: 50,
        remarks: 'Verify voter ID email/mobile',
        required_documents: JSON.stringify([
          { type: 'voter_id_number', label: 'Voter ID Number', required: true },
          { type: 'mobile_number', label: 'Mobile Number', required: true },
          { type: 'email_id', label: 'Email ID', required: false }
        ]),
        description: 'Verify email and mobile number linked to voter ID',
        allow_pay_after: true
      }
    ];

    // RATION CARD SERVICES (10 services)
    const rationCardServices = [
      {
        name: 'New Ration Card Apply',
        category: 'Ration Card Service',
        service_type: 'common',
        user_cost: 150,
        govt_fees: 0,
        partner_earning: 100,
        total_expense: 100,
        expected_timeline: '20-30 days',
        company_margin: 50,
        remarks: 'New ration card application',
        required_documents: JSON.stringify([
          { type: 'passport_sized_photo', label: 'Passport Size Photo', required: true },
          { type: 'identity_proof', label: 'Identity Proof', required: true },
          { type: 'address_proof', label: 'Address Proof', required: true },
          { type: 'income_proof', label: 'Income Proof', required: true },
          { type: 'family_details', label: 'Family Details', required: true }
        ]),
        description: 'New ration card application',
        allow_pay_after: true
      },
      {
        name: 'Ration Card Name Update',
        category: 'Ration Card Service',
        service_type: 'common',
        user_cost: 150,
        govt_fees: 0,
        partner_earning: 100,
        total_expense: 100,
        expected_timeline: '20-30 days',
        company_margin: 50,
        remarks: 'Update name in ration card',
        required_documents: JSON.stringify([
          { type: 'ration_card', label: 'Ration Card', required: true },
          { type: 'passport_sized_photo', label: 'Passport Size Photo', required: true },
          { type: 'name_change_document', label: 'Name Change Document', required: true },
          { type: 'identity_proof', label: 'Identity Proof', required: true }
        ]),
        description: 'Update name in existing ration card',
        allow_pay_after: true
      },
      {
        name: 'Ration Card Address Update',
        category: 'Ration Card Service',
        service_type: 'common',
        user_cost: 150,
        govt_fees: 0,
        partner_earning: 100,
        total_expense: 100,
        expected_timeline: '20-30 days',
        company_margin: 50,
        remarks: 'Update address in ration card',
        required_documents: JSON.stringify([
          { type: 'ration_card', label: 'Ration Card', required: true },
          { type: 'passport_sized_photo', label: 'Passport Size Photo', required: true },
          { type: 'address_proof', label: 'Address Proof', required: true },
          { type: 'identity_proof', label: 'Identity Proof', required: true }
        ]),
        description: 'Update address in existing ration card',
        allow_pay_after: true
      },
      {
        name: 'Ration Card DOB Update',
        category: 'Ration Card Service',
        service_type: 'common',
        user_cost: 150,
        govt_fees: 0,
        partner_earning: 100,
        total_expense: 100,
        expected_timeline: '20-30 days',
        company_margin: 50,
        remarks: 'Update DOB in ration card',
        required_documents: JSON.stringify([
          { type: 'ration_card', label: 'Ration Card', required: true },
          { type: 'passport_sized_photo', label: 'Passport Size Photo', required: true },
          { type: 'dob_proof', label: 'Date of Birth Proof', required: true },
          { type: 'identity_proof', label: 'Identity Proof', required: true }
        ]),
        description: 'Update date of birth in existing ration card',
        allow_pay_after: true
      },
      {
        name: 'Ration Card Gender Update',
        category: 'Ration Card Service',
        service_type: 'common',
        user_cost: 150,
        govt_fees: 0,
        partner_earning: 100,
        total_expense: 100,
        expected_timeline: '20-30 days',
        company_margin: 50,
        remarks: 'Update gender in ration card',
        required_documents: JSON.stringify([
          { type: 'ration_card', label: 'Ration Card', required: true },
          { type: 'passport_sized_photo', label: 'Passport Size Photo', required: true },
          { type: 'gender_proof', label: 'Gender Proof', required: true },
          { type: 'identity_proof', label: 'Identity Proof', required: true }
        ]),
        description: 'Update gender in existing ration card',
        allow_pay_after: true
      },
      {
        name: 'Ration Card Mobile Update',
        category: 'Ration Card Service',
        service_type: 'common',
        user_cost: 150,
        govt_fees: 0,
        partner_earning: 100,
        total_expense: 100,
        expected_timeline: '20-30 days',
        company_margin: 50,
        remarks: 'Update mobile in ration card',
        required_documents: JSON.stringify([
          { type: 'ration_card', label: 'Ration Card', required: true },
          { type: 'mobile_number_proof', label: 'Mobile Number Proof', required: true },
          { type: 'identity_proof', label: 'Identity Proof', required: true }
        ]),
        description: 'Update mobile number in existing ration card',
        allow_pay_after: true
      },
      {
        name: 'Ration Card Email Update',
        category: 'Ration Card Service',
        service_type: 'common',
        user_cost: 150,
        govt_fees: 0,
        partner_earning: 100,
        total_expense: 100,
        expected_timeline: '20-30 days',
        company_margin: 50,
        remarks: 'Update email in ration card',
        required_documents: JSON.stringify([
          { type: 'ration_card', label: 'Ration Card', required: true },
          { type: 'email_proof', label: 'Email Proof', required: true },
          { type: 'identity_proof', label: 'Identity Proof', required: true }
        ]),
        description: 'Update email ID in existing ration card',
        allow_pay_after: true
      },
      {
        name: 'Ration Card Member Add/Remove',
        category: 'Ration Card Service',
        service_type: 'common',
        user_cost: 150,
        govt_fees: 0,
        partner_earning: 100,
        total_expense: 100,
        expected_timeline: '20-30 days',
        company_margin: 50,
        remarks: 'Add/remove family members',
        required_documents: JSON.stringify([
          { type: 'ration_card', label: 'Ration Card', required: true },
          { type: 'passport_sized_photo', label: 'Passport Size Photo', required: true },
          { type: 'family_member_details', label: 'Family Member Details', required: true },
          { type: 'identity_proof', label: 'Identity Proof', required: true }
        ]),
        description: 'Add or remove family members from ration card',
        allow_pay_after: true
      },
      {
        name: 'Download Ration Card',
        category: 'Ration Card Service',
        service_type: 'common',
        user_cost: 150,
        govt_fees: 0,
        partner_earning: 100,
        total_expense: 100,
        expected_timeline: 'Instant',
        company_margin: 50,
        remarks: 'Download e-Ration Card',
        required_documents: JSON.stringify([
          { type: 'ration_card_number', label: 'Ration Card Number', required: true },
          { type: 'mobile_number', label: 'Registered Mobile Number', required: true }
        ]),
        description: 'Download e-Ration card online',
        allow_pay_after: true
      },
      {
        name: 'Verify Ration Card Email/Mobile',
        category: 'Ration Card Service',
        service_type: 'common',
        user_cost: 150,
        govt_fees: 0,
        partner_earning: 100,
        total_expense: 100,
        expected_timeline: 'Instant',
        company_margin: 50,
        remarks: 'Verify ration card email/mobile',
        required_documents: JSON.stringify([
          { type: 'ration_card_number', label: 'Ration Card Number', required: true },
          { type: 'mobile_number', label: 'Mobile Number', required: true },
          { type: 'email_id', label: 'Email ID', required: false }
        ]),
        description: 'Verify email and mobile number linked to ration card',
        allow_pay_after: true
      }
    ];

    // OTHER SERVICES (9 services)
    const otherServices = [
      {
        name: 'Udyam Registration',
        category: 'Other Service',
        service_type: 'common',
        user_cost: 300,
        govt_fees: 0,
        partner_earning: 100,
        total_expense: 100,
        expected_timeline: '5-12 hours',
        company_margin: 200,
        remarks: 'MSME Udyam registration',
        required_documents: JSON.stringify([
          { type: 'aadhaar_card', label: 'Aadhaar Card', required: true },
          { type: 'pan_card', label: 'PAN Card', required: true },
          { type: 'bank_account', label: 'Bank Account Details', required: true },
          { type: 'business_address', label: 'Business Address', required: true }
        ]),
        description: 'MSME Udyam registration for small businesses',
        allow_pay_after: true
      },
      {
        name: 'Food License (FSSAI)',
        category: 'Other Service',
        service_type: 'common',
        user_cost: 200,
        govt_fees: 0,
        partner_earning: 100,
        total_expense: 100,
        expected_timeline: '5-12 hours',
        company_margin: 100,
        remarks: 'FSSAI food license',
        required_documents: JSON.stringify([
          { type: 'identity_proof', label: 'Identity Proof', required: true },
          { type: 'address_proof', label: 'Address Proof', required: true },
          { type: 'business_address', label: 'Business Address', required: true },
          { type: 'food_business_details', label: 'Food Business Details', required: true }
        ]),
        description: 'FSSAI food license for food businesses',
        allow_pay_after: true
      },
      {
        name: 'Trade License',
        category: 'Other Service',
        service_type: 'common',
        user_cost: 1000,
        govt_fees: 0,
        partner_earning: 100,
        total_expense: 100,
        expected_timeline: '5-12 hours',
        company_margin: 900,
        remarks: 'Trade license for business',
        required_documents: JSON.stringify([
          { type: 'identity_proof', label: 'Identity Proof', required: true },
          { type: 'address_proof', label: 'Address Proof', required: true },
          { type: 'business_address', label: 'Business Address', required: true },
          { type: 'business_details', label: 'Business Details', required: true }
        ]),
        description: 'Trade license for business operations',
        allow_pay_after: true
      },
      {
        name: 'Caste Certificate',
        category: 'Other Service',
        service_type: 'common',
        user_cost: 300,
        govt_fees: 0,
        partner_earning: 100,
        total_expense: 100,
        expected_timeline: '5-12 hours',
        company_margin: 200,
        remarks: 'Caste certificate application',
        required_documents: JSON.stringify([
          { type: 'passport_sized_photo', label: 'Passport Size Photo', required: true },
          { type: 'identity_proof', label: 'Identity Proof', required: true },
          { type: 'address_proof', label: 'Address Proof', required: true },
          { type: 'caste_proof', label: 'Caste Proof', required: true }
        ]),
        description: 'Caste certificate application',
        allow_pay_after: true
      },
      {
        name: 'Domicile Certificate',
        category: 'Other Service',
        service_type: 'common',
        user_cost: 400,
        govt_fees: 0,
        partner_earning: 100,
        total_expense: 100,
        expected_timeline: '5-12 hours',
        company_margin: 300,
        remarks: 'Domicile certificate application',
        required_documents: JSON.stringify([
          { type: 'passport_sized_photo', label: 'Passport Size Photo', required: true },
          { type: 'identity_proof', label: 'Identity Proof', required: true },
          { type: 'address_proof', label: 'Address Proof', required: true },
          { type: 'residence_proof', label: 'Residence Proof', required: true }
        ]),
        description: 'Domicile certificate application',
        allow_pay_after: true
      },
      {
        name: 'Income Certificate',
        category: 'Other Service',
        service_type: 'common',
        user_cost: 250,
        govt_fees: 0,
        partner_earning: 100,
        total_expense: 100,
        expected_timeline: '5-12 hours',
        company_margin: 150,
        remarks: 'Income certificate application',
        required_documents: JSON.stringify([
          { type: 'passport_sized_photo', label: 'Passport Size Photo', required: true },
          { type: 'identity_proof', label: 'Identity Proof', required: true },
          { type: 'address_proof', label: 'Address Proof', required: true },
          { type: 'income_proof', label: 'Income Proof', required: true }
        ]),
        description: 'Income certificate application',
        allow_pay_after: true
      },
      {
        name: 'Birth Certificate',
        category: 'Other Service',
        service_type: 'common',
        user_cost: 400,
        govt_fees: 0,
        partner_earning: 100,
        total_expense: 100,
        expected_timeline: '5-12 hours',
        company_margin: 300,
        remarks: 'Birth certificate application',
        required_documents: JSON.stringify([
          { type: 'birth_proof', label: 'Birth Proof', required: true },
          { type: 'parent_identity_proof', label: 'Parent Identity Proof', required: true },
          { type: 'address_proof', label: 'Address Proof', required: true }
        ]),
        description: 'Birth certificate application',
        allow_pay_after: true
      },
      {
        name: 'Death Certificate',
        category: 'Other Service',
        service_type: 'common',
        user_cost: 400,
        govt_fees: 0,
        partner_earning: 100,
        total_expense: 100,
        expected_timeline: '5-12 hours',
        company_margin: 300,
        remarks: 'Death certificate application',
        required_documents: JSON.stringify([
          { type: 'death_proof', label: 'Death Proof', required: true },
          { type: 'applicant_identity_proof', label: 'Applicant Identity Proof', required: true },
          { type: 'address_proof', label: 'Address Proof', required: true }
        ]),
        description: 'Death certificate application',
        allow_pay_after: true
      },
      {
        name: 'Life Certificate',
        category: 'Other Service',
        service_type: 'common',
        user_cost: 50,
        govt_fees: 0,
        partner_earning: 100,
        total_expense: 100,
        expected_timeline: '5-12 hours',
        company_margin: -50,
        remarks: 'Life certificate for pensioners',
        required_documents: JSON.stringify([
          { type: 'pension_document', label: 'Pension Document', required: true },
          { type: 'identity_proof', label: 'Identity Proof', required: true },
          { type: 'address_proof', label: 'Address Proof', required: true }
        ]),
        description: 'Life certificate for pensioners',
        allow_pay_after: true
      }
    ];

    // Combine all services
    const allServices = [...voterIdServices, ...rationCardServices, ...otherServices];

    console.log(`Updating/Adding all ${allServices.length} remaining services with complete pricing data...`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const service of allServices) {
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
    
    console.log(`\nAll Remaining Services Update Complete!`);
    console.log(`\u2705 Successfully processed: ${successCount} services`);
    console.log(`\u274c Failed to process: ${errorCount} services`);
    
    // Verify the updates
    console.log('\nVerifying updated services...');
    const [verification] = await connection.execute(`
      SELECT name, category, user_cost, govt_fees, partner_earning, total_expense, 
             expected_timeline, company_margin, remarks 
      FROM services 
      WHERE category IN ('Voter ID Service', 'Ration Card Service', 'Other Service') 
      ORDER BY category, name
    `);
    
    console.log('\nUpdated Services Verification:');
    console.log('==============================');
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
    
    console.log('Category-wise Summary Statistics:');
    console.log('=================================');
    stats.forEach(stat => {
      console.log(`\n${stat.category}:`);
      console.log(`  Total Services: ${stat.total_services}`);
      console.log(`  Total User Cost: Rs.${stat.total_user_cost}`);
      console.log(`  Total Govt Fees: Rs.${stat.total_govt_fees}`);
      console.log(`  Total Partner Earnings: Rs.${stat.total_partner_earning}`);
      console.log(`  Total Expenses: Rs.${stat.total_expense}`);
      console.log(`  Total Company Margin: Rs.${stat.total_company_margin}`);
    });
    
    await connection.end();
    
    console.log('\nAll remaining services have been updated with complete pricing data!');
    console.log('All pricing details including company margin are now properly configured.');
    
  } catch (error) {
    console.error('Error updating remaining services:', error.message);
    process.exit(1);
  }
};

updateAllRemainingServices();
