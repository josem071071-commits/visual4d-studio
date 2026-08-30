import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = ['index.html','privacy.html','terms.html','support.html','security.html','styles.css','_redirects'];
const fail = (m) => { console.error(`PUBLIC_WEBSITE_INVALID: ${m}`); process.exitCode = 1; };
for (const f of required) {
  const p = path.join(root,'website',f);
  if (!fs.existsSync(p)) fail(`missing website/${f}`);
  else if (fs.statSync(p).size < 20) fail(`website/${f} is unexpectedly small`);
}
const pages = ['index.html','privacy.html','terms.html','support.html','security.html'];
for (const f of pages) {
  const html = fs.readFileSync(path.join(root,'website',f),'utf8');
  if (!html.includes('Visual 4D Studio')) fail(`${f} missing official product name`);
  if (!html.includes('viewport')) fail(`${f} missing responsive viewport`);
  if (!html.includes('/styles.css')) fail(`${f} missing shared stylesheet`);
}
const privacy = fs.readFileSync(path.join(root,'website/privacy.html'),'utf8');
for (const term of ['Jose Guerrero','Estados Unidos','Florida','Josem071071@gmail.com']) if (!privacy.includes(term)) fail(`privacy page missing ${term}`);
const terms = fs.readFileSync(path.join(root,'website/terms.html'),'utf8');
for (const term of ['Estado de Florida','Miami-Dade County','Jose Guerrero']) if (!terms.includes(term)) fail(`terms page missing ${term}`);
const support = fs.readFileSync(path.join(root,'website/support.html'),'utf8');
if (!support.includes('Josem071071@gmail.com')) fail('support email missing');
const security = fs.readFileSync(path.join(root,'website/security.html'),'utf8');
for (const term of ['OAuth 2.1/OIDC','privilegio mínimo','SECURITY']) if (!security.includes(term)) fail(`security page missing ${term}`);
const redirects = fs.readFileSync(path.join(root,'website/_redirects'),'utf8');
for (const route of ['/privacy ','/terms ','/support ','/security ']) if (!redirects.includes(route)) fail(`redirect missing ${route.trim()}`);
if (!process.exitCode) console.log('PUBLIC_WEBSITE_VALID=true');
