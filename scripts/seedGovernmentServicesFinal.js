import 'dotenv/config';
import mysql from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';

const seedGovernmentServicesFinal = async () => {
  try {
    console.log('🔌 Connecting to MySQL database...');
    
    // Database connection using .env variables
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'Bannu@456',
      database: process.env.DB_NAME || 'flipon_db',
      multipleStatements: false
    });

    console.log('✅ Database connected successfully!');

    // Services to insert (simplified to match exact database schema)
    const services = [
      {
        name: 'All India Disability Pension Scheme',
        category: 'Government Document',
        service_type: 'common',
        user_cost: 0,
        expected_timeline: '15-30 days',
        required_documents: JSON.stringify([
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'voter_id_card', label: 'Voter ID Card', required: true },
          { type: 'disability_certificate', label: 'Disability Certificate', required: true },
          { type: 'passport_sized_photo', label: 'Passport Size Photo', required: true },
          { type: 'bank_passbook', label: 'Bank Passbook', required: true },
          { type: 'income_certificate', label: 'Income Certificate', required: false },
          { type: 'self_declaration_form', label: 'Self Declaration Form', required: true },
          { type: 'caste_certificate', label: 'Caste Certificate', required: false },
          { type: 'residence_certificate', label: 'Residence Certificate', required: false },
          { type: 'ration_card', label: 'Ration Card', required: true }
        ]),
        description: 'Disability pension scheme for eligible persons with disabilities',
        allow_pay_after: true
      },
      {
        name: 'PM Street Vendors Atma Nirbhar Nidhi (PM SVANidhi)',
        category: 'Government Document',
        service_type: 'common',
        user_cost: 0,
        expected_timeline: '15-20 days',
        required_documents: JSON.stringify([
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'photograph', label: 'Photograph', required: true },
          { type: 'bank_passbook', label: 'Bank Passbook', required: true },
          { type: 'self_declaration_certificate', label: 'Self Declaration Certificate', required: true },
          { type: 'driving_license', label: 'Driving License', required: false },
          { type: 'caste_certificate', label: 'Caste Certificate', required: false },
          { type: 'income_certificate', label: 'Income Certificate', required: false },
          { type: 'domicile_certificate', label: 'Domicile Certificate', required: false },
          { type: 'ssi_msme_registration', label: 'SSI/MSME Registration', required: false },
          { type: 'proof_of_business_address', label: 'Proof of Business Address', required: false },
          { type: 'certificate_of_vending', label: 'Certificate of Vending', required: true },
          { type: 'letter_of_recommendation', label: 'Letter of Recommendation', required: false },
          { type: 'mnrega_card', label: 'MNREGA Card', required: false },
          { type: 'pan_card', label: 'PAN Card', required: false },
          { type: 'request_letter_to_ulb', label: 'Request letter to ULB', required: false }
        ]),
        description: 'Micro-credit scheme for street vendors',
        allow_pay_after: true
      },
      {
        name: 'Pradhan Mantri Kisan Samman Nidhi (PM-KISAN)',
        category: 'Government Document',
        service_type: 'common',
        user_cost: 0,
        expected_timeline: '30-45 days',
        required_documents: JSON.stringify([
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'bank_passbook', label: 'Bank Passbook', required: true },
          { type: 'land_papers', label: 'Land Papers', required: true }
        ]),
        description: 'Income support scheme for small and marginal farmers',
        allow_pay_after: true
      },
      {
        name: 'Pradhan Mantri Ujjwala Yojana',
        category: 'Government Document',
        service_type: 'common',
        user_cost: 0,
        expected_timeline: '15-20 days',
        required_documents: JSON.stringify([
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'bank_passbook', label: 'Bank Passbook', required: true },
          { type: 'ration_card', label: 'Ration Card', required: true },
          { type: 'voter_id_card', label: 'Voter ID Card', required: true },
          { type: 'income_certificate', label: 'Income Certificate', required: false },
          { type: 'residence_certificate', label: 'Residence Certificate', required: false }
        ]),
        description: 'Free LPG connection for BPL households',
        allow_pay_after: true
      },
      {
        name: 'New Ration Card',
        category: 'Government Document',
        service_type: 'common',
        user_cost: 149,
        expected_timeline: '7-10 days',
        required_documents: JSON.stringify([
          { type: 'hof_aadhaar_front', label: 'HOF Aadhaar Front', required: true },
          { type: 'hof_aadhaar_back', label: 'HOF Aadhaar Back', required: true },
          { type: 'family_member_aadhaar', label: 'Family Member Aadhaar', required: true }
        ]),
        description: 'Apply for new ration card for household',
        allow_pay_after: true
      },
      {
        name: 'Add/Remove Member in Ration Card',
        category: 'Government Document',
        service_type: 'common',
        user_cost: 99,
        expected_timeline: '7-10 days',
        required_documents: JSON.stringify([
          { type: 'hof_aadhaar_front', label: 'HOF Aadhaar Front', required: true },
          { type: 'hof_aadhaar_back', label: 'HOF Aadhaar Back', required: true },
          { type: 'family_member_aadhaar', label: 'Family Member Aadhaar', required: true }
        ]),
        description: 'Add or remove family members from existing ration card',
        allow_pay_after: true
      },
      {
        name: 'Correction in Ration Card',
        category: 'Government Document',
        service_type: 'common',
        user_cost: 99,
        expected_timeline: '7-10 days',
        required_documents: JSON.stringify([
          { type: 'hof_aadhaar_front', label: 'HOF Aadhaar Front', required: true },
          { type: 'hof_aadhaar_back', label: 'HOF Aadhaar Back', required: true },
          { type: 'family_member_aadhaar', label: 'Family Member Aadhaar', required: true }
        ]),
        description: 'Make corrections in existing ration card details',
        allow_pay_after: true
      }
    ];

    console.log(`\ud83d\udccb Inserting ${services.length} services into database...`);

    let successCount = 0;
    let errorCount = 0;

    // Insert each service
    for (let i = 0; i < services.length; i++) {
      const service = services[i];
      try {
        // Check if service already exists
        const [existingService] = await connection.execute(
          'SELECT id FROM services WHERE name = ?',
          [service.name]
        );

        if (!existingService || existingService.length === 0) {
          // Insert new service - using exact column order from database
          await connection.execute(
            `INSERT INTO services (
              id, name, category, service_type, user_cost, govt_fees, 
              partner_earning, total_expense, expected_timeline, company_margin, 
              remarks, estimated_time, required_documents, allow_pay_after, 
              description, is_active, created_at, updated_at, form_fields
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              uuidv4(),
              service.name,
              service.category,
              service.service_type,
              service.user_cost,
              0, // govt_fees
              0, // partner_earning
              0, // total_expense
              service.expected_timeline,
              0, // company_margin
              '', // remarks
              service.expected_timeline, // estimated_time
              service.required_documents,
              service.allow_pay_after ? 1 : 0,
              service.description,
              1, // is_active
              new Date(),
              new Date(),
              null // form_fields
            ]
          );
          console.log(`\u2705 ✅ Created: ${service.name}`);
          successCount++;
        } else {
          console.log(`\u26a0\ufe0f ⚠️  Already exists: ${service.name}`);
        }
      } catch (error) {
        console.error(`\u274c ❌ Error inserting ${service.name}:`, error.message);
        errorCount++;
      }
    }

    // Close connection
    await connection.end();

    console.log('\n🎉 Government Services Seeding Complete!');
    console.log('====================================');
    console.log(`✅ Successfully inserted: ${successCount} services`);
    console.log(`❌ Failed to insert: ${errorCount} services`);
    console.log(`📊 Total processed: ${services.length} services`);

    console.log('\n📋 Services Added:');
    console.log('==================');
    services.forEach((service, index) => {
      console.log(`${index + 1}. ${service.name} (${service.category}) - Rs.${service.user_cost}`);
    });

    console.log('\n🚀 All services now use service_type = "common"!');
    console.log('Ready for production deployment!');

  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    process.exit(1);
  }
};

seedGovernmentServicesFinal();
