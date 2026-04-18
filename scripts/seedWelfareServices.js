import 'dotenv/config';
import { sequelize } from '../src/config/database.js';
import { Service, syncModels } from '../src/models/index.js';

const seedWelfareServices = async () => {
  try {
    // Connect to database
    await sequelize.authenticate();
    console.log('Database connection established.');

    // Sync models
    await syncModels();
    console.log('Database models synchronized.');

    // Define common form fields for welfare services
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

    // Birth certificate specific form fields
    const birthCertificateFields = [
      { name: 'applicant_name', label: 'Applicant Name', type: 'text', required: true },
      { name: 'father_name', label: 'Father\'s Name', type: 'text', required: true },
      { name: 'mother_name', label: 'Mother\'s Name', type: 'text', required: true },
      { name: 'mobile_number', label: 'Mobile Number', type: 'text', required: true },
      { name: 'email', label: 'E-mail', type: 'email', required: false },
      { name: 'date_of_birth', label: 'Date of Birth', type: 'date', required: true },
      { name: 'gender', label: 'Gender', type: 'select', required: true, options: ['Male', 'Female', 'Other'] },
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

    // Welfare services configuration
    const welfareServices = [
      {
        name: 'AYUSMAN CARD',
        category: 'Welfare Services',
        service_type: 'government_document',
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
        service_type: 'government_document',
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
        form_fields: birthCertificateFields,
        description: 'Official Birth Certificate registration and issuance',
        allow_pay_after: true
      },
      {
        name: 'All India Disability Pension Scheme',
        category: 'Welfare Services',
        service_type: 'government_document',
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
        service_type: 'government_document',
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
      }
    ];

    // Create services
    for (const serviceData of welfareServices) {
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

    console.log('\nWelfare services seeded successfully!');
    console.log('Services created:');
    welfareServices.forEach(service => {
      console.log(`- ${service.name} (Rs.${service.base_price})`);
    });

  } catch (error) {
    console.error('Error seeding welfare services:', error);
  } finally {
    await sequelize.close();
    console.log('Database connection closed.');
  }
};

seedWelfareServices();
