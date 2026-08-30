import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

function fail(message) {
  console.error(`RC_INVALID: ${message}`);
  process.exit(1);
}

const expected = process.env.VISUAL4D_RC_SHA?.trim();
if (!expected) fail('VISUAL4D_RC_SHA is required');
if (!/^[a-f0-9]{40}$/i.test(expected)) fail('VISUAL4D_RC_SHA must be a full 40-character Git SHA');

const actual = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (actual !== expected) fail(`checkout SHA ${actual} does not match candidate ${expected}`);

const required = [
  '.github/workflows/core-certification.yml',
  '.github/workflows/production-auth-readiness.yml',
  '.github/workflows/external-staging-certification.yml',
  '.github/workflows/publication-readiness.yml',
  'docs/release/RC_POLICY.md',
  'docs/public/SUBMISSION_EVIDENCE_INDEX.md',
  'docs/public/TOOL_REVIEW_MATRIX.md',
  'docs/public/app-manifest.public.json',
];
for (const file of required) if (!fs.existsSync(file)) fail(`required RC evidence file missing: ${file}`);

const manifest = JSON.parse(fs.readFileSync('docs/public/app-manifest.public.json', 'utf8'));
if (manifest.publication_ready === true) fail('pre-submission RC must remain fail-closed while external gates are pending');
if (manifest.authentication?.production_provider?.redirect_uri_status !== 'pending-chatgpt-callback') fail('unexpected OAuth callback state');

console.log(`RC_SHA_VALID=${actual}`);
console.log('RC_STRUCTURE_VALID=true');
console.log('RC_PUBLICATION_STATE=fail-closed');
