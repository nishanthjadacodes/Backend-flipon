import 'dotenv/config';
import { sequelize } from '../src/config/database.js';
import { Service, syncModels } from '../src/models/index.js';

const seedStateSchemes = async () => {
  try {
    // Connect to database
    await sequelize.authenticate();
    console.log('Database connection established.');

    // Sync models
    await syncModels();
    console.log('Database models synchronized.');

    // Common form fields for state schemes
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

    // State-specific government schemes configuration
    const stateSchemes = [
      {
        name: 'KISAN SAMRIDHI YOJANA -JHARKHAND',
        category: 'State Schemes - Jharkhand',
        service_type: 'government_document',
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
        service_type: 'government_document',
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
          { type: 'parent_birth_certificate', label: 'Birth Certificate of the parent(s)', required: false }
        ],
        form_fields: commonFormFields,
        description: 'Goa state girl child welfare scheme for education and marriage assistance',
        allow_pay_after: true
      },
      {
        name: 'Mukhyamantri Abua Swasthya Yojana - JH(MAAY-JH)',
        category: 'State Schemes - Jharkhand',
        service_type: 'government_document',
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

    // Create services
    for (const serviceData of stateSchemes) {
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

    console.log('\nState-specific schemes seeded successfully!');
    console.log('Services created:');
    stateSchemes.forEach(service => {
      console.log(`- ${service.name} (Rs.${service.base_price})`);
    });

  } catch (error) {
    console.error('Error seeding state schemes:', error);
  } finally {
    await sequelize.close();
    console.log('Database connection closed.');
  }
};

seedStateSchemes();
