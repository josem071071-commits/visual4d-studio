import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'docs/public/app-manifest.public.json');
const requiredFiles = [
  'docs/public/PRIVACY_POLICY.md',
  'docs/public/TERMS_OF_SERVICE.md',
  'docs/public/SECURITY.md',
  'docs/public/SUBMISSION_CHECKLIST.md',
  'docs/public/APP_REGISTRATION_PACKAGE.md',
  'docs/public/PUBLICATION_READINESS.md',
  'docs/public/TOOL_REVIEW_MATRIX.md',
  'docs/public/SUBMISSION_EVIDENCE_INDEX.md',
];

function fail(message) {
  console.error(`PUBLICATION_PACKAGE_INVALID: ${message}`);
  process.exitCode = 1;
}

for (const file of requiredFiles) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) fail(`missing required file: ${file}`);
  else if (fs.statSync(full).size < 200) fail(`required file is unexpectedly small: ${file}`);
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
} catch (error) {
  fail(`manifest cannot be parsed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit();
}

if (manifest.schema_version !== 'visual4d.public-app-metadata.v1') fail('unexpected schema_version');
if (manifest.name !== 'Visual 4D Studio') fail('official app name changed unexpectedly');
if (manifest.short_name !== 'Visual 4D') fail('short name changed unexpectedly');
if (!manifest.description || manifest.description.length < 80) fail('description is too short');
if (manifest.integration?.protocol !== 'MCP') fail('integration protocol must be MCP');
if (manifest.integration?.apps_sdk_ui !== true) fail('Apps SDK UI must remain enabled');
if (!Array.isArray(manifest.tools) || !manifest.tools.some((tool) => tool.name === 'generation.render_preview')) fail('generation.render_preview must be declared');
if (manifest.authentication?.staging !== 'static-bearer-test-only') fail('staging authentication boundary changed');
if (manifest.authentication?.production_target !== 'oauth2.1-oidc-authorization-code-pkce') fail('production auth target must remain OAuth/OIDC + PKCE');
if (manifest.authentication?.production_provider?.name !== 'Clerk') fail('configured production provider candidate must be Clerk');
if (manifest.authentication?.production_provider?.environment !== 'development') fail('Clerk configuration must remain marked development until promoted');
if (manifest.authentication?.production_provider?.redirect_uri_status !== 'pending-chatgpt-callback') fail('redirect URI status must remain explicit while unresolved');

const scopePolicy = fs.readFileSync(path.join(root, 'services/mcp-server/src/tool-scope-policy.ts'), 'utf8');
const reviewMatrix = fs.readFileSync(path.join(root, 'docs/public/TOOL_REVIEW_MATRIX.md'), 'utf8');
for (const tool of ['generation.render_preview','method.analyze','method.structure','method.resolve_resources','method.art_direct','generation.create_design','verification.save','versions.mark_final','approvals.approve_stage','identity.activate_version']) {
  if (!scopePolicy.includes(`"${tool}"`)) fail(`production scope policy missing tool: ${tool}`);
  if (!reviewMatrix.includes(`\`${tool}\``)) fail(`tool review matrix missing tool: ${tool}`);
}
for (const scope of ['visual4d:render','visual4d:write','visual4d:approve','visual4d:identity']) {
  if (!reviewMatrix.includes(`\`${scope}\``)) fail(`tool review matrix missing scope: ${scope}`);
}

const forbiddenProductionEndpoint = manifest.integration?.staging_endpoint;
if (manifest.integration?.production_endpoint && manifest.integration.production_endpoint === forbiddenProductionEndpoint) {
  fail('staging endpoint must not be reused as production endpoint');
}

if (manifest.publication_ready === true) {
  const requiredUrls = ['privacy_url', 'terms_url', 'support_url', 'security_url'];
  for (const key of requiredUrls) {
    const value = manifest.legal?.[key];
    if (typeof value !== 'string' || !value.startsWith('https://')) fail(`${key} must be a stable HTTPS URL before publication_ready=true`);
  }
  if (!manifest.integration?.production_endpoint?.startsWith('https://')) fail('production_endpoint must be HTTPS before publication_ready=true');
  if (manifest.authentication?.production_ready !== true) fail('production authentication must be ready before publication_ready=true');
  if (!manifest.legal?.operator) fail('legal operator must be set before publication_ready=true');
  if (!manifest.legal?.jurisdiction) fail('jurisdiction must be set before publication_ready=true');
  if (manifest.branding?.icon_status !== 'approved') fail('icon must be approved before publication_ready=true');
  if (manifest.branding?.wordmark_status !== 'approved') fail('wordmark must be approved before publication_ready=true');
}

if (!process.exitCode) {
  console.log('PUBLICATION_PACKAGE_VALID: pre-publication package is internally consistent.');
  console.log('TOOL_REVIEW_MATRIX_VALID: documented review surface matches the required production tool set.');
  console.log(`publication_ready=${manifest.publication_ready === true}`);
}
