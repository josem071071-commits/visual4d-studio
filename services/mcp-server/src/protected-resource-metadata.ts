import { VISUAL4D_PRODUCTION_SCOPES } from "./production-auth.js";

export interface Visual4DProtectedResourceMetadata {
  resource:string;
  authorization_servers:string[];
  scopes_supported:string[];
  bearer_methods_supported:string[];
}

export function canonicalMcpResourceUri(value:string):string {
  let url:URL;
  try{url=new URL(value);}catch{throw new Error("INVALID_MCP_RESOURCE_URI");}
  if(url.protocol!=="https:")throw new Error("MCP_RESOURCE_URI_HTTPS_REQUIRED");
  if(url.search||url.hash)throw new Error("MCP_RESOURCE_URI_QUERY_FRAGMENT_FORBIDDEN");
  if(url.pathname==="/")throw new Error("MCP_RESOURCE_URI_PATH_REQUIRED");
  url.pathname=url.pathname.replace(/\/+$/g,"");
  return url.toString();
}

export function protectedResourceMetadataUrl(resourceUri:string):string {
  const resource=new URL(canonicalMcpResourceUri(resourceUri));
  const resourcePath=resource.pathname.replace(/^\//,"");
  return `${resource.origin}/.well-known/oauth-protected-resource/${resourcePath}`;
}

export function visual4DProtectedResourceMetadata(resourceUri:string,issuer:string):Visual4DProtectedResourceMetadata {
  const resource=canonicalMcpResourceUri(resourceUri);
  const issuerUrl=new URL(issuer);
  if(issuerUrl.protocol!=="https:")throw new Error("OIDC_ISSUER_HTTPS_REQUIRED");
  return {resource,authorization_servers:[issuer],scopes_supported:[...VISUAL4D_PRODUCTION_SCOPES],bearer_methods_supported:["header"]};
}

export function visual4DBearerChallenge(resourceUri:string):string {
  return `Bearer resource_metadata="${protectedResourceMetadataUrl(resourceUri)}"`;
}
