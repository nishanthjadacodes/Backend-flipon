import 'dotenv/config';
import { sequelize } from '../src/config/database.js';
import { Service, syncModels } from '../src/models/index.js';

const seedCertificateServices = async () => {
  try {
    // Connect to database
    await sequelize.authenticate();
    console.log('Database connection established.');

    // Sync models
    await syncModels();
    console.log('Database models synchronized.');

    // Domicile Certificate form fields
    const domicileFormFields = [
      { name: 'applicant_name', label: 'Applicant Name', type: 'text', required: true },
      { name: 'father_name', label: 'Father Name', type: 'text', required: true },
      { name: 'mother_name', label: 'Mother Name', type: 'text', required: true },
      { name: 'email_id', label: 'Email ID', type: 'email', required: false },
      { name: 'mobile_no', label: 'Mobile No.', type: 'text', required: true },
      { name: 'marital_status', label: 'Marital Status', type: 'select', required: true, options: ['Single', 'Married', 'Divorced', 'Widowed'] },
      { name: 'gender', label: 'Gender', type: 'select', required: true, options: ['Male', 'Female', 'Other'] },
      { name: 'dob', label: 'Date of Birth', type: 'date', required: true },
      
      // Address Details
      { name: 'state', label: 'State', type: 'text', required: true },
      { name: 'district', label: 'District', type: 'select', required: true },
      { name: 'sub_division', label: 'Sub-Division', type: 'text', required: true },
      { name: 'block', label: 'Block', type: 'text', required: true },
      { name: 'village_town', label: 'Village / Town', type: 'text', required: true },
      { name: 'post_office', label: 'Post Office', type: 'text', required: true },
      { name: 'pincode', label: 'PinCode', type: 'text', required: true },
      { name: 'police_station', label: 'Police Station', type: 'text', required: true }
    ];

    // Driving License form fields
    const drivingLicenseFields = [
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
      
      // Address Details
      { name: 'state', label: 'State', type: 'select', required: true },
      { name: 'sub_divisions', label: 'Sub-Divisions', type: 'text', required: true },
      { name: 'village_town', label: 'Village / Town', type: 'text', required: true },
      { name: 'police_station', label: 'Police Station', type: 'text', required: true }
    ];

    // Common form fields for agricultural and housing schemes
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

    // Job Card specific form fields
    const jobCardFields = [
      { name: 'applicant_name', label: 'Applicant Name', type: 'text', required: true },
      { name: 'father_name', label: 'Father\'s Name', type: 'text', required: true },
      { name: 'mobile_number', label: 'Mobile Number', type: 'text', required: true },
      { name: 'email', label: 'E-mail', type: 'email', required: false },
      { name: 'date_of_birth', label: 'Date of Birth', type: 'date', required: true },
      { name: 'gender', label: 'Gender', type: 'select', required: true, options: ['Male', 'Female', 'Other'] },
      { name: 'marital_status', label: 'Marital Status', type: 'select', required: true, options: ['Single', 'Married', 'Divorced', 'Widowed'] },
      
      // Additional Job Card fields
      { name: 'hof_mobile', label: 'Head of Family Mobile', type: 'text', required: true },
      { name: 'ration_dealer_name', label: 'Ration Dealer Name', type: 'text', required: true },
      { name: 'hof_relation', label: 'HOF Relation', type: 'text', required: true },
      { name: 'caste', label: 'Caste', type: 'text', required: true },
      
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

    // Certificate and licensing services configuration
    const certificateServices = [
      {
        name: 'DOMICILE CERTIFICATE',
        category: 'Certificate Services',
        service_type: 'government_document',
        base_price: 150.00,
        estimated_time: '15-20 working days',
        required_documents: [
          { type: 'photo', label: 'Photo', required: true },
          { type: 'residence_proof', label: 'Residence Proof', required: true },
          { type: 'aadhaar_card', label: 'Aadhaar Card', required: true },
          { type: 'signature', label: 'Signature', required: true }
        ],
        form_fields: domicileFormFields,
        description: 'Domicile certificate for state residency proof',
        allow_pay_after: true
      },
      {
        name: 'DRIVING LICENSE',
        category: 'Certificate Services',
        service_type: 'government_document',
        base_price: 500.00,
        estimated_time: '30-45 working days',
        required_documents: [
          { type: 'photo', label: 'Photo', required: true },
          { type: 'address_card', label: 'Address Card', required: true }
        ],
        form_fields: drivingLicenseFields,
        description: 'Driving license application and issuance',
        allow_pay_after: true
      },
      {
        name: 'FASAL BHIMA',
        category: 'Agricultural Services',
        service_type: 'government_document',
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
        service_type: 'government_document',
        base_price: 300.00,
        estimated_time: '25-30 working days',
        required_documents: [
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'voter_id_card', label: 'Voter ID Card', required: true },
          { type: 'passport_sized_photo', label: 'Passport Sized Photo', required: true },
          { type: 'bank_passbook', label: 'Bank Passbook', required: true },
          { type: 'income_certificate', label: 'Income Certificate', required: false },
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
        service_type: 'government_document',
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
        form_fields: jobCardFields,
        description: 'Job card for employment guarantee scheme',
        allow_pay_after: true
      }
    ];

    // Create services
    for (const serviceData of certificateServices) {
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

    console.log('\nCertificate and licensing services seeded successfully!');
    console.log('Services created:');
    certificateServices.forEach(service => {
      console.log(`- ${service.name} (Rs.${service.base_price})`);
    });

  } catch (error) {
    console.error('Error seeding certificate services:', error);
  } finally {
    await sequelize.close();
    console.log('Database connection closed.');
  }
};

seedCertificateServices();
