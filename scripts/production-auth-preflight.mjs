const required = ["DATABASE_URL", "VISUAL4D_OIDC_ISSUER", "VISUAL4D_OIDC_AUDIENCE", "VISUAL4D_MCP_RESOURCE_URI"];
const missing = required.filter((key) => !process.env[key]?.trim());
if (missing.length) { console.error(`Production auth preflight: FAIL missing ${missing.join(", ")}`); process.exit(1); }

for (const key of ["VISUAL4D_OIDC_ISSUER", "VISUAL4D_MCP_RESOURCE_URI", "VISUAL4D_OIDC_JWKS_URI", "VISUAL4D_OIDC_DISCOVERY_URL"]) {
  const value = process.env[key]; if (!value) continue;
  let url; try { url = new URL(value); } catch { console.error(`Production auth preflight: FAIL invalid ${key}`); process.exit(1); }
  if (url.protocol !== "https:") { console.error(`Production auth preflight: FAIL ${key} must use HTTPS`); process.exit(1); }
  if (key === "VISUAL4D_MCP_RESOURCE_URI" && (url.pathname === "/" || url.search || url.hash)) { console.error("Production auth preflight: FAIL MCP resource URI must identify a path and contain no query/fragment"); process.exit(1); }
}

if (process.env.VISUAL4D_ALLOW_DEV_APPROVAL_GRANTS === "true") { console.error("Production auth preflight: FAIL development approval grants must be disabled"); process.exit(1); }
if (process.env.VISUAL4D_AUTH_TOKEN) { console.error("Production auth preflight: FAIL staging static token must not be configured in production"); process.exit(1); }
console.log("Production auth preflight: PASS");
