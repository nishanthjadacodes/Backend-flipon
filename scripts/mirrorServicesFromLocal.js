/**
 * One-off: mirror the `services` table from local MySQL → TiDB.
 * Reads source DB creds from CLI flags (so we don't have to swap .env).
 *
 * Usage:
 *   node scripts/mirrorServicesFromLocal.js \
 *     --src-host=localhost --src-port=3306 --src-user=root --src-password=... \
 *     --src-db=flipon_db \
 *     --dst-host=...tidbcloud.com --dst-port=4000 --dst-user=... \
 *     --dst-password=... --dst-db=flipon_db
 */

import mysql from 'mysql2/promise';

const argMap = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a, true];
  })
);

const need = (k) => {
  if (!argMap[k]) {
    console.error(`Missing --${k}`);
    process.exit(1);
  }
  return argMap[k];
};

const srcCfg = {
  host: need('src-host'),
  port: Number(argMap['src-port'] || 3306),
  user: need('src-user'),
  password: argMap['src-password'] || '',
  database: need('src-db'),
};
const dstCfg = {
  host: need('dst-host'),
  port: Number(argMap['dst-port'] || 4000),
  user: need('dst-user'),
  password: argMap['dst-password'] || '',
  database: need('dst-db'),
  ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
};

const run = async () => {
  console.log(`▶︎ source : ${srcCfg.user}@${srcCfg.host}:${srcCfg.port}/${srcCfg.database}`);
  console.log(`▶︎ dest   : ${dstCfg.user}@${dstCfg.host}:${dstCfg.port}/${dstCfg.database}`);

  const src = await mysql.createConnection(srcCfg);
  const dst = await mysql.createConnection(dstCfg);

  const [dstColsRaw] = await dst.query('SHOW COLUMNS FROM services');
  const dstCols = dstColsRaw.map((c) => c.Field);
  console.log(`✓ destination has ${dstCols.length} columns: ${dstCols.join(', ')}`);

  const [srcRows] = await src.query('SELECT * FROM services');
  console.log(`✓ source has ${srcRows.length} rows`);

  if (!srcRows.length) {
    console.warn('Nothing to mirror — source services table is empty.');
    await src.end();
    await dst.end();
    return;
  }

  console.log('🧹 Truncating destination services table…');
  await dst.query('SET SESSION foreign_key_checks = 0');
  await dst.query('DELETE FROM services');
  await dst.query('SET SESSION foreign_key_checks = 1');

  // Keep only columns that exist in destination
  const cols = Object.keys(srcRows[0]).filter((c) => dstCols.includes(c));
  const placeholders = cols.map(() => '?').join(', ');
  const insertSQL = `INSERT INTO services (${cols.join(', ')}) VALUES (${placeholders})`;

  let ok = 0;
  let fail = 0;
  for (const row of srcRows) {
    const values = cols.map((c) => {
      const v = row[c];
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        return JSON.stringify(v);
      }
      return v;
    });
    try {
      await dst.execute(insertSQL, values);
      ok += 1;
    } catch (e) {
      fail += 1;
      console.warn(`  ✗ ${row.name || row.id}: ${e.message}`);
    }
  }

  console.log(`\n✅ Inserted ${ok}/${srcRows.length} services (${fail} failed)`);
  await src.end();
  await dst.end();
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
