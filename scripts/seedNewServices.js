import 'dotenv/config';
import { sequelize } from '../src/config/database.js';
import { Service, syncModels } from '../src/models/index.js';

const seedNewServices = async () => {
  try {
    // Connect to database
    await sequelize.authenticate();
    console.log('Database connection established.');

    // Sync models
    await syncModels();
    console.log('Database models synchronized.');

    // Common form fields for government schemes
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

    // ESI Services form fields (simplified for employee services)
    const esiFormFields = [
      { name: 'applicant_name', label: 'Applicant Name', type: 'text', required: true },
      { name: 'father_name', label: 'Father\'s Name', type: 'text', required: true },
      { name: 'mobile_number', label: 'Mobile Number', type: 'text', required: true },
      { name: 'email', label: 'E-mail', type: 'email', required: false },
      { name: 'date_of_birth', label: 'Date of Birth', type: 'date', required: true },
      { name: 'gender', label: 'Gender', type: 'select', required: true, options: ['Male', 'Female', 'Other'] },
      { name: 'marital_status', label: 'Marital Status', type: 'select', required: true, options: ['Single', 'Married', 'Divorced', 'Widowed'] },
      
      // ESI specific fields
      { name: 'esi_number', label: 'ESI Number', type: 'text', required: true },
      { name: 'ip_number', label: 'IP Number', type: 'text', required: false },
      { name: 'employer_name', label: 'Employer Name', type: 'text', required: true },
      { name: 'employment_id', label: 'Employment ID', type: 'text', required: false },
      
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

    // New services configuration
    const newServices = [
      // Updated All India Disability Pension Scheme
      {
        name: 'All India Disability Pension Scheme',
        category: 'Government Scheme',
        service_type: 'common',
        base_price: 250.00,
        estimated_time: '20-30 working days',
        required_documents: [
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'voter_id_card', label: 'Voter ID Card', required: true },
          { type: 'disability_certificate', label: 'Disability Certificate', required: true },
          { type: 'passport_sized_photo', label: 'Passport Sized Photo', required: true },
          { type: 'bank_passbook', label: 'Bank Passbook', required: true },
          { type: 'income_certificate', label: 'Income Certificate', required: false },
          { type: 'self_declaration_form', label: 'Self-Declaration Form', required: true },
          { type: 'caste_certificate', label: 'Caste Certificate', required: false },
          { type: 'residence_certificate', label: 'Residence Certificate', required: false },
          { type: 'ration_card', label: 'Ration Card', required: true },
          { type: 'additional_document_1', label: 'Additional Document 1', required: false },
          { type: 'additional_document_2', label: 'Additional Document 2', required: false },
          { type: 'additional_document_3', label: 'Additional Document 3', required: false },
          { type: 'additional_document_4', label: 'Additional Document 4', required: false }
        ],
        form_fields: commonFormFields,
        description: 'National disability pension scheme with comprehensive document requirements',
        allow_pay_after: true
      },

      // ESI Services (15 services)
      {
        name: 'Maternity Benefit (ESI)',
        category: 'ESI Service',
        service_type: 'common',
        base_price: 150.00,
        estimated_time: '15-20 working days',
        required_documents: [
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'esi_card', label: 'ESI Card', required: true },
          { type: 'maternity_certificate', label: 'Maternity Certificate', required: true },
          { type: 'bank_passbook', label: 'Bank Passbook', required: true },
          { type: 'employment_proof', label: 'Employment Proof', required: true }
        ],
        form_fields: [
          ...esiFormFields.slice(0, 7),
          { name: 'pregnancy_details', label: 'Pregnancy Details', type: 'text', required: true },
          { name: 'expected_delivery_date', label: 'Expected Delivery Date', type: 'date', required: true },
          ...esiFormFields.slice(7)
        ],
        description: 'ESI maternity benefit claim for insured women',
        allow_pay_after: true
      },
      {
        name: 'ESI Leave Claim',
        category: 'ESI Service',
        service_type: 'common',
        base_price: 100.00,
        estimated_time: '10-15 working days',
        required_documents: [
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'esi_card', label: 'ESI Card', required: true },
          { type: 'medical_certificate', label: 'Medical Certificate', required: true },
          { type: 'leave_application', label: 'Leave Application', required: true }
        ],
        form_fields: [
          ...esiFormFields.slice(0, 7),
          { name: 'leave_type', label: 'Leave Type', type: 'select', required: true, options: ['Sickness', 'Maternity', 'Disablement'] },
          { name: 'leave_start_date', label: 'Leave Start Date', type: 'date', required: true },
          { name: 'leave_end_date', label: 'Leave End Date', type: 'date', required: true },
          ...esiFormFields.slice(7)
        ],
        description: 'ESI leave claim for sickness, maternity, or disablement',
        allow_pay_after: true
      },
      {
        name: 'Claim for Sickness',
        category: 'ESI Service',
        service_type: 'common',
        base_price: 100.00,
        estimated_time: '10-15 working days',
        required_documents: [
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'esi_card', label: 'ESI Card', required: true },
          { type: 'medical_certificate', label: 'Medical Certificate', required: true },
          { type: 'doctor_prescription', label: 'Doctor Prescription', required: true }
        ],
        form_fields: [
          ...esiFormFields.slice(0, 7),
          { name: 'sickness_type', label: 'Sickness Type', type: 'text', required: true },
          { name: 'sickness_duration', label: 'Sickness Duration', type: 'text', required: true },
          ...esiFormFields.slice(7)
        ],
        description: 'ESI sickness benefit claim for temporary illness',
        allow_pay_after: true
      },
      {
        name: 'Temporary Disablement',
        category: 'ESI Service',
        service_type: 'common',
        base_price: 200.00,
        estimated_time: '15-20 working days',
        required_documents: [
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'esi_card', label: 'ESI Card', required: true },
          { type: 'disablement_certificate', label: 'Disablement Certificate', required: true },
          { type: 'medical_report', label: 'Medical Report', required: true }
        ],
        form_fields: [
          ...esiFormFields.slice(0, 7),
          { name: 'disablement_type', label: 'Disablement Type', type: 'text', required: true },
          { name: 'disablement_cause', label: 'Disablement Cause', type: 'text', required: true },
          ...esiFormFields.slice(7)
        ],
        description: 'ESI temporary disablement benefit claim',
        allow_pay_after: true
      },
      {
        name: 'Reimbursement',
        category: 'ESI Service',
        service_type: 'common',
        base_price: 150.00,
        estimated_time: '15-20 working days',
        required_documents: [
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'esi_card', label: 'ESI Card', required: true },
          { type: 'medical_bills', label: 'Medical Bills', required: true },
          { type: 'prescription_receipts', label: 'Prescription Receipts', required: true },
          { type: 'hospital_discharge_summary', label: 'Hospital Discharge Summary', required: false }
        ],
        form_fields: [
          ...esiFormFields.slice(0, 7),
          { name: 'reimbursement_type', label: 'Reimbursement Type', type: 'select', required: true, options: ['Medical', 'Hospitalization', 'Medicine'] },
          { name: 'total_amount', label: 'Total Amount', type: 'number', required: true },
          ...esiFormFields.slice(7)
        ],
        description: 'ESI medical expense reimbursement claim',
        allow_pay_after: true
      },
      {
        name: 'Pension Withdrawal',
        category: 'ESI Service',
        service_type: 'common',
        base_price: 100.00,
        estimated_time: '10-15 working days',
        required_documents: [
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'esi_card', label: 'ESI Card', required: true },
          { type: 'pension_certificate', label: 'Pension Certificate', required: true },
          { type: 'bank_passbook', label: 'Bank Passbook', required: true }
        ],
        form_fields: [
          ...esiFormFields.slice(0, 7),
          { name: 'pension_type', label: 'Pension Type', type: 'select', required: true, options: ['Temporary Disablement', 'Dependent', 'Old Age'] },
          { name: 'withdrawal_amount', label: 'Withdrawal Amount', type: 'number', required: true },
          ...esiFormFields.slice(7)
        ],
        description: 'ESI pension withdrawal application',
        allow_pay_after: true
      },
      {
        name: 'Name/Father/DOB Change (ESI)',
        category: 'ESI Service',
        service_type: 'common',
        base_price: 100.00,
        estimated_time: '10-15 working days',
        required_documents: [
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'esi_card', label: 'ESI Card', required: true },
          { type: 'name_change_proof', label: 'Name Change Proof', required: true },
          { type: 'supporting_document', label: 'Supporting Document', required: true }
        ],
        form_fields: [
          ...esiFormFields.slice(0, 7),
          { name: 'change_type', label: 'Change Type', type: 'select', required: true, options: ['Name', 'Father Name', 'Date of Birth'] },
          { name: 'current_value', label: 'Current Value', type: 'text', required: true },
          { name: 'new_value', label: 'New Value', type: 'text', required: true },
          ...esiFormFields.slice(7)
        ],
        description: 'ESI record update for name, father name, or date of birth',
        allow_pay_after: true
      },
      {
        name: 'KYC Details Update (ESI)',
        category: 'ESI Service',
        service_type: 'common',
        base_price: 50.00,
        estimated_time: '7-10 working days',
        required_documents: [
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'esi_card', label: 'ESI Card', required: true },
          { type: 'address_proof', label: 'Address Proof', required: true },
          { type: 'photo', label: 'Photo', required: true }
        ],
        form_fields: [
          ...esiFormFields.slice(0, 7),
          { name: 'kyc_type', label: 'KYC Type', type: 'select', required: true, options: ['Address', 'Mobile', 'Email', 'Photo'] },
          ...esiFormFields.slice(7)
        ],
        description: 'ESI KYC details update application',
        allow_pay_after: true
      },
      {
        name: 'System of Treatment',
        category: 'ESI Service',
        service_type: 'common',
        base_price: 100.00,
        estimated_time: '10-15 working days',
        required_documents: [
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'esi_card', label: 'ESI Card', required: true },
          { type: 'medical_prescription', label: 'Medical Prescription', required: true },
          { type: 'doctor_certificate', label: 'Doctor Certificate', required: true }
        ],
        form_fields: [
          ...esiFormFields.slice(0, 7),
          { name: 'treatment_type', label: 'Treatment Type', type: 'select', required: true, options: ['Allopathic', 'Ayurvedic', 'Homeopathic', 'Unani'] },
          { name: 'treatment_duration', label: 'Treatment Duration', type: 'text', required: true },
          ...esiFormFields.slice(7)
        ],
        description: 'ESI system of treatment benefit claim',
        allow_pay_after: true
      },
      {
        name: 'Scale of Medical Benefit',
        category: 'ESI Service',
        service_type: 'common',
        base_price: 100.00,
        estimated_time: '10-15 working days',
        required_documents: [
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'esi_card', label: 'ESI Card', required: true },
          { type: 'medical_report', label: 'Medical Report', required: true },
          { type: 'hospital_certificate', label: 'Hospital Certificate', required: true }
        ],
        form_fields: [
          ...esiFormFields.slice(0, 7),
          { name: 'benefit_scale', label: 'Benefit Scale', type: 'text', required: true },
          { name: 'medical_condition', label: 'Medical Condition', type: 'text', required: true },
          ...esiFormFields.slice(7)
        ],
        description: 'ESI scale of medical benefit application',
        allow_pay_after: true
      },
      {
        name: 'Benefits to Retired IPs',
        category: 'ESI Service',
        service_type: 'common',
        base_price: 150.00,
        estimated_time: '15-20 working days',
        required_documents: [
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'esi_card', label: 'ESI Card', required: true },
          { type: 'retirement_certificate', label: 'Retirement Certificate', required: true },
          { type: 'bank_passbook', label: 'Bank Passbook', required: true }
        ],
        form_fields: [
          ...esiFormFields.slice(0, 7),
          { name: 'retirement_date', label: 'Retirement Date', type: 'date', required: true },
          { name: 'benefit_type', label: 'Benefit Type', type: 'select', required: true, options: ['Medical', 'Pension', 'Other'] },
          ...esiFormFields.slice(7)
        ],
        description: 'ESI benefits for retired insured persons',
        allow_pay_after: true
      },
      {
        name: 'Domiciliary Treatment',
        category: 'ESI Service',
        service_type: 'common',
        base_price: 100.00,
        estimated_time: '10-15 working days',
        required_documents: [
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'esi_card', label: 'ESI Card', required: true },
          { type: 'doctor_prescription', label: 'Doctor Prescription', required: true },
          { type: 'treatment_certificate', label: 'Treatment Certificate', required: true }
        ],
        form_fields: [
          ...esiFormFields.slice(0, 7),
          { name: 'treatment_details', label: 'Treatment Details', type: 'text', required: true },
          { name: 'treatment_period', label: 'Treatment Period', type: 'text', required: true },
          ...esiFormFields.slice(7)
        ],
        description: 'ESI domiciliary treatment benefit claim',
        allow_pay_after: true
      },
      {
        name: 'Specialist Consultation',
        category: 'ESI Service',
        service_type: 'common',
        base_price: 150.00,
        estimated_time: '10-15 working days',
        required_documents: [
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'esi_card', label: 'ESI Card', required: true },
          { type: 'referral_letter', label: 'Referral Letter', required: true },
          { type: 'specialist_report', label: 'Specialist Report', required: true }
        ],
        form_fields: [
          ...esiFormFields.slice(0, 7),
          { name: 'specialist_type', label: 'Specialist Type', type: 'select', required: true, options: ['Cardiologist', 'Neurologist', 'Orthopedic', 'Gynecologist', 'Other'] },
          { name: 'consultation_reason', label: 'Consultation Reason', type: 'text', required: true },
          ...esiFormFields.slice(7)
        ],
        description: 'ESI specialist consultation benefit claim',
        allow_pay_after: true
      },
      {
        name: 'In-Patient Treatment',
        category: 'ESI Service',
        service_type: 'common',
        base_price: 200.00,
        estimated_time: '15-20 working days',
        required_documents: [
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'esi_card', label: 'ESI Card', required: true },
          { type: 'hospital_admission_record', label: 'Hospital Admission Record', required: true },
          { type: 'discharge_summary', label: 'Discharge Summary', required: true },
          { type: 'medical_bills', label: 'Medical Bills', required: true }
        ],
        form_fields: [
          ...esiFormFields.slice(0, 7),
          { name: 'admission_date', label: 'Admission Date', type: 'date', required: true },
          { name: 'discharge_date', label: 'Discharge Date', type: 'date', required: true },
          { name: 'treatment_details', label: 'Treatment Details', type: 'text', required: true },
          ...esiFormFields.slice(7)
        ],
        description: 'ESI in-patient hospitalization benefit claim',
        allow_pay_after: true
      },
      {
        name: 'Imaging Services',
        category: 'ESI Service',
        service_type: 'common',
        base_price: 100.00,
        estimated_time: '10-15 working days',
        required_documents: [
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'esi_card', label: 'ESI Card', required: true },
          { type: 'doctor_prescription', label: 'Doctor Prescription', required: true },
          { type: 'imaging_reports', label: 'Imaging Reports', required: true }
        ],
        form_fields: [
          ...esiFormFields.slice(0, 7),
          { name: 'imaging_type', label: 'Imaging Type', type: 'select', required: true, options: ['X-Ray', 'CT Scan', 'MRI', 'Ultrasound', 'Other'] },
          { name: 'body_part', label: 'Body Part', type: 'text', required: true },
          ...esiFormFields.slice(7)
        ],
        description: 'ESI imaging services (X-Ray, CT, MRI, etc.) benefit claim',
        allow_pay_after: true
      },
      {
        name: 'Artificial Limbs & Aids Special Provisions',
        category: 'ESI Service',
        service_type: 'common',
        base_price: 300.00,
        estimated_time: '20-25 working days',
        required_documents: [
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'esi_card', label: 'ESI Card', required: true },
          { type: 'disability_certificate', label: 'Disability Certificate', required: true },
          { type: 'medical_prescription', label: 'Medical Prescription', required: true },
          { type: 'quotation', label: 'Quotation from Provider', required: true }
        ],
        form_fields: [
          ...esiFormFields.slice(0, 7),
          { name: 'aid_type', label: 'Aid Type', type: 'select', required: true, options: ['Artificial Limb', 'Hearing Aid', 'Wheelchair', 'Walking Aid', 'Other'] },
          { name: 'aid_specifications', label: 'Aid Specifications', type: 'text', required: true },
          ...esiFormFields.slice(7)
        ],
        description: 'ESI artificial limbs and aids special provisions benefit',
        allow_pay_after: true
      },

      // PM Street Vendors Atma Nirbhar Nidhi
      {
        name: 'PM Street Vendors Atma Nirbhar Nidhi',
        category: 'Government Scheme',
        service_type: 'common',
        base_price: 200.00,
        estimated_time: '20-25 working days',
        required_documents: [
          { type: 'aadhaar_front', label: 'Aadhaar Front', required: true },
          { type: 'aadhaar_back', label: 'Aadhaar Back', required: true },
          { type: 'photograph', label: 'Photograph', required: true },
          { type: 'bank_passbook', label: 'Bank Passbook', required: true },
          { type: 'self_declaration_certificate', label: 'Self-declaration certificate', required: true },
          { type: 'driving_license', label: 'Driving License', required: false },
          { type: 'caste_certificate', label: 'Caste Certificate', required: false },
          { type: 'income_certificate', label: 'Income Certificate', required: false },
          { type: 'domicile_certificate', label: 'Domicile Certificate', required: false },
          { type: 'ssi_msme_registration', label: 'SSI / MSME registration', required: false },
          { type: 'proof_of_business_address', label: 'Proof of Business Address', required: false },
          { type: 'certificate_of_vending', label: 'Certificate of Vending', required: true },
          { type: 'letter_of_recommendation', label: 'Letter of Recommendation', required: false },
          { type: 'mnrega_card', label: 'MNREGA Card', required: false },
          { type: 'pan_card', label: 'PAN Card', required: false },
          { type: 'request_letter_to_ulb', label: 'Request letter to ULB', required: false },
          { type: 'additional_document_1', label: 'Additional Document 1', required: false },
          { type: 'additional_document_2', label: 'Additional Document 2', required: false },
          { type: 'additional_document_3', label: 'Additional Document 3', required: false },
          { type: 'additional_document_4', label: 'Additional Document 4', required: false }
        ],
        form_fields: [
          ...commonFormFields.slice(0, 7),
          { name: 'business_type', label: 'Business Type', type: 'text', required: true },
          { name: 'business_address', label: 'Business Address', type: 'text', required: true },
          { name: 'years_in_business', label: 'Years in Business', type: 'number', required: true },
          ...commonFormFields.slice(7)
        ],
        description: 'PM Street Vendors Atma Nirbhar Nidhi scheme for street vendors welfare',
        allow_pay_after: true
      }
    ];

    // Create or update all new services
    console.log('Seeding new services...');
    
    for (const serviceData of newServices) {
      const [service, created] = await Service.findOrCreate({
        where: { name: serviceData.name },
        defaults: serviceData
      });

      if (created) {
        console.log(`\u2705 Created service: ${service.name}`);
      } else {
        // Update existing service with latest configuration
        await service.update(serviceData);
        console.log(`\ud83d\udd04 Updated service: ${service.name}`);
      }
    }

    console.log('\n\ud83c\udf89 New services seeded successfully!');
    console.log('=====================================');
    
    console.log('\ud83d\udcca Summary of New Services:');
    console.log('==================');
    console.log('1. All India Disability Pension Scheme (Updated) - Government Scheme');
    console.log('2. Maternity Benefit (ESI) - ESI Service');
    console.log('3. ESI Leave Claim - ESI Service');
    console.log('4. Claim for Sickness - ESI Service');
    console.log('5. Temporary Disablement - ESI Service');
    console.log('6. Reimbursement - ESI Service');
    console.log('7. Pension Withdrawal - ESI Service');
    console.log('8. Name/Father/DOB Change (ESI) - ESI Service');
    console.log('9. KYC Details Update (ESI) - ESI Service');
    console.log('10. System of Treatment - ESI Service');
    console.log('11. Scale of Medical Benefit - ESI Service');
    console.log('12. Benefits to Retired IPs - ESI Service');
    console.log('13. Domiciliary Treatment - ESI Service');
    console.log('14. Specialist Consultation - ESI Service');
    console.log('15. In-Patient Treatment - ESI Service');
    console.log('16. Imaging Services - ESI Service');
    console.log('17. Artificial Limbs & Aids Special Provisions - ESI Service');
    console.log('18. PM Street Vendors Atma Nirbhar Nidhi - Government Scheme');

    console.log('\n\ud83d\ude80 Total New Services Added: 17 services');
    console.log('Including: 1 Updated Disability Scheme + 15 ESI Services + 1 PM SVANidhi Scheme');

  } catch (error) {
    console.error('Error seeding new services:', error);
  } finally {
    await sequelize.close();
    console.log('Database connection closed.');
  }
};

seedNewServices();
