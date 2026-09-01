import { AsyncLocalStorage } from "node:async_hooks";
import { createServer, type ServerResponse } from "node:http";
import { createMcpHandler, fromJsonSchema, McpServer } from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { PostgresProjectRepository } from "../../../packages/postgres-repository/src/index.js";
import { ProjectWorkflowService } from "../../../packages/services/src/index.js";
import type { ActorContext } from "../../../packages/repositories/src/index.js";
import { PostgresApprovalGrantStore } from "./approval-grants.js";
import { registerRenderPreviewResource } from "./apps-ui.js";
import { createRenderPreviewTool } from "./render-tool.js";
import { createVisual4DToolRegistry } from "./tool-registry.js";
import { authenticateProductionBearer, ProductionAuthError, type ProductionTokenVerifier } from "./production-auth.js";
import { requiredScopesForTool } from "./tool-scope-policy.js";
import { Rs256JwksTokenVerifier } from "./production-jwt.js";
import { assertPkceS256, discoverOidcConfiguration } from "./oidc-discovery.js";
import { OAuthBroker } from "./oauth-broker.js";
import { protectedResourceMetadataUrl, visual4DBearerChallenge, visual4DProtectedResourceMetadata } from "./protected-resource-metadata.js";
import { checkProductionReadiness } from "./production-readiness.js";

export interface ProductionMcpServerOptions {
  databaseUrl:string;
  verifier:ProductionTokenVerifier;
  issuer:string;
  resourceUri:string;
  host?:string;
  port?:number;
  rateLimitPerMinute?:number;
}

const actorStorage=new AsyncLocalStorage<ActorContext>();
const SERVER_VERSION="0.4.14";

function cors(res:ServerResponse){
  res.setHeader("access-control-allow-origin","*");
  res.setHeader("access-control-allow-methods","GET, POST, OPTIONS");
  res.setHeader("access-control-allow-headers","Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id, Mcp-Method, Mcp-Name");
  res.setHeader("access-control-expose-headers","WWW-Authenticate, MCP-Session-Id, MCP-Protocol-Version, Mcp-Method, Mcp-Name");
  res.setHeader("vary","Origin");
}

function json(res:ServerResponse,status:number,body:unknown){
  cors(res);
  const data=JSON.stringify(body);
  res.statusCode=status;
  res.setHeader("content-type","application/json; charset=utf-8");
  res.setHeader("cache-control","no-store");
  res.setHeader("content-length",Buffer.byteLength(data));
  res.end(data);
}

function record(value:unknown):Record<string,unknown>|undefined{
  return value!==null&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:undefined;
}

function optionalId(value:unknown):string|undefined{
  return typeof value==="string"&&value.length>0&&value.length<=256?value:undefined;
}

function operationalContext(input:Record<string,unknown>):{requestId?:string;projectId?:string;institutionId?:string}{
  const context:{requestId?:string;projectId?:string;institutionId?:string}={};
  const requestId=optionalId(input.requestId);
  const projectId=optionalId(input.projectId);
  const institutionId=optionalId(input.institutionId);
  if(requestId!==undefined)context.requestId=requestId;
  if(projectId!==undefined)context.projectId=projectId;
  if(institutionId!==undefined)context.institutionId=institutionId;
  return context;
}

function safeErrorCode(error:unknown):string{
  const candidate=record(error)?.code;
  if(typeof candidate==="string"&&/^[A-Z0-9_:-]{1,128}$/.test(candidate))return candidate;
  const message=error instanceof Error?error.message:String(error);
  const match=/^[A-Z][A-Z0-9_]{2,127}/.exec(message);
  return match?.[0]??"TOOL_EXECUTION_ERROR";
}

function toolLog(input:{
  tool:string;
  actorUserId:string;
  outcome:"success"|"error"|"denied";
  durationMs:number;
  requestId?:string;
  projectId?:string;
  institutionId?:string;
  errorCode?:string;
}){
  console.error(`[mcp-tool] ${JSON.stringify(input)}`);
}

class MinuteRateLimiter{
  private buckets=new Map<string,{minute:number,count:number}>();
  constructor(private readonly limit:number){}
  allow(key:string){
    const minute=Math.floor(Date.now()/60000),bucket=this.buckets.get(key);
    if(!bucket||bucket.minute!==minute){this.buckets.set(key,{minute,count:1});return true;}
    if(bucket.count>=this.limit)return false;
    bucket.count++;
    return true;
  }
}

