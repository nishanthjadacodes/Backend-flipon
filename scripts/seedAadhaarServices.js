import 'dotenv/config';
import { sequelize } from '../src/config/database.js';
import { Service, syncModels } from '../src/models/index.js';

const seedAadhaarServices = async () => {
  try {
    // Connect to database
    await sequelize.authenticate();
    console.log('Database connection established.');

    // Sync models
    await syncModels();
    console.log('Database models synchronized.');

    // Define common form fields for Aadhaar services
    const commonFormFields = [
      { name: 'applicant_name', label: 'Applicant Name', type: 'text', required: true },
      { name: 'father_name', label: 'Father\'s Name', type: 'text', required: true },
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

    // Aadhaar services configuration
    const aadhaarServices = [
      {
        name: 'DOB update in Aadhaar',
        category: 'Aadhaar Services',
        service_type: 'government_document',
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
        service_type: 'government_document',
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
        service_type: 'government_document',
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
        service_type: 'government_document',
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
        service_type: 'government_document',
        base_price: 50.00,
        estimated_time: '5-7 working days',
        required_documents: [
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true }
        ],
        form_fields: commonFormFields,
        description: 'Get PVC version of Aadhaar card with enhanced durability',
        allow_pay_after: true
      }
    ];

    // Create services
    for (const serviceData of aadhaarServices) {
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

    console.log('\nAadhaar services seeded successfully!');
    console.log('Services created:');
    aadhaarServices.forEach(service => {
      console.log(`- ${service.name} (Rs.${service.base_price})`);
    });

  } catch (error) {
    console.error('Error seeding Aadhaar services:', error);
  } finally {
    await sequelize.close();
    console.log('Database connection closed.');
  }
};

seedAadhaarServices();
