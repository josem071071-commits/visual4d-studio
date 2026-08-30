const required = ["DATABASE_URL", "VISUAL4D_OIDC_ISSUER", "VISUAL4D_OIDC_AUDIENCE"];
const missing = required.filter((key) => !process.env[key]?.trim());
if (missing.length) {
  console.error(`Production auth preflight: FAIL missing ${missing.join(", ")}`);
  process.exit(1);
}

const issuer = process.env.VISUAL4D_OIDC_ISSUER;
let issuerUrl;
try { issuerUrl = new URL(issuer); } catch { console.error("Production auth preflight: FAIL invalid VISUAL4D_OIDC_ISSUER"); process.exit(1); }
if (issuerUrl.protocol !== "https:") {
  console.error("Production auth preflight: FAIL issuer must use HTTPS");
  process.exit(1);
}

for (const key of ["VISUAL4D_OIDC_JWKS_URI", "VISUAL4D_OIDC_DISCOVERY_URL"]) {
  const value = process.env[key];
  if (!value) continue;
  let url;
  try { url = new URL(value); } catch { console.error(`Production auth preflight: FAIL invalid ${key}`); process.exit(1); }
  if (url.protocol !== "https:") { console.error(`Production auth preflight: FAIL ${key} must use HTTPS`); process.exit(1); }
}

if (process.env.VISUAL4D_ALLOW_DEV_APPROVAL_GRANTS === "true") {
  console.error("Production auth preflight: FAIL development approval grants must be disabled");
  process.exit(1);
}
if (process.env.VISUAL4D_AUTH_TOKEN) {
  console.error("Production auth preflight: FAIL staging static token must not be configured in production");
  process.exit(1);
}

console.log("Production auth preflight: PASS");
