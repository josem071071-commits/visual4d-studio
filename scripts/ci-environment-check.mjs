import { spawnSync } from 'node:child_process';

const required = ['VISUAL4D_TEST_DATABASE_URL', 'VISUAL4D_CERTIFICATION_ALLOW_SCHEMA_RESET'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing required certification environment: ${missing.join(', ')}`);
  process.exit(1);
}
if (process.env.VISUAL4D_CERTIFICATION_ALLOW_SCHEMA_RESET !== 'true') {
  console.error('VISUAL4D_CERTIFICATION_ALLOW_SCHEMA_RESET must be true in isolated CI only.');
  process.exit(1);
}
const psql = spawnSync('psql', ['--version'], { encoding: 'utf8' });
if (psql.status !== 0) {
  console.error('psql client is required for migration certification.');
  process.exit(1);
}
console.log(`Node ${process.version}`);
console.log(psql.stdout.trim());
console.log('Certification environment: PASS');
