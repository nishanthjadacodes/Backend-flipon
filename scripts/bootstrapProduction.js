/**
 * One-shot production bootstrap.
 *
 * Runs every schema migration + seed the app needs in the right order.
 * Safe to re-run — each individual script is idempotent.
 *
 * Usage (from project root):
 *   node scripts/bootstrapProduction.js
 *
 * Or via npm:
 *   npm run bootstrap:prod
 */

import 'dotenv/config';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const steps = [
  // 1. Migrations (schema)
  'migrateAdminSchema.js',
  'migrateServiceTypes.js',       // normalise legacy service_type values
  'migrateIndustrialToQuote.js',  // add pricing_model + flip industrial -> quote
  'migrateB2BSchema.js',          // users.nda_accepted_at + company_profiles
  'migrateEnquirySchema.js',      // enquiries table
  // 2. Seeds (data)
  'seedAdminRoles.js',
  'seedSuperAdmin.js',
  'seedAllServicesSQL.js',        // baseline consumer services
  'seedIndustrialServices.js',    // 37 industrial (quote) services
];

let failed = 0;
for (const s of steps) {
  const file = path.join(__dirname, s);
  console.log(`\n▶︎ ${s}`);
  const res = spawnSync('node', [file], { stdio: 'inherit' });
  if (res.status !== 0) {
    failed += 1;
    console.warn(`   ✗ ${s} exited with code ${res.status} — continuing`);
  }
}

console.log(
  failed
    ? `\n⚠️  Bootstrap finished with ${failed} failing step(s). Review the logs above.`
    : '\n✅ Bootstrap finished cleanly.'
);
process.exit(failed ? 1 : 0);
