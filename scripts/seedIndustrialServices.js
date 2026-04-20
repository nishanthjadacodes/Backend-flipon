/**
 * Seed script: Industrial (B2B) services
 *
 * Inserts the two industrial service groups shown on the FliponeX website:
 *   1. New/Renewal Licenses, Certificates & Registrations
 *   2. Monthly / Half-Yearly / Yearly Compliances & Returns
 *
 * All rows are written with service_type = 'industrial' so the public
 * /services?type=industrial endpoint picks them up via the existing
 * serviceController filter (`service_type IN ('industrial','both')`).
 *
 * Run:  node scripts/seedIndustrialServices.js
 *
 * The script is idempotent per (name, category) via a pre-delete step.
 * Pricing and timelines are sensible placeholders — admin can tune from the
 * admin dashboard without re-running this script.
 */

import 'dotenv/config';
import mysql from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';

// ─── Standard document sets (reused across similar services) ─────────────────
const COMPANY_BASE_DOCS = [
  { type: 'company_pan', label: 'Company PAN Card', required: true },
  { type: 'gst_certificate', label: 'GST Certificate', required: false },
  { type: 'incorporation_certificate', label: 'Certificate of Incorporation / Firm Registration', required: true },
  { type: 'address_proof_business', label: 'Business Address Proof (Electricity bill / Rent agreement)', required: true },
  { type: 'owner_aadhaar', label: "Proprietor / Director Aadhaar", required: true },
  { type: 'owner_pan', label: "Proprietor / Director PAN", required: true },
  { type: 'bank_passbook', label: 'Company Bank Passbook / Cancelled Cheque', required: true },
];

const LABOUR_EXTRAS = [
  { type: 'employee_list', label: 'Employee List with details', required: true },
  { type: 'salary_register', label: 'Salary / Wage Register', required: true },
];

const RENEWAL_EXTRAS = [
  { type: 'previous_certificate', label: 'Previous Certificate / License Copy', required: true },
  { type: 'last_return_filed', label: 'Last Return Filed (if any)', required: false },
];

const ENV_EXTRAS = [
  { type: 'site_plan', label: 'Site / Factory Layout Plan', required: true },
  { type: 'machinery_list', label: 'Machinery & Raw Material List', required: true },
];

