export class OidcConfigurationError extends Error {
  constructor(readonly code:string){super(code);this.name="OidcConfigurationError";}
}

export interface OidcDiscoveryDocument {
  issuer:string;
  jwks_uri:string;
  authorization_endpoint?:string;
  token_endpoint?:string;
  scopes_supported?:string[];
  code_challenge_methods_supported?:string[];
}

export interface OidcDiscoveryOptions {
  issuer:string;
  discoveryUrl?:string;
  fetchJson?:(url:string)=>Promise<unknown>;
}

function asRecord(value:unknown):Record<string,unknown>{if(!value||typeof value!=="object"||Array.isArray(value))throw new OidcConfigurationError("INVALID_OIDC_DISCOVERY");return value as Record<string,unknown>;}
function requiredString(record:Record<string,unknown>,key:string):string{const value=record[key];if(typeof value!=="string"||!value.trim())throw new OidcConfigurationError(`OIDC_${key.toUpperCase()}_REQUIRED`);return value;}
function optionalString(record:Record<string,unknown>,key:string):string|undefined{const value=record[key];if(value===undefined)return undefined;if(typeof value!=="string")throw new OidcConfigurationError(`INVALID_OIDC_${key.toUpperCase()}`);return value;}
function optionalStrings(record:Record<string,unknown>,key:string):string[]|undefined{const value=record[key];if(value===undefined)return undefined;if(!Array.isArray(value)||!value.every(v=>typeof v==="string"))throw new OidcConfigurationError(`INVALID_OIDC_${key.toUpperCase()}`);return value as string[];}

export function defaultOidcDiscoveryUrl(issuer:string):string {
  const normalized=issuer.endsWith("/")?issuer.slice(0,-1):issuer;
  return `${normalized}/.well-known/openid-configuration`;
}

export async function discoverOidcConfiguration(options:OidcDiscoveryOptions):Promise<OidcDiscoveryDocument>{
  const fetchJson=options.fetchJson??(async(url:string)=>{const response=await fetch(url,{headers:{accept:"application/json"}});if(!response.ok)throw new OidcConfigurationError("OIDC_DISCOVERY_FETCH_FAILED");return response.json();});
  const raw=asRecord(await fetchJson(options.discoveryUrl??defaultOidcDiscoveryUrl(options.issuer)));
  const issuer=requiredString(raw,"issuer");
  if(issuer!==options.issuer)throw new OidcConfigurationError("OIDC_ISSUER_MISMATCH");
  const jwksUri=requiredString(raw,"jwks_uri");
  const authorizationEndpoint=optionalString(raw,"authorization_endpoint"),tokenEndpoint=optionalString(raw,"token_endpoint"),scopesSupported=optionalStrings(raw,"scopes_supported"),pkce=optionalStrings(raw,"code_challenge_methods_supported");
  return {issuer,jwks_uri:jwksUri,...(authorizationEndpoint===undefined?{}:{authorization_endpoint:authorizationEndpoint}),...(tokenEndpoint===undefined?{}:{token_endpoint:tokenEndpoint}),...(scopesSupported===undefined?{}:{scopes_supported:scopesSupported}),...(pkce===undefined?{}:{code_challenge_methods_supported:pkce})};
}

export function assertPkceS256(document:OidcDiscoveryDocument):void {
  if(document.code_challenge_methods_supported&&!document.code_challenge_methods_supported.includes("S256"))throw new OidcConfigurationError("OIDC_PKCE_S256_REQUIRED");
}
