/**
 * Stage templates — the default sub-stage pipeline created for each enquiry
 * at submission time. Once the admin panel has a UI to customize these per
 * service, swap this in-code map for a `service.pipeline_template` column
 * (JSON) read from the database. Until then, this is the single source of
 * truth for what milestones the customer sees on EnquiryDetailsScreen.
 *
 * Keep stage_key stable — translations and UI labels can change, but the
 * machine identifier is what the admin panel dispatches against.
 */

// Conservative, service-agnostic default. Used for any industrial service
// that doesn't match a more specific template.
const GENERIC_TEMPLATE = [
  { stage_key: 'application_prep',       label: 'Application Preparation',     description: 'Collating documents and preparing the filing.' },
  { stage_key: 'application_submitted',  label: 'Application Submitted',       description: 'Filed with the regulator.' },
  { stage_key: 'under_review',           label: 'Under Review',                description: 'Regulator is reviewing your application.' },
  { stage_key: 'inspection_or_query',    label: 'Inspection / Query Response', description: 'On-site inspection or clarification request, if applicable.' },
  { stage_key: 'approval_issued',        label: 'Approval Issued',             description: 'Certificate / licence / NOC has been granted.' },
  { stage_key: 'deliverable_handover',   label: 'Deliverable Handed Over',     description: 'Final document delivered to you.' },
];

