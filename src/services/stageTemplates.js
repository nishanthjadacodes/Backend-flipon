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
];

export const getStageTemplate = (service) => {
  const match = SPECIFIC_TEMPLATES.find((t) => t.match(service));
  return match ? match.stages : GENERIC_TEMPLATE;
};