// ─── Service catalogue (source: FliponeX marketing collateral) ───────────────
const LICENSES = [
  { name: 'EPF Registration (Act 1952)', price: 4999, timeline: '15-20 working days', docs: [...COMPANY_BASE_DOCS, ...LABOUR_EXTRAS], description: 'New EPF registration under Employees Provident Fund Act, 1952.' },
  { name: 'ESI Registration (Act 1948)', price: 3999, timeline: '10-15 working days', docs: [...COMPANY_BASE_DOCS, ...LABOUR_EXTRAS], description: 'New ESI registration under Employees State Insurance Act, 1948.' },
  { name: 'Shop & Establishment Registration', price: 2499, timeline: '7-10 working days', docs: [...COMPANY_BASE_DOCS], description: 'Shops & Establishment Act registration for commercial premises.' },
  { name: 'Contract Labour License', price: 7999, timeline: '20-30 working days', docs: [...COMPANY_BASE_DOCS, ...LABOUR_EXTRAS, { type: 'principal_employer_details', label: 'Principal Employer Details', required: true }], description: 'Contract Labour (Regulation & Abolition) Act license.' },
  { name: 'Factory & Boilers License', price: 12999, timeline: '30-45 working days', docs: [...COMPANY_BASE_DOCS, ...ENV_EXTRAS, { type: 'boiler_design_drawing', label: 'Boiler Design Drawing (if applicable)', required: false }], description: 'Factory license under Factories Act, 1948 and Boilers Act.' },
  { name: 'Pollution Control Board NOC (CTE / CTO)', price: 9999, timeline: '30-45 working days', docs: [...COMPANY_BASE_DOCS, ...ENV_EXTRAS, { type: 'effluent_details', label: 'Effluent / Emission Details', required: true }], description: 'Consent to Establish (CTE) and Consent to Operate (CTO) from State Pollution Control Board.' },
  { name: 'Fire and Emergency Services NOC', price: 5999, timeline: '20-30 working days', docs: [...COMPANY_BASE_DOCS, { type: 'building_plan', label: 'Approved Building Plan', required: true }, { type: 'fire_safety_plan', label: 'Fire Safety Layout', required: true }], description: 'Fire safety NOC from State Fire & Emergency Services.' },
  { name: 'Panchayat / Municipality NOC', price: 2999, timeline: '10-15 working days', docs: [...COMPANY_BASE_DOCS, { type: 'property_tax_receipt', label: 'Property Tax Receipt', required: true }], description: 'No Objection Certificate from local Panchayat / Municipal Corporation.' },
  { name: 'FSSAI Certificate', price: 2499, timeline: '15-20 working days', docs: [...COMPANY_BASE_DOCS, { type: 'food_safety_plan', label: 'Food Safety Management Plan', required: true }], description: 'FSSAI food business license (Basic / State / Central).' },
  { name: 'Food and Drug Certificate (FSSAI / FDA)', price: 3999, timeline: '20-30 working days', docs: [...COMPANY_BASE_DOCS, { type: 'product_list', label: 'Product / Formula List', required: true }], description: 'Food & Drug Administration certification for manufacturers and distributors.' },
  { name: 'Health / Trade Health Certificate', price: 1999, timeline: '10-15 working days', docs: [...COMPANY_BASE_DOCS, { type: 'medical_fitness', label: 'Staff Medical Fitness Certificates', required: true }], description: 'Health / Trade Health certificate from local municipal health authority.' },
  { name: 'GST Registration', price: 1499, timeline: '7-10 working days', docs: [...COMPANY_BASE_DOCS], description: 'Goods & Services Tax (GSTIN) registration for business.' },
  { name: 'MSME (Udyam) Registration', price: 999, timeline: '3-5 working days', docs: [...COMPANY_BASE_DOCS], description: 'Udyam / MSME registration for micro, small and medium enterprises.' },
  { name: 'Industrial Development Corporation (IDC) Registration', price: 7999, timeline: '30-45 working days', docs: [...COMPANY_BASE_DOCS, { type: 'project_report', label: 'Project Report', required: true }], description: 'Registration / plot allotment with State Industrial Development Corporation.' },
  { name: 'Directorate of Industries, Trade & Commerce Registration', price: 4999, timeline: '20-30 working days', docs: [...COMPANY_BASE_DOCS, { type: 'project_report', label: 'Project Report', required: true }], description: 'Entrepreneur Memorandum / registration with Directorate of Industries, Trade & Commerce.' },
  { name: 'Building and Other Construction Workers (BOCW) Registration', price: 4999, timeline: '15-20 working days', docs: [...COMPANY_BASE_DOCS, ...LABOUR_EXTRAS, { type: 'construction_project_details', label: 'Construction Project Details', required: true }], description: 'Registration under the BOCW (Regulation of Employment & Conditions of Service) Act, 1996.' },
  { name: 'Inter-State Migrant Workmen (ISMW) Act 1979 Registration', price: 5999, timeline: '20-30 working days', docs: [...COMPANY_BASE_DOCS, ...LABOUR_EXTRAS, { type: 'migrant_workers_list', label: 'Inter-State Migrant Workers List', required: true }], description: 'Registration under the Inter-State Migrant Workmen Act, 1979.' },
  { name: 'Common Service Centers (CSC) Registration', price: 1999, timeline: '10-15 working days', docs: [...COMPANY_BASE_DOCS, { type: 'tec_certificate', label: 'TEC / CSC ID Certificate', required: true }], description: 'New Common Service Center (CSC) VLE registration.' },
  { name: 'Rural Authorized Person (RAP) Registration', price: 1499, timeline: '10-15 working days', docs: [...COMPANY_BASE_DOCS, { type: 'banking_correspondent_cert', label: 'Banking Correspondent Certificate', required: false }], description: 'Rural Authorized Person registration for banking / financial services in rural areas.' },
];