// Service-specific templates — match by a token in service.category or name.
// Most-specific match wins.
const SPECIFIC_TEMPLATES = [
  {
    match: (s) => /fssai|food/i.test(s?.name || '') || /fssai/i.test(s?.category || ''),
    stages: [
      { stage_key: 'form_filed',        label: 'Form Filed',             description: 'Form B/C filed with FSSAI portal.' },
      { stage_key: 'fbo_verification',  label: 'FBO Verification',       description: 'Designated officer reviewing application.' },
      { stage_key: 'inspection',        label: 'Field Inspection',       description: 'FSSAI inspector visit (for manufacturers only).' },
      { stage_key: 'licence_issued',    label: 'Licence Issued',         description: 'FSSAI licence number assigned.' },
      { stage_key: 'handover',          label: 'Certificate Delivered',  description: 'Printed / PDF licence handed to you.' },
    ],
  },
  {
    match: (s) => /fire\s*noc|fire/i.test(s?.name || '') || /fire/i.test(s?.category || ''),
    stages: [
      { stage_key: 'application_filed',   label: 'Application Filed',        description: 'Fire NOC application lodged.' },
      { stage_key: 'fee_paid',            label: 'Statutory Fee Paid',       description: 'Fee remitted to Fire Dept.' },
      { stage_key: 'inspection_scheduled',label: 'Inspection Scheduled',     description: 'Site inspection date confirmed.' },
      { stage_key: 'inspection_done',     label: 'Inspection Complete',      description: 'Inspection conducted; compliance report prepared.' },
      { stage_key: 'compliance',          label: 'Compliance / Remediation', description: 'Any findings addressed before NOC.' },
      { stage_key: 'noc_issued',          label: 'NOC Issued',               description: 'Fire NOC granted.' },
      { stage_key: 'handover',            label: 'NOC Handed Over',          description: 'Certified NOC delivered.' },
    ],
  },
  {
    match: (s) => /gst|goods\s*and\s*services/i.test(s?.name || '') || /gst/i.test(s?.category || ''),
    stages: [
      { stage_key: 'arn_generated',    label: 'ARN Generated',          description: 'Application Reference Number assigned by GSTN.' },
      { stage_key: 'officer_review',   label: 'Officer Review',         description: 'Jurisdictional officer reviewing application.' },
      { stage_key: 'clarification',    label: 'Clarification (if any)', description: 'Additional info requested by officer, if any.' },
      { stage_key: 'gstin_issued',     label: 'GSTIN Issued',           description: 'GST Identification Number assigned.' },
      { stage_key: 'handover',         label: 'Certificate Delivered',  description: 'GST certificate handed to you.' },
    ],
  },
  {
    match: (s) => /pollution|pcb|cto|cte/i.test(s?.name || '') || /pollution/i.test(s?.category || ''),
    stages: [
      { stage_key: 'consent_application', label: 'Consent Application',   description: 'Consent to Establish / Operate application filed.' },
      { stage_key: 'technical_review',    label: 'Technical Review',      description: 'Board reviewing EIA / technical docs.' },
      { stage_key: 'site_inspection',     label: 'Site Inspection',       description: 'Board inspector visit.' },
      { stage_key: 'public_notice',       label: 'Public Notice Period',  description: 'Statutory public notice window (if applicable).' },
      { stage_key: 'board_approval',      label: 'Board Approval',        description: 'State PCB approval granted.' },
      { stage_key: 'consent_issued',      label: 'Consent Order Issued',  description: 'Final consent order received.' },
      { stage_key: 'handover',            label: 'Order Handed Over',     description: 'Consent order delivered to you.' },
    ],
  },
  {
    match: (s) => /factory\s*licen[cs]e|factories\s*act/i.test(s?.name || ''),
    stages: [
      { stage_key: 'filing',               label: 'Application Filed',   description: 'Factory Licence application lodged.' },
      { stage_key: 'scrutiny',             label: 'Departmental Scrutiny', description: 'Officer reviewing documents.' },
      { stage_key: 'site_audit',           label: 'Site Audit',          description: 'Inspector visit for compliance audit.' },
      { stage_key: 'compliance_report',    label: 'Compliance Report',   description: 'Report prepared; any gaps flagged.' },
      { stage_key: 'fee_payment',          label: 'Licence Fee Paid',    description: 'Statutory fee remitted.' },
      { stage_key: 'licence_issued',       label: 'Licence Issued',      description: 'Factory Licence granted.' },
      { stage_key: 'handover',             label: 'Licence Handed Over', description: 'Licence delivered.' },
    ],
  },

  // ─── Rate-chart aligned templates ────────────────────────────────────
  {
    match: (s) => /trade\s*licen[cs]e/i.test(s?.name || ''),
    stages: [
      { stage_key: 'documents_collected', label: 'Documents Collected',  description: 'NOC, identity proof, and address proof received.' },
      { stage_key: 'form_filed',          label: 'Application Filed',    description: 'Filed with the municipal / panchayat authority.' },
      { stage_key: 'scrutiny',            label: 'Scrutiny in Progress', description: 'Ward officer reviewing application.' },
      { stage_key: 'fee_paid',            label: 'Fee Paid',             description: 'Statutory fee remitted.' },
      { stage_key: 'licence_issued',      label: 'Licence Issued',       description: 'Trade Licence granted.' },
      { stage_key: 'handover',            label: 'Licence Delivered',    description: 'Licence handed to you.' },
    ],
  },
  {
    match: (s) => /msme|udyam/i.test(s?.name || ''),
    stages: [
      { stage_key: 'aadhaar_verification', label: 'Aadhaar Verification', description: 'Authorised signatory Aadhaar verified on Udyam portal.' },
      { stage_key: 'details_captured',     label: 'Business Details Captured', description: 'NIC code, turnover, investment details entered.' },
      { stage_key: 'udyam_generated',      label: 'Udyam Number Issued',  description: 'Udyam Registration Number assigned.' },
      { stage_key: 'certificate_download', label: 'Certificate Downloaded', description: 'Certificate pulled from portal.' },
      { stage_key: 'handover',             label: 'Certificate Delivered', description: 'Digital certificate sent to you.' },
    ],
  },
  {
    match: (s) => /iso\s*\d+|iso\s*certif|iso-?\d+/i.test(s?.name || ''),
    stages: [
      { stage_key: 'gap_analysis',       label: 'Gap Analysis',            description: 'Current processes vs. ISO standard reviewed.' },
      { stage_key: 'documentation',      label: 'Documentation Prepared',  description: 'Manual, procedures, and SOPs drafted.' },
      { stage_key: 'pre_audit',          label: 'Pre-Audit Review',        description: 'Readiness check before the external audit.' },
      { stage_key: 'external_audit',     label: 'External Audit',          description: 'Accredited body conducts certification audit.' },
      { stage_key: 'non_conformities',   label: 'Non-Conformities Closed', description: 'Any observations addressed and resubmitted.' },
      { stage_key: 'certificate_issued', label: 'Certificate Issued',      description: 'ISO certificate granted.' },
      { stage_key: 'handover',           label: 'Certificate Delivered',   description: 'Digital + printed copy delivered.' },
    ],
  },
  {
    match: (s) => /\biec\b|import\s*export\s*code/i.test(s?.name || ''),
    stages: [
      { stage_key: 'dsc_setup',       label: 'DSC Ready',           description: 'Digital Signature Certificate verified (or procured).' },
      { stage_key: 'form_filed',      label: 'Form ANF-2A Filed',   description: 'Filed on DGFT portal.' },
      { stage_key: 'fee_paid',        label: 'Fee Paid',            description: 'Statutory fee remitted to DGFT.' },
      { stage_key: 'officer_review',  label: 'Officer Review',      description: 'DGFT officer reviewing.' },
      { stage_key: 'iec_generated',   label: 'IEC Number Issued',   description: 'Import-Export Code allotted.' },
      { stage_key: 'handover',        label: 'IEC Delivered',       description: 'Certificate sent to you.' },
    ],
  },
  {
    match: (s) => /epf|esic|provident\s*fund/i.test(s?.name || ''),
    stages: [
      { stage_key: 'inputs_received', label: 'Employee Data Received', description: 'Monthly payroll + joiners/exits received.' },
      { stage_key: 'challan_prep',    label: 'Challans Prepared',       description: 'EPF + ESIC challans computed.' },
      { stage_key: 'payment',         label: 'Payment Remitted',        description: 'Challans paid to respective accounts.' },
      { stage_key: 'ecr_filed',       label: 'ECR Filed',               description: 'Electronic Challan-cum-Return filed.' },
      { stage_key: 'acknowledgement', label: 'Acknowledgement Received', description: 'TRRN + ESIC receipt obtained.' },
    ],
  },
  {
    match: (s) => /income\s*tax\s*audit|tax\s*audit/i.test(s?.name || ''),
    stages: [
      { stage_key: 'book_review',      label: 'Books Reviewed',       description: 'Books of account examined for tax-audit readiness.' },
      { stage_key: 'audit_report',     label: 'Audit Report Drafted', description: 'Form 3CA/3CB + 3CD prepared.' },
      { stage_key: 'client_review',    label: 'Client Review',        description: 'Report shared for your sign-off.' },
      { stage_key: 'form_uploaded',    label: 'Form 3CD Uploaded',    description: 'Filed on Income Tax portal.' },
      { stage_key: 'client_accepted',  label: 'Client Accepted',      description: 'You accepted the uploaded audit on the portal.' },
    ],
  },
  {
    match: (s) => /professional\s*tax|\bpt\s*filing|\bpt\s*return/i.test(s?.name || ''),
    stages: [
      { stage_key: 'data_received', label: 'Payroll Data Received', description: 'Monthly salary slabs received.' },
      { stage_key: 'challan_prep', label: 'PT Challan Prepared',   description: 'Slab-wise PT computed.' },
      { stage_key: 'payment',      label: 'Payment Remitted',      description: 'PT paid to state treasury.' },
      { stage_key: 'return_filed', label: 'Return Filed',          description: 'PT return filed with state commercial tax department.' },
    ],
  },
  {
    match: (s) => /\bdsc\b|digital\s*signature/i.test(s?.name || ''),
    stages: [
      { stage_key: 'docs_collected',   label: 'KYC Documents Collected', description: 'Aadhaar, PAN, passport photo received.' },
      { stage_key: 'video_kyc',        label: 'Video KYC',               description: 'Applicant video verification done.' },
      { stage_key: 'token_dispatched', label: 'USB Token Dispatched',    description: 'DSC token shipped / ready for pickup.' },
      { stage_key: 'handover',         label: 'DSC Delivered',           description: 'Token delivered and tested.' },
    ],
  },
  {
    match: (s) => /gem\s*portal|gem\s*registration/i.test(s?.name || ''),
    stages: [
      { stage_key: 'primary_registration', label: 'Primary Registration', description: 'GeM account created with PAN.' },
      { stage_key: 'aadhaar_verification', label: 'Aadhaar eKYC',         description: 'Authorised person Aadhaar-verified.' },
      { stage_key: 'bank_linkage',         label: 'Bank Account Linked',  description: 'Payout bank account verified.' },
      { stage_key: 'catalog_ready',        label: 'Catalog Ready',        description: 'Product / service catalog added to seller profile.' },
      { stage_key: 'handover',             label: 'Seller Portal Ready',  description: 'Credentials + onboarding doc delivered.' },
    ],
  },
  {
    match: (s) => /safety\s*audit/i.test(s?.name || ''),
    stages: [
      { stage_key: 'site_visit',       label: 'Site Visit',             description: 'Auditor visits the premises.' },
      { stage_key: 'checklist',        label: 'Checklist Completed',    description: 'Safety checklist against statutory / ISO norms completed.' },
      { stage_key: 'findings_report',  label: 'Findings Report Drafted', description: 'Observations + risk ratings drafted.' },
      { stage_key: 'report_delivered', label: 'Assessment Report Delivered', description: 'Full report sent to you.' },
    ],
  },
  {
    match: (s) => /labour\s*law|labor\s*law/i.test(s?.name || ''),
    stages: [
      { stage_key: 'consultation',     label: 'Consultation Scheduled', description: 'Visit booked with the compliance consultant.' },
      { stage_key: 'consultation_done', label: 'Consultation Complete', description: 'On-site visit finished; findings noted.' },
      { stage_key: 'advisory',         label: 'Advisory Shared',        description: 'Written advisory + recommended next steps sent.' },
    ],
  },
];

export const getStageTemplate = (service) => {
  const match = SPECIFIC_TEMPLATES.find((t) => t.match(service));
  return match ? match.stages : GENERIC_TEMPLATE;
};
