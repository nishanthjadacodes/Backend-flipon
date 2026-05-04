// Updates Aadhaar + PAN service rows to match the official Rate Chart.
//
// Run with:  node scripts/update-rate-chart.js
//
// Idempotent — re-running just rewrites the same values. Matches services
// by name (case-insensitive) so reseeding services with slightly different
// names still picks them up. Logs each row updated / skipped.

import 'dotenv/config';
import { sequelize } from '../src/models/index.js';

// Per the rate chart image:
//   user_cost           = price the customer sees / pays
//   govt_fees           = government portion (statutory)
//   partner_earning     = the rep's commission for the visit
//   total_expense       = govt_fees + partner_earning (FliponeX's outflow)
//   company_margin      = user_cost - total_expense (FliponeX's profit)
//   expected_timeline   = display string shown on the service detail page
//
// Match keys are case-insensitive substrings against service.name.
const AADHAAR_ROWS = [
  { match: 'new aadhaar enrolment',       user_cost: 200, govt_fees:  0, partner_earning: 100, total_expense: 100, company_margin: 100, expected_timeline: '1 week'  },
  { match: 'name update',                  user_cost: 275, govt_fees: 75, partner_earning: 100, total_expense: 175, company_margin: 100, expected_timeline: '2 weeks' },
  { match: 'husband name update',          user_cost: 275, govt_fees: 75, partner_earning: 100, total_expense: 175, company_margin: 100, expected_timeline: '3 weeks' },
  { match: 'address update',               user_cost: 275, govt_fees: 75, partner_earning: 100, total_expense: 175, company_margin: 100, expected_timeline: '4 weeks' },
  { match: 'date of birth update',         user_cost: 275, govt_fees: 75, partner_earning: 100, total_expense: 175, company_margin: 100, expected_timeline: '5 weeks' },
  { match: 'gender update',                user_cost: 275, govt_fees: 75, partner_earning: 100, total_expense: 175, company_margin: 100, expected_timeline: '6 weeks' },
  { match: 'biometric',                    user_cost: 275, govt_fees: 75, partner_earning: 100, total_expense: 175, company_margin: 100, expected_timeline: '7 weeks' },
  { match: 'mobile no. update',            user_cost: 275, govt_fees: 75, partner_earning: 100, total_expense: 175, company_margin: 100, expected_timeline: '8 weeks' },
  { match: 'email id update',              user_cost: 275, govt_fees: 75, partner_earning: 100, total_expense: 175, company_margin: 100, expected_timeline: '9 weeks' },
  { match: 'order aadhaar pvc card',       user_cost: 275, govt_fees: 75, partner_earning: 100, total_expense: 175, company_margin: 100, expected_timeline: '10 weeks' },
  { match: 'download aadhaar',             user_cost: 275, govt_fees: 75, partner_earning: 100, total_expense: 175, company_margin: 100, expected_timeline: '11 weeks' },
  { match: 'verify email/mobile number',   user_cost: 275, govt_fees: 75, partner_earning: 100, total_expense: 175, company_margin: 100, expected_timeline: '12 weeks' },
];

