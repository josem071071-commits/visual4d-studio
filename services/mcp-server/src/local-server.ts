import { AsyncLocalStorage } from "node:async_hooks";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createMcpHandler, fromJsonSchema, McpServer } from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { PostgresProjectRepository } from "../../../packages/postgres-repository/src/index.js";
import { ProjectWorkflowService } from "../../../packages/services/src/index.js";
import type { ActorContext, ArtifactKind } from "../../../packages/repositories/src/index.js";
import { PostgresApprovalGrantStore } from "./approval-grants.js";
import { actorFromRequest, type LocalAuthConfig, LocalAuthError } from "./local-auth.js";
import { createVisual4DToolRegistry } from "./tool-registry.js";

export interface LocalMcpServerOptions {
  databaseUrl: string;
  auth: LocalAuthConfig;
  host?: string;
  port?: number;
  approvalGrantTtlMs?: number;
  allowDevApprovalGrants?: boolean;
  maxBodyBytes?: number;
  requestTimeoutMs?: number;
  rateLimitPerMinute?: number;
}

const actorStorage = new AsyncLocalStorage<ActorContext>();

async function readJson(req:IncomingMessage,maxBytes=64*1024,timeoutMs=10_000):Promise<Record<string,unknown>> {
  const chunks:Buffer[]=[];let total=0;
  const timer=setTimeout(()=>req.destroy(new Error("REQUEST_TIMEOUT")),timeoutMs);
  try{
    for await(const c of req){const b=Buffer.isBuffer(c)?c:Buffer.from(c);total+=b.length;if(total>maxBytes)throw new Error("REQUEST_BODY_TOO_LARGE");chunks.push(b);}
  }finally{clearTimeout(timer);}
  if(chunks.length===0)return{};
  const parsed=JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw new Error("JSON_OBJECT_REQUIRED");
  return parsed as Record<string,unknown>;
}
function json(res:ServerResponse,status:number,body:unknown){const b=JSON.stringify(body);res.statusCode=status;res.setHeader("content-type","application/json; charset=utf-8");res.setHeader("content-length",Buffer.byteLength(b));res.end(b);}

class MinuteRateLimiter{
  private buckets=new Map<string,{minute:number,count:number}>();
  constructor(private readonly limit:number){}
  allow(key:string){const minute=Math.floor(Date.now()/60_000),b=this.buckets.get(key);if(!b||b.minute!==minute){this.buckets.set(key,{minute,count:1});return true;}if(b.count>=this.limit)return false;b.count++;return true;}
}

export function buildMcpServer(workflow:ProjectWorkflowService, grants:PostgresApprovalGrantStore):McpServer {
  const actorProvider=()=>{const actor=actorStorage.getStore();if(!actor)throw new Error("AUTHENTICATED_ACTOR_CONTEXT_REQUIRED");return actor;};
  const defs=createVisual4DToolRegistry(workflow,actorProvider,(input,action)=>grants.withClaim(input.token,{userId:input.actor.userId,projectId:input.projectId,kind:input.kind,artifactVersionId:input.artifactVersionId},action));
  const server=new McpServer({name:"visual4d-local",version:"0.2.3"},{capabilities:{tools:{}}});
  for(const def of defs){
    server.registerTool(def.name,{description:def.description,inputSchema:fromJsonSchema(def.inputSchema),annotations:def.annotations},async(args)=>{
      try{const out=await def.execute(args as Record<string,unknown>);return{content:[{type:"text" as const,text:JSON.stringify(out)}]};}
      catch(error){const message=error instanceof Error?error.message:String(error);return{isError:true,content:[{type:"text" as const,text:JSON.stringify({error:message})}]};}
    });
  }
  return server;
}