export function buildProductionMcpServer(workflow:ProjectWorkflowService,grants:PostgresApprovalGrantStore):McpServer{
  const actorProvider=()=>{
    const actor=actorStorage.getStore();
    if(!actor)throw new Error("AUTHENTICATED_ACTOR_CONTEXT_REQUIRED");
    return actor;
  };
  const defs=[
    ...createVisual4DToolRegistry(
      workflow,
      actorProvider,
      (input,action)=>grants.withClaim(
        input.token,
        {userId:input.actor.userId,projectId:input.projectId,kind:input.kind,artifactVersionId:input.artifactVersionId},
        action
      )
    ),
    createRenderPreviewTool()
  ];
  console.error(`[mcp-catalog] version=${SERVER_VERSION} toolCount=${defs.length} tools=${defs.map(def=>def.name).join(",")}`);
  const server=new McpServer(
    {name:"visual4d-production",version:SERVER_VERSION,description:"Visual 4D Studio production MCP server for structured visual-design workflows."},
    {capabilities:{tools:{},resources:{}}}
  );
  registerRenderPreviewResource(server);

  for(const def of defs){
    server.registerTool(
      def.name,
      {
        ...(def.title===undefined?{}:{title:def.title}),
        description:def.description,
        inputSchema:fromJsonSchema(def.inputSchema),
        ...(def.annotations===undefined?{}:{annotations:def.annotations}),
        ...(def._meta===undefined?{}:{_meta:def._meta})
      },
      async(args)=>{
        const actor=actorStorage.getStore();
        if(!actor)throw new Error("AUTHENTICATED_ACTOR_CONTEXT_REQUIRED");
        const input=record(args)??{};
        const context=operationalContext(input);
        const started=Date.now();
        const granted=new Set(actor.permissions??[]);
        for(const scope of requiredScopesForTool(def.name)){
          if(!granted.has(scope)){
            toolLog({tool:def.name,actorUserId:actor.userId,outcome:"denied",durationMs:Date.now()-started,...context,errorCode:"INSUFFICIENT_SCOPE"});
            return{isError:true,content:[{type:"text" as const,text:JSON.stringify({error:"INSUFFICIENT_SCOPE",required:[scope]})}]};
          }
        }
        try{
          const out=await def.execute(input);
          const structuredContent=record(out);
          toolLog({tool:def.name,actorUserId:actor.userId,outcome:"success",durationMs:Date.now()-started,...context});
          return{
            content:[{type:"text" as const,text:JSON.stringify(out)}],
            ...(structuredContent===undefined?{}:{structuredContent}),
            ...(def._meta===undefined?{}:{_meta:def._meta})
          };
        }catch(error){
          const message=error instanceof Error?error.message:String(error);
          toolLog({tool:def.name,actorUserId:actor.userId,outcome:"error",durationMs:Date.now()-started,...context,errorCode:safeErrorCode(error)});
          return{isError:true,content:[{type:"text" as const,text:JSON.stringify({error:message})}]};
        }
      }
    );
  }
  return server;
}