const PAN_ROWS = [
  { match: 'new pan',                user_cost:  220, govt_fees:  107, partner_earning: 75, total_expense:  182, company_margin: 38, expected_timeline: '24–48 hrs' },
  { match: 'name update',            user_cost:  220, govt_fees:  107, partner_earning: 75, total_expense:  182, company_margin: 38, expected_timeline: '48–72 hrs' },
  { match: 'address update',         user_cost:  220, govt_fees:  107, partner_earning: 75, total_expense:  182, company_margin: 38, expected_timeline: '48–72 hrs' },
  { match: 'date of birth update',   user_cost:  220, govt_fees:  107, partner_earning: 75, total_expense:  182, company_margin: 38, expected_timeline: '48–72 hrs' },
  { match: 'gender update',          user_cost:  220, govt_fees:  107, partner_earning: 75, total_expense:  182, company_margin: 38, expected_timeline: '48–72 hrs' },
  { match: 'mobile no. update',      user_cost:  220, govt_fees:  107, partner_earning: 75, total_expense:  182, company_margin: 38, expected_timeline: '48–72 hrs' },
  { match: 'email id update',        user_cost:  220, govt_fees:  107, partner_earning: 75, total_expense:  182, company_margin: 38, expected_timeline: '48–72 hrs' },
  { match: 'order pan pvc card',     user_cost:  220, govt_fees:  107, partner_earning: 75, total_expense:  182, company_margin: 38, expected_timeline: '48–72 hrs' },
  { match: 'download pan',           user_cost:  220, govt_fees:  107, partner_earning: 75, total_expense:  182, company_margin: 38, expected_timeline: '48–72 hrs' },
  { match: 'verify email/mobile',    user_cost:  220, govt_fees:  107, partner_earning: 75, total_expense:  182, company_margin: 38, expected_timeline: '48–72 hrs' },
  { match: 'link pan to aadhaar',    user_cost: 1100, govt_fees: 1000, partner_earning: 75, total_expense: 1075, company_margin: 25, expected_timeline: '48–72 hrs' },
];

// Voter ID services — all share the same row per the rate chart.
const VOTER_ID_ROWS = [
  { match: 'new voter apply',          user_cost: 150, govt_fees: 0, partner_earning: 100, total_expense: 100, company_margin: 50, expected_timeline: '10–15 Days' },
  { match: 'name update',              user_cost: 150, govt_fees: 0, partner_earning: 100, total_expense: 100, company_margin: 50, expected_timeline: '10–15 Days' },
  { match: 'address update',           user_cost: 150, govt_fees: 0, partner_earning: 100, total_expense: 100, company_margin: 50, expected_timeline: '10–15 Days' },
  { match: 'date of birth update',     user_cost: 150, govt_fees: 0, partner_earning: 100, total_expense: 100, company_margin: 50, expected_timeline: '10–15 Days' },
  { match: 'gender update',            user_cost: 150, govt_fees: 0, partner_earning: 100, total_expense: 100, company_margin: 50, expected_timeline: '10–15 Days' },
  { match: 'mobile no. update',        user_cost: 150, govt_fees: 0, partner_earning: 100, total_expense: 100, company_margin: 50, expected_timeline: '10–15 Days' },
  { match: 'email id update',          user_cost: 150, govt_fees: 0, partner_earning: 100, total_expense: 100, company_margin: 50, expected_timeline: '10–15 Days' },
  { match: 'order voter id pvc',       user_cost: 150, govt_fees: 0, partner_earning: 100, total_expense: 100, company_margin: 50, expected_timeline: '10–15 Days' },
  { match: 'download voter id',        user_cost: 150, govt_fees: 0, partner_earning: 100, total_expense: 100, company_margin: 50, expected_timeline: '10–15 Days' },
  { match: 'verify email/mobile',      user_cost: 150, govt_fees: 0, partner_earning: 100, total_expense: 100, company_margin: 50, expected_timeline: '10–15 Days' },
];

// Ration Card services — all share the same row per the rate chart.
const RATION_CARD_ROWS = [
  { match: 'new ration card apply',         user_cost: 150, govt_fees: 0, partner_earning: 100, total_expense: 100, company_margin: 50, expected_timeline: '20–30 Days' },
  { match: 'name update',                   user_cost: 150, govt_fees: 0, partner_earning: 100, total_expense: 100, company_margin: 50, expected_timeline: '20–30 Days' },
  { match: 'address update',                user_cost: 150, govt_fees: 0, partner_earning: 100, total_expense: 100, company_margin: 50, expected_timeline: '20–30 Days' },
  { match: 'date of birth update',          user_cost: 150, govt_fees: 0, partner_earning: 100, total_expense: 100, company_margin: 50, expected_timeline: '20–30 Days' },
  { match: 'gender update',                 user_cost: 150, govt_fees: 0, partner_earning: 100, total_expense: 100, company_margin: 50, expected_timeline: '20–30 Days' },
  { match: 'mobile no. update',             user_cost: 150, govt_fees: 0, partner_earning: 100, total_expense: 100, company_margin: 50, expected_timeline: '20–30 Days' },
  { match: 'email id update',               user_cost: 150, govt_fees: 0, partner_earning: 100, total_expense: 100, company_margin: 50, expected_timeline: '20–30 Days' },
  { match: 'family member',                 user_cost: 150, govt_fees: 0, partner_earning: 100, total_expense: 100, company_margin: 50, expected_timeline: '20–30 Days' },
  { match: 'download ration card',          user_cost: 150, govt_fees: 0, partner_earning: 100, total_expense: 100, company_margin: 50, expected_timeline: '20–30 Days' },
  { match: 'verify email/mobile',           user_cost: 150, govt_fees: 0, partner_earning: 100, total_expense: 100, company_margin: 50, expected_timeline: '20–30 Days' },
];

