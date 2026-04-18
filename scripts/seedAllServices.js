import 'dotenv/config';
import { sequelize } from '../src/config/database.js';
import { Service, syncModels } from '../src/models/index.js';

const seedAllServices = async () => {
  try {
    // Connect to database
    await sequelize.authenticate();
    console.log('Database connection established.');

    // Sync models
    await syncModels();
    console.log('Database models synchronized.');

    // Common form fields for all services
    const commonFormFields = [
      { name: 'applicant_name', label: 'Applicant Name', type: 'text', required: true },
      { name: 'father_name', label: 'Father\'s Name', type: 'text', required: true },
      { name: 'mobile_number', label: 'Mobile Number', type: 'text', required: true },
      { name: 'email', label: 'E-mail', type: 'email', required: false },
      { name: 'date_of_birth', label: 'Date of Birth', type: 'date', required: true },
      { name: 'gender', label: 'Gender', type: 'select', required: true, options: ['Male', 'Female', 'Other'] },
      { name: 'marital_status', label: 'Marital Status', type: 'select', required: true, options: ['Single', 'Married', 'Divorced', 'Widowed'] },
      { name: 'disability_type', label: 'Disability Type', type: 'text', required: false },
      
      // Address fields
      { name: 'house_no', label: 'House No.', type: 'text', required: true },
      { name: 'street_area_locality', label: 'Street/Area/Locality', type: 'text', required: true },
      { name: 'ward_name', label: 'Ward Name', type: 'text', required: true },
      { name: 'town_village', label: 'Town/Village', type: 'text', required: true },
      { name: 'panchayat', label: 'Panchayat', type: 'text', required: false },
      { name: 'post_office', label: 'Post Office', type: 'text', required: false },
      { name: 'taluqa_tehsil_mandal', label: 'Taluqa/Tehsil/Mandal', type: 'text', required: true },
      { name: 'block', label: 'Block', type: 'text', required: false },
      { name: 'district', label: 'District', type: 'text', required: true },
      { name: 'state', label: 'State', type: 'text', required: true },
      { name: 'pin_code', label: 'Pin Code', type: 'text', required: true }
    ];

    // PAN card specific form fields (includes mother's name)
    const panCardFields = [
      { name: 'applicant_name', label: 'Applicant Name', type: 'text', required: true },
      { name: 'father_name', label: 'Father\'s Name', type: 'text', required: true },
      { name: 'mother_name', label: 'Mother\'s Name', type: 'text', required: true },
      { name: 'mobile_number', label: 'Mobile Number', type: 'text', required: true },
      { name: 'email', label: 'E-mail', type: 'email', required: false },
      { name: 'date_of_birth', label: 'Date of Birth', type: 'date', required: true },
      { name: 'gender', label: 'Gender', type: 'select', required: true, options: ['Male', 'Female', 'Other'] },
      { name: 'marital_status', label: 'Marital Status', type: 'select', required: true, options: ['Single', 'Married', 'Divorced', 'Widowed'] },
      
      // Address fields
      { name: 'house_no', label: 'House No.', type: 'text', required: true },
      { name: 'street_area_locality', label: 'Street/Area/Locality', type: 'text', required: true },
      { name: 'ward_name', label: 'Ward Name', type: 'text', required: true },
      { name: 'town_village', label: 'Town/Village', type: 'text', required: true },
      { name: 'panchayat', label: 'Panchayat', type: 'text', required: false },
      { name: 'post_office', label: 'Post Office', type: 'text', required: false },
      { name: 'taluqa_tehsil_mandal', label: 'Taluqa/Tehsil/Mandal', type: 'text', required: true },
      { name: 'block', label: 'Block', type: 'text', required: false },
      { name: 'district', label: 'District', type: 'text', required: true },
      { name: 'state', label: 'State', type: 'text', required: true },
      { name: 'pin_code', label: 'Pin Code', type: 'text', required: true }
    ];

    // All services configuration (23 total services)
    const allServices = [
      // Aadhaar Services (5)
      {
        name: 'DOB update in Aadhaar',
        category: 'Aadhaar Services',
        service_type: 'common',
        base_price: 150.00,
        estimated_time: '7-10 working days',
        required_documents: [
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'matric_certificate', label: 'Matric Certificate', required: true },
          { type: 'birth_certificate', label: 'Birth Certificate', required: true }
        ],
        form_fields: commonFormFields,
        description: 'Update Date of Birth in Aadhaar card with supporting documents',
        allow_pay_after: true
      },
      {
        name: 'Name update in Aadhaar',
        category: 'Aadhaar Services',
        service_type: 'common',
        base_price: 150.00,
        estimated_time: '7-10 working days',
        required_documents: [
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'matric_certificate', label: 'Matric Certificate', required: true },
          { type: 'voter_id', label: 'Voter ID', required: true }
        ],
        form_fields: commonFormFields,
        description: 'Update Name in Aadhaar card with supporting documents',
        allow_pay_after: true
      },
      {
        name: 'Father/Husband name update in Aadhaar',
        category: 'Aadhaar Services',
        service_type: 'common',
        base_price: 150.00,
        estimated_time: '7-10 working days',
        required_documents: [
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'father_husband_aadhar', label: 'Father/Husband Aadhaar', required: true }
        ],
        form_fields: commonFormFields,
        description: 'Update Father/Husband name in Aadhaar card with supporting documents',
        allow_pay_after: true
      },
      {
        name: 'Address update in Aadhaar',
        category: 'Aadhaar Services',
        service_type: 'common',
        base_price: 150.00,
        estimated_time: '7-10 working days',
        required_documents: [
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'father_husband_aadhar', label: 'Father/Husband Aadhaar', required: true }
        ],
        form_fields: commonFormFields,
        description: 'Update Address in Aadhaar card with supporting documents',
        allow_pay_after: true
      },
      {
        name: 'Aadhaar PVC Card',
        category: 'Aadhaar Services',
        service_type: 'common',
        base_price: 50.00,
        estimated_time: '5-7 working days',
        required_documents: [
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true }
        ],
        form_fields: commonFormFields,
        description: 'Get PVC version of Aadhaar card with enhanced durability',
        allow_pay_after: true
      },

      // Welfare Services (5)
      {
        name: 'AYUSMAN CARD',
        category: 'Welfare Services',
        service_type: 'common',
        base_price: 100.00,
        estimated_time: '15-20 working days',
        required_documents: [
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'ration_card', label: 'Ration Card', required: false },
          { type: 'caste_certificate', label: 'Caste Certificate', required: false }
        ],
        form_fields: [
          ...commonFormFields.slice(0, 7),
          { name: 'husband_name', label: 'Husband\'s Name', type: 'text', required: false },
          ...commonFormFields.slice(7)
        ],
        description: 'Ayushman Bharat Health Insurance Card for healthcare benefits',
        allow_pay_after: true
      },
      {
        name: 'BIRTH CERTIFICATE',
        category: 'Welfare Services',
        service_type: 'common',
        base_price: 200.00,
        estimated_time: '10-15 working days',
        required_documents: [
          { type: 'applicant_aadhaar_front', label: 'Applicant Aadhaar Front', required: true },
          { type: 'applicant_aadhaar_back', label: 'Applicant Aadhaar Back', required: true },
          { type: 'father_aadhaar_front', label: 'Father Aadhaar Front', required: true },
          { type: 'father_aadhaar_back', label: 'Father Aadhaar Back', required: true },
          { type: 'mother_aadhaar_front', label: 'Mother Aadhaar Front', required: true },
          { type: 'mother_aadhaar_back', label: 'Mother Aadhaar Back', required: true },
          { type: 'discharge_paper', label: 'Discharge Paper', required: true }
        ],
        form_fields: [
          ...commonFormFields.slice(0, 2),
          { name: 'mother_name', label: 'Mother\'s Name', type: 'text', required: true },
          ...commonFormFields.slice(2, 7),
          ...commonFormFields.slice(8)
        ],
        description: 'Official Birth Certificate registration and issuance',
        allow_pay_after: true
      },
      {
        name: 'All India Disability Pension Scheme',
        category: 'Welfare Services',
        service_type: 'common',
        base_price: 250.00,
        estimated_time: '20-30 working days',
        required_documents: [
          { type: 'applicant_aadhaar_front', label: 'Applicant Aadhaar Front', required: true },
          { type: 'applicant_aadhaar_back', label: 'Applicant Aadhaar Back', required: true },
          { type: 'income_certificate', label: 'Income Certificate', required: false },
          { type: 'self_declaration_form', label: 'Self-Declaration Form', required: true },
          { type: 'caste_certificate', label: 'Caste Certificate', required: false },
          { type: 'residence_certificate', label: 'Residence Certificate', required: false },
          { type: 'ration_card', label: 'Ration Card', required: true },
          { type: 'voter_id_card', label: 'Voter ID Card', required: true },
          { type: 'disability_certificate', label: 'Disability Certificate', required: true },
          { type: 'passport_sized_photo', label: 'Passport Sized Photo', required: true },
          { type: 'bank_passbook', label: 'Bank Passbook', required: true }
        ],
        form_fields: commonFormFields,
        description: 'Disability pension scheme for eligible persons with disabilities',
        allow_pay_after: true
      },
      {
        name: 'Deen Dayal Swasthya Seva Yojana-Goa',
        category: 'Welfare Services',
        service_type: 'common',
        base_price: 300.00,
        estimated_time: '20-30 working days',
        required_documents: [
          { type: 'applicant_aadhaar_front', label: 'Applicant Aadhaar Front', required: true },
          { type: 'applicant_aadhaar_back', label: 'Applicant Aadhaar Back', required: true },
          { type: 'voter_id_card', label: 'Voter ID Card', required: true },
          { type: 'disability_certificate', label: 'Disability Certificate', required: false },
          { type: 'passport_sized_photo', label: 'Passport Sized Photo', required: true },
          { type: 'bank_passbook', label: 'Bank Passbook', required: true },
          { type: 'income_certificate', label: 'Income Certificate', required: true },
          { type: 'declaration_form', label: 'Declaration Form', required: true },
          { type: 'caste_certificate', label: 'Caste Certificate', required: false },
          { type: 'ration_card', label: 'Ration Card', required: false }
        ],
        form_fields: commonFormFields,
        description: 'Goa state health scheme for medical assistance and benefits',
        allow_pay_after: true
      },
      {
        name: 'Mukhyamantri Maiya Samman Yojana-JH',
        category: 'Welfare Services',
        service_type: 'common',
        base_price: 200.00,
        estimated_time: '20-25 working days',
        required_documents: [
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'ration_card', label: 'Ration Card', required: true },
          { type: 'pan_card', label: 'Pan Card', required: true },
          { type: 'voter_id', label: 'Voter ID', required: true },
          { type: 'income_certificate', label: 'Income Certificate', required: true },
          { type: 'passport_sized_photograph', label: 'Passport-sized Photograph', required: true },
          { type: 'bank_passbook', label: 'Bank Passbook', required: true },
          { type: 'self_declaration_form', label: 'Self-Declaration Form', required: true },
          { type: 'caste_certificate', label: 'Caste Certificate', required: false },
          { type: 'job_card', label: 'Job Card', required: true }
        ],
        form_fields: commonFormFields,
        description: 'Jharkhand state women welfare scheme for financial assistance',
        allow_pay_after: true
      },
      {
        name: 'All India Old Age Pension Scheme',
        category: 'Welfare Services',
        service_type: 'common',
        base_price: 150.00,
        estimated_time: '15-20 working days',
        required_documents: [
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'voter_id_card', label: 'Voter ID card', required: true },
          { type: 'bank_passbook', label: 'Bank Passbook', required: true },
          { type: 'self_declaration_form', label: 'Self-Declaration Form', required: true },
          { type: 'age_proof', label: 'Age Proof', required: true },
          { type: 'passport_size_photo', label: 'Passport Size Photo', required: true },
          { type: 'residence_certificate', label: 'Residence Certificate', required: true }
        ],
        form_fields: commonFormFields,
        description: 'National old age pension scheme for senior citizens',
        allow_pay_after: true
      },

      // Certificate Services (6)
      {
        name: 'DOMICILE CERTIFICATE',
        category: 'Certificate Services',
        service_type: 'common',
        base_price: 150.00,
        estimated_time: '15-20 working days',
        required_documents: [
          { type: 'photo', label: 'Photo', required: true },
          { type: 'residence_proof', label: 'Residence Proof', required: true },
          { type: 'aadhaar_card', label: 'Aadhaar Card', required: true },
          { type: 'signature', label: 'Signature', required: true }
        ],
        form_fields: [
          ...commonFormFields.slice(0, 7),
          ...commonFormFields.slice(7)
        ],
        description: 'Domicile certificate for state residency proof',
        allow_pay_after: true
      },
      {
        name: 'DRIVING LICENSE',
        category: 'Certificate Services',
        service_type: 'common',
        base_price: 500.00,
        estimated_time: '30-45 working days',
        required_documents: [
          { type: 'photo', label: 'Photo', required: true },
          { type: 'address_card', label: 'Address Card', required: true }
        ],
        form_fields: [
          { name: 'name_on_application', label: 'Name on Application', type: 'text', required: true },
          { name: 'matrix_name', label: 'Father\'s Name', type: 'text', required: true },
          { name: 'mother_name', label: 'Mother\'s Name', type: 'text', required: true },
          { name: 'mobile_no', label: 'Mobile No.', type: 'text', required: true },
          { name: 'marital_status', label: 'Marital Status', type: 'select', required: true, options: ['Single', 'Married', 'Divorced', 'Widowed'] },
          { name: 'qr_code', label: 'QR Code', type: 'text', required: false },
          { name: 'place_of_birth', label: 'Place Of Birth', type: 'text', required: true },
          { name: 'identification_mark_1', label: 'Identification Mark 1', type: 'text', required: true },
          { name: 'identification_mark_2', label: 'Identification Mark 2', type: 'text', required: false },
          { name: 'vehicle_type', label: 'Vehicle Type', type: 'select', required: true, options: ['Motorcycle', 'Car', 'Commercial Vehicle', 'Heavy Vehicle'] },
          { name: 'state', label: 'State', type: 'select', required: true },
          { name: 'sub_divisions', label: 'Sub-Divisions', type: 'text', required: true },
          { name: 'village_town', label: 'Village / Town', type: 'text', required: true },
          { name: 'police_station', label: 'Police Station', type: 'text', required: true }
        ],
        description: 'Driving license application and issuance',
        allow_pay_after: true
      },
      {
        name: 'NEW PAN',
        category: 'Certificate Services',
        service_type: 'common',
        base_price: 107.00,
        estimated_time: '15-20 working days',
        required_documents: [
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'passport_size_photo', label: 'Passport Size Photo', required: true },
          { type: 'signature', label: 'Signature', required: true },
          { type: 'date_of_birth_proof', label: 'Date of Birth Proof', required: true },
          { type: 'voter_id', label: 'Voter ID', required: false }
        ],
        form_fields: panCardFields,
        description: 'New PAN card application and issuance',
        allow_pay_after: true
      },
      {
        name: 'FASAL BHIMA',
        category: 'Agricultural Services',
        service_type: 'common',
        base_price: 200.00,
        estimated_time: '20-25 working days',
        required_documents: [
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'proof_of_age', label: 'Proof of Age', required: false },
          { type: 'land_papers', label: 'Land Papers (LPC/Land Receipts/Vansawali)/Bandobasti Patta/Farmland papers', required: true },
          { type: 'income_certificate', label: 'Income Certificate', required: false },
          { type: 'passport_sized_photograph', label: 'Passport-sized Photograph', required: true },
          { type: 'bank_passbook', label: 'Bank Passbook', required: true },
          { type: 'self_declaration_certificate', label: 'Self-Declaration Certificate', required: true }
        ],
        form_fields: commonFormFields,
        description: 'Crop insurance scheme for farmers',
        allow_pay_after: true
      },
      {
        name: 'GRIHA AADHAR SCHEMA-GOA',
        category: 'Housing Services',
        service_type: 'common',
        base_price: 300.00,
        estimated_time: '25-30 working days',
        required_documents: [
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'voter_id_card', label: 'Voter ID Card', required: true },
          { type: 'passport_sized_photo', label: 'Passport Sized Photo', required: true },
          { type: 'bank_passbook', label: 'Bank Passbook', required: true },
          { type: 'income_certificate', label: 'Income Certificate', required: true },
          { type: 'self_declaration_form', label: 'Self-Declaration Form', required: true },
          { type: 'residence_certificate', label: 'Residence Certificate', required: false },
          { type: 'ration_card', label: 'Ration Card', required: true },
          { type: 'birth_certificate', label: 'Birth Certificate', required: false },
          { type: 'marriage_certificate', label: 'Marriage Certificate', required: false }
        ],
        form_fields: commonFormFields,
        description: 'Goa housing scheme for residential assistance',
        allow_pay_after: true
      },
      {
        name: 'JOB CARD',
        category: 'Employment Services',
        service_type: 'common',
        base_price: 100.00,
        estimated_time: '10-15 working days',
        required_documents: [
          { type: 'hof_aadhaar_front', label: 'HOF Aadhaar Front', required: true },
          { type: 'hof_aadhaar_back', label: 'HOF Aadhaar Back', required: true },
          { type: 'applicant_aadhaar_front', label: 'Applicant Aadhaar Front', required: true },
          { type: 'applicant_aadhaar_back', label: 'Applicant Aadhaar Back', required: true },
          { type: 'ration_card', label: 'Ration Card', required: true },
          { type: 'bank_passbook', label: 'Bank Passbook', required: true },
          { type: 'all_member_photo', label: 'All Member Photo', required: true },
          { type: 'all_member_passbook', label: 'All Member Passbook', required: true }
        ],
        form_fields: [
          ...commonFormFields.slice(0, 7),
          { name: 'hof_mobile', label: 'Head of Family Mobile', type: 'text', required: true },
          { name: 'ration_dealer_name', label: 'Ration Dealer Name', type: 'text', required: true },
          { name: 'hof_relation', label: 'HOF Relation', type: 'text', required: true },
          { name: 'caste', label: 'Caste', type: 'text', required: true },
          ...commonFormFields.slice(7)
        ],
        description: 'Job card for employment guarantee scheme',
        allow_pay_after: true
      },

      // State Schemes (4)
      {
        name: 'KISAN SAMRIDHI YOJANA -JHARKHAND',
        category: 'State Schemes - Jharkhand',
        service_type: 'common',
        base_price: 250.00,
        estimated_time: '25-30 working days',
        required_documents: [
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'ration_card', label: 'Ration Card', required: true },
          { type: 'proof_of_ownership', label: 'Proof of Ownership/Access to Land and Water Source', required: true },
          { type: 'bank_passbook', label: 'Bank Passbook', required: true },
          { type: 'land_papers', label: 'Land papers (LPC/Land Receipts/Vansawali)/Bandobasti Patta/Farmland papers', required: true }
        ],
        form_fields: commonFormFields,
        description: 'Jharkhand state farmer welfare scheme for agricultural development',
        allow_pay_after: true
      },
      {
        name: 'Laadli Laxmi Scheme-Goa',
        category: 'State Schemes - Goa',
        service_type: 'common',
        base_price: 200.00,
        estimated_time: '20-25 working days',
        required_documents: [
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'voter_id_card', label: 'Voter ID Card', required: true },
          { type: 'passport_sized_photo', label: 'Passport Sized Photo', required: true },
          { type: 'bank_passbook', label: 'Bank Passbook', required: true },
          { type: 'income_certificate', label: 'Income Certificate', required: true },
          { type: 'declaration_form', label: 'Declaration Form', required: true },
          { type: 'caste_certificate', label: 'Caste Certificate', required: false },
          { type: 'ration_card', label: 'Ration Card', required: true },
          { type: 'birth_certificate', label: 'Birth Certificate', required: false },
          { type: 'parent_birth_certificate', label: 'Birth Certificate of parent(s)', required: false }
        ],
        form_fields: commonFormFields,
        description: 'Goa state girl child welfare scheme for education and marriage assistance',
        allow_pay_after: true
      },
      {
        name: 'Mukhyamantri Abua Swasthya Yojana - JH(MAAY-JH)',
        category: 'State Schemes - Jharkhand',
        service_type: 'common',
        base_price: 300.00,
        estimated_time: '25-30 working days',
        required_documents: [
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'residence_proof', label: 'Residence Proof', required: false },
          { type: 'ration_card', label: 'Ration Card', required: true },
          { type: 'pan_card', label: 'Pan Card', required: false },
          { type: 'voter_id', label: 'Voter ID', required: false },
          { type: 'income_certificate', label: 'Income Certificate', required: false },
          { type: 'passport_sized_photograph', label: 'Passport-sized Photograph', required: true },
          { type: 'bank_passbook', label: 'Bank Passbook', required: true },
          { type: 'self_declaration_form', label: 'Self-Declaration Form', required: true },
          { type: 'caste_certificate', label: 'Caste Certificate', required: false },
          { type: 'job_card', label: 'Job Card', required: false }
        ],
        form_fields: commonFormFields,
        description: 'Jharkhand state comprehensive health insurance scheme for medical coverage',
        allow_pay_after: true
      }
    ];

    // Create or update all services
    console.log('Seeding all services...');
    
    for (const serviceData of allServices) {
      const [service, created] = await Service.findOrCreate({
        where: { name: serviceData.name },
        defaults: serviceData
      });

      if (created) {
        console.log(`✅ Created service: ${service.name}`);
      } else {
        // Update existing service with latest configuration
        await service.update(serviceData);
        console.log(`🔄 Updated service: ${service.name}`);
      }
    }

    // Get final service count
    const finalServices = await Service.findAll({
      attributes: ['id', 'name', 'category', 'base_price', 'service_type'],
      order: [['category', 'ASC'], ['name', 'ASC']]
    });

    console.log('\n🎉 All services seeded successfully!');
    console.log('=====================================');
    
    let totalServices = 0;
    const categoryCount = {};

    finalServices.forEach(service => {
      console.log(`✅ ${service.name} (${service.category}) - Rs.${service.base_price}`);
      totalServices++;
      categoryCount[service.category] = (categoryCount[service.category] || 0) + 1;
    });

    console.log('\n📊 Service Summary:');
    console.log('==================');
    console.log(`Total Services: ${totalServices}`);
    
    Object.entries(categoryCount).forEach(([category, count]) => {
      console.log(`${category}: ${count} services`);
    });

    console.log('\n🚀 All 23+ services are now available in database!');

  } catch (error) {
    console.error('Error seeding all services:', error);
  } finally {
    await sequelize.close();
    console.log('Database connection closed.');
  }
};

seedAllServices();
