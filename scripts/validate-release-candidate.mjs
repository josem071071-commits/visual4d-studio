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
if (manifest.status !== 'production-candidate') fail('manifest status must be production-candidate');
if (manifest.publication_ready === true) fail('pre-submission RC must remain fail-closed while external publication gates are pending');
if (manifest.authentication?.production_ready !== true) fail('production authentication must be marked ready');
if (manifest.authentication?.production_provider?.redirect_uri_status !== 'chatgpt-operational') fail('OAuth callback must be chatgpt-operational');

const endpoint = manifest.integration?.production_endpoint;
if (typeof endpoint !== 'string' || !endpoint.startsWith('https://') || !endpoint.endsWith('/mcp')) {
  fail('production MCP endpoint must be canonical HTTPS /mcp');
}

const requiredScopes = ['visual4d:read','visual4d:render','visual4d:write','visual4d:approve','visual4d:identity'];
const advertised = new Set(manifest.authentication?.production_provider?.custom_scopes_advertised ?? []);
for (const scope of requiredScopes) if (!advertised.has(scope)) fail(`missing advertised production scope: ${scope}`);

console.log(`RC_SHA_VALID=${actual}`);
console.log('RC_STRUCTURE_VALID=true');
console.log('RC_OAUTH_STATE=chatgpt-operational');
console.log('RC_PRODUCTION_ENDPOINT_VALID=true');
console.log('RC_PUBLICATION_STATE=fail-closed');