const COMPLIANCES = [
  { name: 'Payroll Processing (Monthly Salary Process)', price: 4999, timeline: 'Monthly', docs: [...COMPANY_BASE_DOCS, ...LABOUR_EXTRAS, { type: 'attendance_register', label: 'Monthly Attendance Register', required: true }], description: 'End-to-end monthly payroll processing, salary slips and statutory deductions.' },
  { name: 'EPF Monthly Processing & Return', price: 1999, timeline: 'Monthly (by 15th)', docs: [...COMPANY_BASE_DOCS, ...LABOUR_EXTRAS, ...RENEWAL_EXTRAS], description: 'Monthly EPF ECR filing, challan generation and payment.' },
  { name: 'ESI Monthly Processing & Return', price: 1999, timeline: 'Monthly (by 15th)', docs: [...COMPANY_BASE_DOCS, ...LABOUR_EXTRAS, ...RENEWAL_EXTRAS], description: 'Monthly ESI contribution filing and challan payment.' },
  { name: 'Shop & Establishment Registration Renewal', price: 1499, timeline: '7-10 working days', docs: [...COMPANY_BASE_DOCS, ...RENEWAL_EXTRAS], description: 'Renewal of Shops & Establishment registration.' },
  { name: 'Contract Labour Compliances & Half-Yearly Return', price: 4999, timeline: 'Half-yearly', docs: [...COMPANY_BASE_DOCS, ...LABOUR_EXTRAS, ...RENEWAL_EXTRAS], description: 'Half-yearly returns and ongoing compliance under Contract Labour Act.' },
  { name: 'Factory & Boilers Annual Returns', price: 4999, timeline: 'Annual', docs: [...COMPANY_BASE_DOCS, ...RENEWAL_EXTRAS, ...ENV_EXTRAS], description: 'Annual returns under Factories Act and Boilers Act.' },
  { name: 'Pollution Control Board Returns', price: 3999, timeline: 'Annual', docs: [...COMPANY_BASE_DOCS, ...RENEWAL_EXTRAS, ...ENV_EXTRAS], description: 'Annual environmental statement / returns to State Pollution Control Board.' },
  { name: 'Fire and Emergency Services NOC Renewal', price: 3999, timeline: '15-20 working days', docs: [...COMPANY_BASE_DOCS, ...RENEWAL_EXTRAS, { type: 'building_plan', label: 'Approved Building Plan', required: true }], description: 'Annual / periodic renewal of Fire NOC.' },
  { name: 'Food and Drug Certificate Returns', price: 2999, timeline: 'Annual', docs: [...COMPANY_BASE_DOCS, ...RENEWAL_EXTRAS, { type: 'product_list', label: 'Product / Formula List', required: true }], description: 'Annual returns / renewal under Food & Drug Administration.' },
  { name: 'FSSAI Certificate Online Renewal', price: 1999, timeline: '10-15 working days', docs: [...COMPANY_BASE_DOCS, ...RENEWAL_EXTRAS], description: 'Online renewal of FSSAI food business license.' },
  { name: 'Health Certificate Renewal', price: 1499, timeline: '7-10 working days', docs: [...COMPANY_BASE_DOCS, ...RENEWAL_EXTRAS, { type: 'medical_fitness', label: 'Staff Medical Fitness Certificates', required: true }], description: 'Renewal of trade health certificate.' },
  { name: 'GST Monthly / Quarterly Returns', price: 1499, timeline: 'Monthly / Quarterly', docs: [...COMPANY_BASE_DOCS, { type: 'sales_register', label: 'Sales Register', required: true }, { type: 'purchase_register', label: 'Purchase Register', required: true }], description: 'GSTR-1, GSTR-3B and annual GSTR-9 return filings.' },
  { name: 'MSME (Udyam) Registration Updating', price: 999, timeline: '3-5 working days', docs: [...COMPANY_BASE_DOCS, ...RENEWAL_EXTRAS], description: 'Annual Udyam / MSME registration update and ITR / GST-linked refresh.' },
  { name: 'Industrial Development Corporation (IDC) Renewal', price: 4999, timeline: '20-30 working days', docs: [...COMPANY_BASE_DOCS, ...RENEWAL_EXTRAS], description: 'Renewal / compliance filings with State Industrial Development Corporation.' },
  { name: 'Directorate of Industries, Trade & Commerce — Updating', price: 2999, timeline: '15-20 working days', docs: [...COMPANY_BASE_DOCS, ...RENEWAL_EXTRAS], description: 'Updating of registered information with Directorate of Industries, Trade & Commerce.' },
  { name: 'BOCW Half-Yearly Returns', price: 2999, timeline: 'Half-yearly', docs: [...COMPANY_BASE_DOCS, ...LABOUR_EXTRAS, ...RENEWAL_EXTRAS], description: 'Half-yearly returns under the BOCW Act.' },
  { name: 'Inter-State Migrant Workmen (ISMW) Reports', price: 3999, timeline: 'Half-yearly / Annual', docs: [...COMPANY_BASE_DOCS, ...LABOUR_EXTRAS, ...RENEWAL_EXTRAS], description: 'Periodic reports under ISMW Act for principal employers / contractors.' },
  { name: 'Common Service Centers (CSC) Updating', price: 999, timeline: '3-5 working days', docs: [...COMPANY_BASE_DOCS, ...RENEWAL_EXTRAS], description: 'Updating / renewal of Common Service Center (CSC) VLE details.' },
];

