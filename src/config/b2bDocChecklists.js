// B2B Industrial doc checklists — per the FliponeX framework's
// "Document Checklist for Industrial Support" spec.
//
// Each list maps to a service category bucket. Customers see the right
// list on the EnquiryScreen based on which industrial service they're
// requesting; admins see the same list on the B2B Pipeline detail panel
// to verify uploads before converting to a booking.
//
// Adding a new checklist: append a key + entries here, optionally extend
// matchCategoryToChecklist() below if the new bucket needs custom regex.

export const B2B_DOC_CHECKLISTS = {
  gst: [
    { key: 'bank_statements',  label: 'Bank Statements',           required: true },
    { key: 'previous_returns', label: 'Previous Returns',          required: true },
    { key: 'dsc',              label: 'Digital Signature (DSC)',   required: true },
  ],
  noc: [
    { key: 'building_plans',         label: 'Building Plans',          required: true },
    { key: 'site_maps',              label: 'Site Maps',               required: true },
    { key: 'safety_certificates',    label: 'Safety Certificates',     required: true },
    { key: 'waste_management_plans', label: 'Waste Management Plans',  required: true },
  ],
  pollution: [
    { key: 'production_capacity_reports', label: 'Production Capacity Reports', required: true },
    { key: 'raw_material_lists',          label: 'Raw Material Lists',           required: true },
  ],
  factory_license: [
    { key: 'lease_or_ownership_deed', label: 'Lease Agreement / Ownership Deed', required: true },
    { key: 'electricity_bills',       label: 'Electricity Bills',                required: true },
    { key: 'board_resolution',        label: 'Board Resolution',                 required: true },
  ],
  iso_audit: [
    { key: 'work_process_charts',  label: 'Work Process Charts',   required: true },
    { key: 'quality_manuals',      label: 'Quality Manuals',       required: true },
    { key: 'previous_audit_trails', label: 'Previous Audit Trails', required: true },
  ],
};

// Map a free-form `service.category` string to one of the checklist keys.
// We pattern-match because the seeded categories are inconsistent
// (gst, gst_filing, noc_fire, fire_noc, pollution_control, etc.).
export const matchCategoryToChecklist = (category) => {
  const c = String(category || '').toLowerCase();
  if (!c) return null;
  if (/(gst|tax|tds|return)/.test(c)) return 'gst';
  if (/(fire|water|pollution).*(noc)|noc.*(fire|water|pollution)|^noc$|noc_/.test(c)) return 'noc';
  if (/pollution/.test(c)) return 'pollution';
  if (/(trade|factory).*licen[cs]e|licen[cs]e/.test(c)) return 'factory_license';
  if (/iso|audit|quality/.test(c)) return 'iso_audit';
  return null;
};

export const getChecklistForCategory = (category) => {
  const key = matchCategoryToChecklist(category);
  return key ? { key, items: B2B_DOC_CHECKLISTS[key] } : null;
};
