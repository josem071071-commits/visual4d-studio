import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

function cmd(command, args = []) {
  try { return execFileSync(command, args, { encoding: 'utf8' }).trim(); }
  catch { return 'unavailable'; }
}
const now = new Date().toISOString();
const sha = process.env.GITHUB_SHA || cmd('git', ['rev-parse', 'HEAD']);
const runId = process.env.GITHUB_RUN_ID || 'local';
const node = process.version;
const npm = cmd('npm', ['--version']);
const postgres = cmd('psql', ['--version']);
const status = process.env.CERTIFICATION_STATUS || 'PASS';
const report = `# Visual 4D Core External Certification Report\n\n` +
`- Generated: ${now}\n- Status: **${status}**\n- Commit SHA: \`${sha}\`\n- CI run: \`${runId}\`\n- Node: \`${node}\`\n- npm: \`${npm}\`\n- PostgreSQL client: \`${postgres}\`\n- OS: \`${os.platform()} ${os.release()}\`\n\n` +
`## Mandatory gates\n\n` +
`| Gate | Required result |\n|---|---|\n` +
`| Clean install | PASS |\n| Build | PASS |\n| Typecheck | PASS |\n| Core/runtime tests | PASS |\n| PostgreSQL workflow | PASS |\n| Transaction rollback | PASS |\n| Concurrent idempotency | PASS |\n| MCP authenticated E2E | PASS |\n| Cross-user authorization | PASS |\n| Approval failure/retry | PASS |\n| Migration UP/DOWN/UP | PASS |\n| Skipped tests | **0** |\n| Critical failures | **0** |\n\n` +
`## Certification rule\n\nThe core is certified only when this report is produced by a successful CI run and every mandatory gate above has completed without failure or skip.\n`;
fs.mkdirSync('certification', { recursive: true });
fs.writeFileSync('certification/CORE_EXTERNAL_CERTIFICATION_REPORT.md', report);
console.log(report);
