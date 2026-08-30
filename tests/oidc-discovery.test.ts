import test from "node:test";
import assert from "node:assert/strict";
import { assertPkceS256, defaultOidcDiscoveryUrl, discoverOidcConfiguration, OidcConfigurationError } from "../services/mcp-server/src/oidc-discovery.js";

test("builds standard discovery URL",()=>assert.equal(defaultOidcDiscoveryUrl("https://issuer.example/"),"https://issuer.example/.well-known/openid-configuration"));
test("discovers matching issuer and jwks uri",async()=>{const doc=await discoverOidcConfiguration({issuer:"https://issuer.example",fetchJson:async()=>({issuer:"https://issuer.example",jwks_uri:"https://issuer.example/jwks",code_challenge_methods_supported:["S256"]})});assert.equal(doc.jwks_uri,"https://issuer.example/jwks");assertPkceS256(doc);});
test("issuer mismatch fails closed",async()=>{await assert.rejects(()=>discoverOidcConfiguration({issuer:"https://issuer.example",fetchJson:async()=>({issuer:"https://evil.example",jwks_uri:"https://evil.example/jwks"})}),(e:unknown)=>e instanceof OidcConfigurationError&&e.code==="OIDC_ISSUER_MISMATCH");});
test("provider declaring PKCE methods must support S256",()=>assert.throws(()=>assertPkceS256({issuer:"https://issuer.example",jwks_uri:"https://issuer.example/jwks",code_challenge_methods_supported:["plain"]}),(e:unknown)=>e instanceof OidcConfigurationError&&e.code==="OIDC_PKCE_S256_REQUIRED"));
