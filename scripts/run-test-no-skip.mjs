import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
if (!args.length) {
  console.error('Usage: node scripts/run-test-no-skip.mjs <test-file> [more-test-files...]');
  process.exit(2);
}

const child = spawn(process.execPath, ['--test', ...args], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: process.env,
});
let output = '';
child.stdout.on('data', (chunk) => { const s = chunk.toString(); output += s; process.stdout.write(s); });
child.stderr.on('data', (chunk) => { const s = chunk.toString(); output += s; process.stderr.write(s); });
child.on('close', (code) => {
  const hasExplicitSkip = /(^|\n)\s*#\s*SKIP\b/i.test(output) || /(^|\n)\s*ok\s+\d+\s+-.*#\s*SKIP\b/i.test(output);
  if (code !== 0) process.exit(code ?? 1);
  if (hasExplicitSkip) {
    console.error('\nCERTIFICATION_GATE_FAILED: skipped test detected.');
    process.exit(3);
  }
  process.exit(0);
});
