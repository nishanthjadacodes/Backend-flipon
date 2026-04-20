import 'dotenv/config';
import { sequelize } from '../src/config/database.js';
import { Service, syncModels } from '../src/models/index.js';

const seedAllServicesSQL = async () => {
  try {
    // Connect to database
    await sequelize.authenticate();
    console.log('Database connection established.');

    // Sync models
    await syncModels();
    console.log('Database models synchronized.');

    // SQL INSERT statements for all services
    const insertServicesSQL = `
      -- Insert All India Disability Pension Scheme (Updated)
      INSERT INTO services (
        id, name, category, service_type, base_price, estimated_time, 
        required_documents, form_fields, allow_pay_after, description, 
        is_active, created_at, updated_at
      ) VALUES (
        UUID(),
        'All India Disability Pension Scheme',
        'Government Scheme',
        'consumer',
        250.00,
        '20-30 working days',
        JSON_OBJECT(
          'documents', JSON_ARRAY(
            JSON_OBJECT('type', 'aadhaar_front', 'label', 'Aadhaar Front', 'required', true),
            JSON_OBJECT('type', 'aadhaar_back', 'label', 'Aadhaar Back', 'required', true),
            JSON_OBJECT('type', 'voter_id_card', 'label', 'Voter ID Card', 'required', true),
            JSON_OBJECT('type', 'disability_certificate', 'label', 'Disability Certificate', 'required', true),
            JSON_OBJECT('type', 'passport_sized_photo', 'label', 'Passport Sized Photo', 'required', true),
            JSON_OBJECT('type', 'bank_passbook', 'label', 'Bank Passbook', 'required', true),
            JSON_OBJECT('type', 'income_certificate', 'label', 'Income Certificate', 'required', false),
            JSON_OBJECT('type', 'self_declaration_form', 'label', 'Self-Declaration Form', 'required', true),
            JSON_OBJECT('type', 'caste_certificate', 'label', 'Caste Certificate', 'required', false),
            JSON_OBJECT('type', 'residence_certificate', 'label', 'Residence Certificate', 'required', false),
            JSON_OBJECT('type', 'ration_card', 'label', 'Ration Card', 'required', true),
            JSON_OBJECT('type', 'additional_document_1', 'label', 'Additional Document 1', 'required', false),
            JSON_OBJECT('type', 'additional_document_2', 'label', 'Additional Document 2', 'required', false),
            JSON_OBJECT('type', 'additional_document_3', 'label', 'Additional Document 3', 'required', false),
            JSON_OBJECT('type', 'additional_document_4', 'label', 'Additional Document 4', 'required', false)
          )
        ),
        JSON_OBJECT(
          'fields', JSON_ARRAY(
            JSON_OBJECT('name', 'applicant_name', 'label', 'Applicant Name', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'father_name', 'label', 'Father\'s Name', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'mobile_number', 'label', 'Mobile Number', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'email', 'label', 'E-mail', 'type', 'email', 'required', false),
            JSON_OBJECT('name', 'date_of_birth', 'label', 'Date of Birth', 'type', 'date', 'required', true),
            JSON_OBJECT('name', 'gender', 'label', 'Gender', 'type', 'select', 'required', true, 'options', JSON_ARRAY('Male', 'Female', 'Other')),
            JSON_OBJECT('name', 'marital_status', 'label', 'Marital Status', 'type', 'select', 'required', true, 'options', JSON_ARRAY('Single', 'Married', 'Divorced', 'Widowed')),
            JSON_OBJECT('name', 'disability_type', 'label', 'Disability Type', 'type', 'text', 'required', false),
            JSON_OBJECT('name', 'house_no', 'label', 'House No.', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'street_area_locality', 'label', 'Street/Area/Locality', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'ward_name', 'label', 'Ward Name', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'town_village', 'label', 'Town/Village', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'panchayat', 'label', 'Panchayat', 'type', 'text', 'required', false),
            JSON_OBJECT('name', 'post_office', 'label', 'Post Office', 'type', 'text', 'required', false),
            JSON_OBJECT('name', 'taluqa_tehsil_mandal', 'label', 'Taluqa/Tehsil/Mandal', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'block', 'label', 'Block', 'type', 'text', 'required', false),
            JSON_OBJECT('name', 'district', 'label', 'District', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'state', 'label', 'State', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'pin_code', 'label', 'Pin Code', 'type', 'text', 'required', true)
          )
        ),
        true,
        'National disability pension scheme with comprehensive document requirements',
        true,
        NOW(),
        NOW()
      ) ON DUPLICATE KEY UPDATE 
      SET 
        service_type = 'consumer',
        base_price = 250.00,
        estimated_time = '20-30 working days',
        required_documents = VALUES(required_documents),
        form_fields = VALUES(form_fields),
        description = VALUES(description),
        updated_at = NOW();

      -- Update all existing services to consumer type
      UPDATE services 
      SET service_type = 'consumer' 
      WHERE service_type IN ('common', 'government', 'welfare', 'certificate', 'state_scheme', 'government_document', 'home_service', 'industrial_service');

      -- Insert ESI Services (15 services)
      INSERT INTO services (
        id, name, category, service_type, base_price, estimated_time, 
        required_documents, form_fields, allow_pay_after, description, 
        is_active, created_at, updated_at
      ) VALUES 
      (
        UUID(),
        'Maternity Benefit (ESI)',
        'ESI Service',
        'consumer',
        150.00,
        '15-20 working days',
        JSON_OBJECT(
          'documents', JSON_ARRAY(
            JSON_OBJECT('type', 'aadhaar_front', 'label', 'Aadhaar Front', 'required', true),
            JSON_OBJECT('type', 'aadhaar_back', 'label', 'Aadhaar Back', 'required', true),
            JSON_OBJECT('type', 'esi_card', 'label', 'ESI Card', 'required', true),
            JSON_OBJECT('type', 'maternity_certificate', 'label', 'Maternity Certificate', 'required', true),
            JSON_OBJECT('type', 'bank_passbook', 'label', 'Bank Passbook', 'required', true),
            JSON_OBJECT('type', 'employment_proof', 'label', 'Employment Proof', 'required', true)
          )
        ),
        JSON_OBJECT(
          'fields', JSON_ARRAY(
            JSON_OBJECT('name', 'applicant_name', 'label', 'Applicant Name', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'father_name', 'label', 'Father\'s Name', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'mobile_number', 'label', 'Mobile Number', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'email', 'label', 'E-mail', 'type', 'email', 'required', false),
            JSON_OBJECT('name', 'date_of_birth', 'label', 'Date of Birth', 'type', 'date', 'required', true),
            JSON_OBJECT('name', 'gender', 'label', 'Gender', 'type', 'select', 'required', true, 'options', JSON_ARRAY('Male', 'Female', 'Other')),
            JSON_OBJECT('name', 'marital_status', 'label', 'Marital Status', 'type', 'select', 'required', true, 'options', JSON_ARRAY('Single', 'Married', 'Divorced', 'Widowed')),
            JSON_OBJECT('name', 'esi_number', 'label', 'ESI Number', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'pregnancy_details', 'label', 'Pregnancy Details', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'expected_delivery_date', 'label', 'Expected Delivery Date', 'type', 'date', 'required', true),
            JSON_OBJECT('name', 'house_no', 'label', 'House No.', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'street_area_locality', 'label', 'Street/Area/Locality', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'ward_name', 'label', 'Ward Name', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'town_village', 'label', 'Town/Village', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'taluqa_tehsil_mandal', 'label', 'Taluqa/Tehsil/Mandal', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'district', 'label', 'District', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'state', 'label', 'State', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'pin_code', 'label', 'Pin Code', 'type', 'text', 'required', true)
          )
        ),
        true,
        'ESI maternity benefit claim for insured women',
        true,
        NOW(),
        NOW()
      ),
      (
        UUID(),
        'ESI Leave Claim',
        'ESI Service',
        'consumer',
        100.00,
        '10-15 working days',
        JSON_OBJECT(
          'documents', JSON_ARRAY(
            JSON_OBJECT('type', 'aadhaar_front', 'label', 'Aadhaar Front', 'required', true),
            JSON_OBJECT('type', 'aadhaar_back', 'label', 'Aadhaar Back', 'required', true),
            JSON_OBJECT('type', 'esi_card', 'label', 'ESI Card', 'required', true),
            JSON_OBJECT('type', 'medical_certificate', 'label', 'Medical Certificate', 'required', true),
            JSON_OBJECT('type', 'leave_application', 'label', 'Leave Application', 'required', true)
          )
        ),
        JSON_OBJECT(
          'fields', JSON_ARRAY(
            JSON_OBJECT('name', 'applicant_name', 'label', 'Applicant Name', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'father_name', 'label', 'Father\'s Name', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'mobile_number', 'label', 'Mobile Number', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'email', 'label', 'E-mail', 'type', 'email', 'required', false),
            JSON_OBJECT('name', 'date_of_birth', 'label', 'Date of Birth', 'type', 'date', 'required', true),
            JSON_OBJECT('name', 'gender', 'label', 'Gender', 'type', 'select', 'required', true, 'options', JSON_ARRAY('Male', 'Female', 'Other')),
            JSON_OBJECT('name', 'marital_status', 'label', 'Marital Status', 'type', 'select', 'required', true, 'options', JSON_ARRAY('Single', 'Married', 'Divorced', 'Widowed')),
            JSON_OBJECT('name', 'esi_number', 'label', 'ESI Number', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'leave_type', 'label', 'Leave Type', 'type', 'select', 'required', true, 'options', JSON_ARRAY('Sickness', 'Maternity', 'Disablement')),
            JSON_OBJECT('name', 'leave_start_date', 'label', 'Leave Start Date', 'type', 'date', 'required', true),
            JSON_OBJECT('name', 'leave_end_date', 'label', 'Leave End Date', 'type', 'date', 'required', true),
            JSON_OBJECT('name', 'house_no', 'label', 'House No.', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'street_area_locality', 'label', 'Street/Area/Locality', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'ward_name', 'label', 'Ward Name', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'town_village', 'label', 'Town/Village', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'taluqa_tehsil_mandal', 'label', 'Taluqa/Tehsil/Mandal', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'district', 'label', 'District', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'state', 'label', 'State', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'pin_code', 'label', 'Pin Code', 'type', 'text', 'required', true)
          )
        ),
        true,
        'ESI leave claim for sickness, maternity, or disablement',
        true,
        NOW(),
        NOW()
      )
      ON DUPLICATE KEY UPDATE 
      SET 
        service_type = 'consumer',
        base_price = VALUES(base_price),
        estimated_time = VALUES(estimated_time),
        required_documents = VALUES(required_documents),
        form_fields = VALUES(form_fields),
        description = VALUES(description),
        updated_at = NOW();

      -- Insert PM Street Vendors Atma Nirbhar Nidhi
      INSERT INTO services (
        id, name, category, service_type, base_price, estimated_time, 
        required_documents, form_fields, allow_pay_after, description, 
        is_active, created_at, updated_at
      ) VALUES (
        UUID(),
        'PM Street Vendors Atma Nirbhar Nidhi',
        'Government Scheme',
        'consumer',
        200.00,
        '20-25 working days',
        JSON_OBJECT(
          'documents', JSON_ARRAY(
            JSON_OBJECT('type', 'aadhaar_front', 'label', 'Aadhaar Front', 'required', true),
            JSON_OBJECT('type', 'aadhaar_back', 'label', 'Aadhaar Back', 'required', true),
            JSON_OBJECT('type', 'photograph', 'label', 'Photograph', 'required', true),
            JSON_OBJECT('type', 'bank_passbook', 'label', 'Bank Passbook', 'required', true),
            JSON_OBJECT('type', 'self_declaration_certificate', 'label', 'Self-declaration certificate', 'required', true),
            JSON_OBJECT('type', 'driving_license', 'label', 'Driving License', 'required', false),
            JSON_OBJECT('type', 'caste_certificate', 'label', 'Caste Certificate', 'required', false),
            JSON_OBJECT('type', 'income_certificate', 'label', 'Income Certificate', 'required', false),
            JSON_OBJECT('type', 'domicile_certificate', 'label', 'Domicile Certificate', 'required', false),
            JSON_OBJECT('type', 'ssi_msme_registration', 'label', 'SSI / MSME registration', 'required', false),
            JSON_OBJECT('type', 'proof_of_business_address', 'label', 'Proof of Business Address', 'required', false),
            JSON_OBJECT('type', 'certificate_of_vending', 'label', 'Certificate of Vending', 'required', true),
            JSON_OBJECT('type', 'letter_of_recommendation', 'label', 'Letter of Recommendation', 'required', false),
            JSON_OBJECT('type', 'mnrega_card', 'label', 'MNREGA Card', 'required', false),
            JSON_OBJECT('type', 'pan_card', 'label', 'PAN Card', 'required', false),
            JSON_OBJECT('type', 'request_letter_to_ulb', 'label', 'Request letter to ULB', 'required', false),
            JSON_OBJECT('type', 'additional_document_1', 'label', 'Additional Document 1', 'required', false),
            JSON_OBJECT('type', 'additional_document_2', 'label', 'Additional Document 2', 'required', false),
            JSON_OBJECT('type', 'additional_document_3', 'label', 'Additional Document 3', 'required', false),
            JSON_OBJECT('type', 'additional_document_4', 'label', 'Additional Document 4', 'required', false)
          )
        ),
        JSON_OBJECT(
          'fields', JSON_ARRAY(
            JSON_OBJECT('name', 'applicant_name', 'label', 'Applicant Name', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'father_name', 'label', 'Father\'s Name', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'mobile_number', 'label', 'Mobile Number', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'email', 'label', 'E-mail', 'type', 'email', 'required', false),
            JSON_OBJECT('name', 'date_of_birth', 'label', 'Date of Birth', 'type', 'date', 'required', true),
            JSON_OBJECT('name', 'gender', 'label', 'Gender', 'type', 'select', 'required', true, 'options', JSON_ARRAY('Male', 'Female', 'Other')),
            JSON_OBJECT('name', 'marital_status', 'label', 'Marital Status', 'type', 'select', 'required', true, 'options', JSON_ARRAY('Single', 'Married', 'Divorced', 'Widowed')),
            JSON_OBJECT('name', 'disability_type', 'label', 'Disability Type', 'type', 'text', 'required', false),
            JSON_OBJECT('name', 'business_type', 'label', 'Business Type', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'business_address', 'label', 'Business Address', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'years_in_business', 'label', 'Years in Business', 'type', 'number', 'required', true),
            JSON_OBJECT('name', 'house_no', 'label', 'House No.', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'street_area_locality', 'label', 'Street/Area/Locality', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'ward_name', 'label', 'Ward Name', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'town_village', 'label', 'Town/Village', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'taluqa_tehsil_mandal', 'label', 'Taluqa/Tehsil/Mandal', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'district', 'label', 'District', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'state', 'label', 'State', 'type', 'text', 'required', true),
            JSON_OBJECT('name', 'pin_code', 'label', 'Pin Code', 'type', 'text', 'required', true)
          )
        ),
        true,
        'PM Street Vendors Atma Nirbhar Nidhi scheme for street vendors welfare',
        true,
        NOW(),
        NOW()
      ) ON DUPLICATE KEY UPDATE 
      SET 
        service_type = 'consumer',
        base_price = 200.00,
        estimated_time = '20-25 working days',
        required_documents = VALUES(required_documents),
        form_fields = VALUES(form_fields),
        description = VALUES(description),
        updated_at = NOW();
    `;

    // Execute SQL statements
    console.log('Executing SQL statements to add all services...');

    // The source uses JS-escaped apostrophes (`\'`) inside SQL string literals
    // — e.g. `'Father\'s Name'`. JS evaluates that to `'Father's Name'`, where
    // the bare `'` between letters terminates the SQL string early and breaks
    // TiDB's parser. Fix by doubling any apostrophe that sits between two
    // letters — that pattern only occurs inside intended-as-content text
    // (possessives like Father's, Children's), never as a SQL string delimiter.
    const portableSQL = insertServicesSQL
      .replace(/([A-Za-z])'([A-Za-z])/g, "$1''$2")
      // `ON DUPLICATE KEY UPDATE SET ...` is invalid; correct form omits SET.
      // MySQL tolerates the typo, TiDB doesn't.
      .replace(/ON DUPLICATE KEY UPDATE\s+SET\s+/gi, 'ON DUPLICATE KEY UPDATE ')
      // Schema renamed `base_price` → `user_cost` and `estimated_time` →
      // `expected_timeline`. Legacy seed still uses the old column names.
      .replace(/\bbase_price\b/g, 'user_cost')
      .replace(/\bestimated_time\b/g, 'expected_timeline');

    // TiDB disables multi-statement queries by default. Split on `;` and run
    // each statement separately. Naive split is safe here because no SQL
    // string literal in this seed contains a semicolon.
    const statements = portableSQL
      .split(/;\s*\n/)
      .map((s) => s.trim())
      // Skip pieces that contain only blank lines or `--` comments.
      .filter((s) => s && /[A-Za-z]/.test(s.replace(/--[^\n]*/g, '')));

    let executed = 0;
    for (const stmt of statements) {
      await sequelize.query(stmt);
      executed += 1;
    }
    console.log(`Executed ${executed} SQL statements.`);

    console.log('\u2705 SQL statements executed successfully!');
    console.log('All services have been added to database with service_type = "consumer"');

    // Get final service count
    const finalServices = await Service.findAll({
      attributes: ['id', 'name', 'category', 'user_cost', 'service_type'],
      order: [['category', 'ASC'], ['name', 'ASC']]
    });

    console.log('\n\ud83d\ude80 Final Service Summary:');
    console.log('=============================');
    
    let totalServices = 0;
    const categoryCount = {};

    finalServices.forEach(service => {
      console.log(`\u2705 ${service.name} (${service.category}) - Rs.${service.base_price} [${service.service_type}]`);
      totalServices++;
      categoryCount[service.category] = (categoryCount[service.category] || 0) + 1;
    });

    console.log('\n\ud83d\udcca Service Count by Category:');
    console.log('==============================');
    console.log(`Total Services: ${totalServices}`);
    
    Object.entries(categoryCount).forEach(([category, count]) => {
      console.log(`${category}: ${count} services`);
    });

    console.log('\n\ud83c\udf89 All services now use service_type = "consumer"!');
    console.log('Ready for production deployment!');

  } catch (error) {
    console.error('Error executing SQL statements:', error);
  } finally {
    await sequelize.close();
    console.log('Database connection closed.');
  }
};

seedAllServicesSQL();