// Apply a row to all services whose name contains the match string AND
// whose category matches one of the `categoryAliases`.
//
// Uses raw SQL deliberately — the Service model declares columns
// (indicative_price_from, pricing_unit, etc.) that don't exist on the
// deployed DB yet, so Service.findAll() crashes with "Unknown column".
// Raw UPDATE only touches the six columns we actually need to set.
const applyRow = async (row, categoryAliases) => {
  const aliasList = Array.isArray(categoryAliases) ? categoryAliases : [categoryAliases];

  // Look up matching rows ourselves so we can log which services we touched.
  const categoryClause = aliasList.map(() => 'LOWER(category) LIKE ?').join(' OR ');
  const findParams = [
    ...aliasList.map((a) => `%${a.toLowerCase()}%`),
    `%${row.match.toLowerCase()}%`,
  ];
  const [matches] = await sequelize.query(
    `SELECT id, name FROM services WHERE (${categoryClause}) AND LOWER(name) LIKE ?`,
    { replacements: findParams },
  );

  if (matches.length === 0) {
    console.log(`   ⚠ no service matched "${row.match}" in category "${aliasList[0]}"`);
    return 0;
  }

  // Atomic UPDATE — single statement, no model layer involved.
  const ids = matches.map((m) => m.id);
  const placeholders = ids.map(() => '?').join(', ');
  await sequelize.query(
    `UPDATE services
     SET user_cost = ?, govt_fees = ?, partner_earning = ?,
         total_expense = ?, company_margin = ?, expected_timeline = ?
     WHERE id IN (${placeholders})`,
    {
      replacements: [
        row.user_cost,
        row.govt_fees,
        row.partner_earning,
        row.total_expense,
        row.company_margin,
        row.expected_timeline,
        ...ids,
      ],
    },
  );

  for (const m of matches) {
    console.log(`   ✓ ${String(m.name).padEnd(40)} → ₹${row.user_cost} (${row.expected_timeline})`);
  }
  return matches.length;
};

const run = async () => {
  await sequelize.authenticate();
  console.log('✅ DB connected');

  const sections = [
    { label: 'Aadhaar',     rows: AADHAAR_ROWS,     aliases: ['aadhaar', 'aadhar'] },
    { label: 'PAN',         rows: PAN_ROWS,         aliases: ['pan'] },
    { label: 'Voter ID',    rows: VOTER_ID_ROWS,    aliases: ['voter_id', 'voter-id', 'voterid', 'voter id', 'epic'] },
    { label: 'Ration Card', rows: RATION_CARD_ROWS, aliases: ['ration_card', 'ration-card', 'rationcard', 'ration card', 'pds'] },
  ];

  for (const section of sections) {
    console.log(`\n── ${section.label} services ───────────────────────────────`);
    let total = 0;
    for (const row of section.rows) {
      total += await applyRow(row, section.aliases);
    }
    console.log(`updated ${total} ${section.label} service row(s)`);
  }

  console.log('\n🎉 Rate chart applied. Booking flow will now show correct prices.');
  process.exit(0);
};

run().catch((e) => {
  console.error('❌ update-rate-chart failed:', e);
  process.exit(1);
});
