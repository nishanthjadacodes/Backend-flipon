import 'dotenv/config';
import { sequelize } from '../src/config/database.js';
import { Service, syncModels } from '../src/models/index.js';

const seedAdditionalServices = async () => {
  try {
    // Connect to database
    await sequelize.authenticate();
    console.log('Database connection established.');

    // Sync models
    await syncModels();
    console.log('Database models synchronized.');

    // Common form fields for additional services
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

    // Additional government services configuration
    const additionalServices = [
      {
        name: 'Mukhyamantri Maiya Samman Yojana-JH',
        category: 'State Schemes - Jharkhand',
        service_type: 'government_document',
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
        service_type: 'government_document',
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
      {
        name: 'NEW PAN',
        category: 'Certificate Services',
        service_type: 'government_document',
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
      }
    ];

    // Create services
    for (const serviceData of additionalServices) {
      const [service, created] = await Service.findOrCreate({
        where: { name: serviceData.name },
        defaults: serviceData
      });

      if (created) {
        console.log(`Created service: ${service.name}`);
      } else {
        // Update existing service with latest configuration
        await service.update(serviceData);
        console.log(`Updated service: ${service.name}`);
      }
    }

    console.log('\nAdditional government services seeded successfully!');
    console.log('Services created:');
    additionalServices.forEach(service => {
      console.log(`- ${service.name} (Rs.${service.base_price})`);
    });

  } catch (error) {
    console.error('Error seeding additional services:', error);
  } finally {
    await sequelize.close();
    console.log('Database connection closed.');
  }
};

seedAdditionalServices();
