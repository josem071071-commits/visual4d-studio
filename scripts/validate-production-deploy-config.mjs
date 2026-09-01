import fs from 'node:fs';

const railway = JSON.parse(fs.readFileSync('railway.json', 'utf8'));
const dockerfilePath = railway?.build?.dockerfilePath;
if (dockerfilePath !== 'Dockerfile.production') {
  throw new Error(`RAILWAY_PRODUCTION_DOCKERFILE_INVALID:${String(dockerfilePath)}`);
}

const dockerfile = fs.readFileSync('Dockerfile.production', 'utf8');
for (const required of [
  'COPY database ./database',
  'ensure-production-schema.js',
  'production-auth-preflight.mjs',
  'production-server.js'
]) {
  if (!dockerfile.includes(required)) throw new Error(`PRODUCTION_DOCKERFILE_MISSING:${required}`);
}

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const start = packageJson?.scripts?.['start:mcp:production'] ?? '';
if (!start.includes('ensure-production-schema.js') || !start.includes('production-server.js')) {
  throw new Error(`PRODUCTION_START_COMMAND_INVALID:${start}`);
}

console.log('PRODUCTION_DEPLOY_CONFIG_VALID=true');