export function createProductionMcpHttpServer(options:ProductionMcpServerOptions){
  const repo=new PostgresProjectRepository({connectionString:options.databaseUrl});
  const workflow=new ProjectWorkflowService(repo);
  const grants=new PostgresApprovalGrantStore(repo.pool);
  const webHandler=createMcpHandler(()=>buildProductionMcpServer(workflow,grants));
  const mcpHandler=toNodeHandler(webHandler);
  const host=options.host??"127.0.0.1";
  const port=options.port??8787;
  const limiter=new MinuteRateLimiter(options.rateLimitPerMinute??120);
  const authorizationServer=new URL(options.resourceUri).origin;
  const metadata=visual4DProtectedResourceMetadata(options.resourceUri,authorizationServer);
  const broker=new OAuthBroker({issuer:options.issuer,publicOrigin:authorizationServer,scopes:metadata.scopes_supported});
  const scopedMetadataPath=new URL(protectedResourceMetadataUrl(options.resourceUri)).pathname;

  const server=createServer(async(req,res)=>{
    const rawUrl=req.url??"/";
    const requestUrl=new URL(rawUrl,`http://${req.headers.host??"localhost"}`);
    const isMetadataPath=requestUrl.pathname==="/.well-known/oauth-protected-resource"||requestUrl.pathname===scopedMetadataPath||requestUrl.pathname==="/.well-known/oauth-authorization-server";

    if(req.method==="OPTIONS"&&(isMetadataPath||requestUrl.pathname==="/mcp")){
      cors(res);res.statusCode=204;res.setHeader("access-control-max-age","86400");return res.end();
    }
    if(requestUrl.pathname==="/healthz"){
      return json(res,200,{ok:true,service:"visual4d-mcp-production",version:SERVER_VERSION});
    }
    if(requestUrl.pathname==="/readyz"){
      const readiness=await checkProductionReadiness(repo.pool);
      if(!readiness.ok){
        console.error(`[readiness] ${JSON.stringify(readiness)}`);
        res.setHeader("retry-after","5");
        return json(res,503,{ok:false,service:"visual4d-mcp-production",version:SERVER_VERSION,code:readiness.code});
      }
      return json(res,200,{...readiness,service:"visual4d-mcp-production",version:SERVER_VERSION});
    }
    if(requestUrl.pathname==="/.well-known/oauth-protected-resource"||requestUrl.pathname===scopedMetadataPath)return json(res,200,metadata);
    if(requestUrl.pathname==="/.well-known/oauth-authorization-server")return json(res,200,broker.authorizationServerMetadata());
    if(await broker.handle(req,res,requestUrl))return;
    if(requestUrl.pathname!=="/mcp")return json(res,404,{error:"NOT_FOUND"});

    let actor:ActorContext;
    try{
      actor=await authenticateProductionBearer(typeof req.headers.authorization==="string"?req.headers.authorization:undefined,options.verifier);
    }catch(error){
      cors(res);
      res.setHeader("www-authenticate",visual4DBearerChallenge(options.resourceUri));
      if(error instanceof ProductionAuthError)return json(res,error.statusCode,{error:error.code});
      return json(res,401,{error:"UNAUTHORIZED"});
    }
    if(!limiter.allow(actor.userId))return json(res,429,{error:"RATE_LIMIT_EXCEEDED"});
    cors(res);
    const request={
      method:req.method??"GET",url:rawUrl,headers:req.headers,socket:req.socket,
      on:req.on.bind(req),once:req.once.bind(req),pipe:req.pipe.bind(req),
      [Symbol.asyncIterator]:req[Symbol.asyncIterator].bind(req)
    };
    return actorStorage.run(actor,()=>mcpHandler(request,res));
  });

  return{
    server,repo,host,port,
    async listen(){
      await new Promise<void>((resolve,reject)=>{server.once("error",reject);server.listen(port,host,()=>resolve());});
      const addr=server.address(),actual=typeof addr==="object"&&addr?addr.port:port;
      return{url:`http://${host}:${actual}/mcp`,baseUrl:`http://${host}:${actual}`};
    },
    async close(){
      await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
      await repo.close();
    }
  };
}

export async function productionVerifierFromEnvironment(env:NodeJS.ProcessEnv=process.env):Promise<Rs256JwksTokenVerifier>{
  const issuer=env.VISUAL4D_OIDC_ISSUER,audience=env.VISUAL4D_OIDC_AUDIENCE;
  if(!issuer)throw new Error("VISUAL4D_OIDC_ISSUER is required");
  let jwksUri=env.VISUAL4D_OIDC_JWKS_URI;
  if(!jwksUri){
    const discovery=await discoverOidcConfiguration({issuer,...(env.VISUAL4D_OIDC_DISCOVERY_URL?{discoveryUrl:env.VISUAL4D_OIDC_DISCOVERY_URL}:{})});
    assertPkceS256(discovery);
    jwksUri=discovery.jwks_uri;
  }
  return new Rs256JwksTokenVerifier({issuer,...(audience?{audience}:{}),jwksUri});
}

if(process.argv[1]&&new URL(import.meta.url).pathname===process.argv[1]){
  const databaseUrl=process.env.DATABASE_URL,issuer=process.env.VISUAL4D_OIDC_ISSUER,resourceUri=process.env.VISUAL4D_MCP_RESOURCE_URI;
  if(!databaseUrl||!issuer||!resourceUri)throw new Error("DATABASE_URL, VISUAL4D_OIDC_ISSUER and VISUAL4D_MCP_RESOURCE_URI are required");
  const verifier=await productionVerifierFromEnvironment();
  const app=createProductionMcpHttpServer({
    databaseUrl,verifier,issuer,resourceUri,
    host:process.env.VISUAL4D_MCP_HOST??"0.0.0.0",
    port:Number(process.env.PORT??process.env.VISUAL4D_MCP_PORT??8787),
    rateLimitPerMinute:Number(process.env.VISUAL4D_RATE_LIMIT_PER_MINUTE??120)
  });
  const{baseUrl}=await app.listen();
  console.error(`Visual 4D production OAuth MCP listening at ${baseUrl}/mcp`);
}