// ─── Build the final list with category + service_type pre-assigned ──────────
const buildServices = () => [
  ...LICENSES.map((s) => ({ ...s, category: 'Industrial Licenses & Registrations' })),
  ...COMPLIANCES.map((s) => ({ ...s, category: 'Industrial Compliances & Returns' })),
];

const seedIndustrialServices = async () => {
  let connection;
  try {
    console.log('🔌 Connecting to MySQL database...');

    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'Bannu@456',
      database: process.env.DB_NAME || 'flipon_db',
      multipleStatements: false,
      ssl: process.env.DB_SSL === 'true'
        ? { minVersion: 'TLSv1.2', rejectUnauthorized: true }
        : undefined,
    });

    console.log('✅ Database connected');

    // TiDB enables NO_BACKSLASH_ESCAPES by default, which rejects `\'` escapes.
    await connection.query(
      "SET SESSION sql_mode = REPLACE(@@sql_mode, 'NO_BACKSLASH_ESCAPES', '')"
    );

    const services = buildServices();
    console.log(`📝 Preparing ${services.length} industrial services…`);

    // Idempotency: remove previous rows seeded by this script (match by name + category).
    // Uses IN-list so we don't disturb any other industrial services.
    const categories = [
      'Industrial Licenses & Registrations',
      'Industrial Compliances & Returns',
    ];
    const [delResult] = await connection.query(
      'DELETE FROM services WHERE category IN (?) AND service_type = ?',
      [categories, 'industrial']
    );
    console.log(`🧹 Removed ${delResult.affectedRows} previously-seeded industrial rows (if any)`);

    // Industrial services are quote-based — no catalog price or fixed timeline.
    // Customer flow goes through Enquiry → Quote issued by b2b_admin.
    const insertSQL = `
      INSERT INTO services (
        id, name, category, service_type, pricing_model,
        required_documents, allow_pay_after, description, is_active,
        created_at, updated_at
      ) VALUES (?, ?, ?, 'industrial', 'quote', ?, ?, ?, 1, NOW(), NOW())
    `;

    let inserted = 0;
    for (const svc of services) {
      try {
        await connection.query(insertSQL, [
          uuidv4(),
          svc.name,
          svc.category,
          JSON.stringify(svc.docs),
          true, // allow_pay_after stays — agreed terms apply to the quote
          svc.description,
        ]);
        inserted += 1;
        console.log(`  ✓ ${svc.name}`);
      } catch (err) {
        console.error(`  ✗ ${svc.name} — ${err.message}`);
      }
    }

    console.log(`\n🎉 Seeded ${inserted}/${services.length} industrial services`);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exitCode = 1;
  } finally {
    if (connection) await connection.end();
  }
};

seedIndustrialServices();