export function createLocalMcpHttpServer(options:LocalMcpServerOptions){
  const repo=new PostgresProjectRepository({connectionString:options.databaseUrl});
  const workflow=new ProjectWorkflowService(repo);
  const grants=new PostgresApprovalGrantStore(repo.pool);
  const webHandler=createMcpHandler(()=>buildMcpServer(workflow,grants));
  const mcpHandler=toNodeHandler(webHandler);
  const host=options.host??"127.0.0.1",port=options.port??8787;
  const limiter=new MinuteRateLimiter(options.rateLimitPerMinute??120);

  const server=createServer(async(req,res)=>{
    if(req.url==="/healthz")return json(res,200,{ok:true,service:"visual4d-mcp-local",version:"0.2.3"});
    let actor:ActorContext;
    try{actor=actorFromRequest(req,options.auth);}catch(e){if(e instanceof LocalAuthError){res.setHeader("www-authenticate",'Bearer realm="visual4d-local"');return json(res,e.statusCode,{error:e.code});}return json(res,401,{error:"UNAUTHORIZED"});}
    if(!limiter.allow(actor.userId))return json(res,429,{error:"RATE_LIMIT_EXCEEDED"});

    if(req.url==="/local/approval-grants"&&req.method==="POST"){
      // Development-only bridge. Production must bind grants to an authenticated UI action, not this header.
      if(options.allowDevApprovalGrants!==true)return json(res,404,{error:"NOT_FOUND"});
      if(req.headers["x-visual4d-dev-user-action"]!=="approve")return json(res,403,{error:"EXPLICIT_DEV_USER_ACTION_REQUIRED"});
      try{
        const body=await readJson(req,options.maxBodyBytes,options.requestTimeoutMs),projectId=body.projectId,kind=body.kind,artifactVersionId=body.artifactVersionId;
        const kinds:ArtifactKind[]=["ANALYSIS","STRUCTURE","RESOURCES","ART_DIRECTION","VERIFICATION"];
        if(typeof projectId!=="string"||typeof kind!=="string"||!kinds.includes(kind as ArtifactKind)||typeof artifactVersionId!=="string")return json(res,400,{error:"INVALID_APPROVAL_GRANT_REQUEST"});
        await workflow.validateApprovalCandidate(projectId,kind as ArtifactKind,artifactVersionId,actor);
        const token=await grants.issue({userId:actor.userId,projectId,kind:kind as ArtifactKind,artifactVersionId},options.approvalGrantTtlMs);
        return json(res,201,{approvalGrant:token,expiresInMs:options.approvalGrantTtlMs??300000,devOnly:true});
      }catch(e){const message=e instanceof Error?e.message:String(e);return json(res,message.includes("FORBIDDEN")?403:400,{error:message});}
    }

    if(req.url!=="/mcp")return json(res,404,{error:"NOT_FOUND"});
    return actorStorage.run(actor,()=>mcpHandler(req,res));
  });

  return{server,repo,host,port,
    async listen(){await new Promise<void>((resolve,reject)=>{server.once("error",reject);server.listen(port,host,()=>resolve());});const addr=server.address();const actual=typeof addr==="object"&&addr?addr.port:port;return{url:`http://${host}:${actual}/mcp`,baseUrl:`http://${host}:${actual}`};},
    async close(){await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));await repo.close();}
  };
}

if(process.argv[1]&&new URL(import.meta.url).pathname===process.argv[1]){
  const databaseUrl=process.env.DATABASE_URL,token=process.env.VISUAL4D_LOCAL_AUTH_TOKEN,userId=process.env.VISUAL4D_LOCAL_USER_ID;
  if(!databaseUrl||!token||!userId)throw new Error("DATABASE_URL, VISUAL4D_LOCAL_AUTH_TOKEN and VISUAL4D_LOCAL_USER_ID are required");
  const app=createLocalMcpHttpServer({databaseUrl,auth:{token,userId},allowDevApprovalGrants:process.env.VISUAL4D_ALLOW_DEV_APPROVAL_GRANTS==="true",host:process.env.VISUAL4D_MCP_HOST??"127.0.0.1",port:Number(process.env.VISUAL4D_MCP_PORT??8787),maxBodyBytes:Number(process.env.VISUAL4D_MAX_BODY_BYTES??65536),requestTimeoutMs:Number(process.env.VISUAL4D_REQUEST_TIMEOUT_MS??10000),rateLimitPerMinute:Number(process.env.VISUAL4D_RATE_LIMIT_PER_MINUTE??120)});
  const{baseUrl}=await app.listen();console.error(`Visual 4D local authenticated MCP listening at ${baseUrl}/mcp`);
}
