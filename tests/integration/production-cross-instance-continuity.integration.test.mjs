import test from "node:test";
import assert from "node:assert/strict";

const databaseUrl=process.env.VISUAL4D_TEST_DATABASE_URL;
const reset=process.env.VISUAL4D_CERTIFICATION_ALLOW_SCHEMA_RESET==="true";
const skip=!databaseUrl||!reset;

function tokenRecord(subject,scopes){
  return {subject,issuer:"https://issuer.example",audience:["visual4d-mcp"],expiresAt:Math.floor(Date.now()/1000)+600,scopes};
}

test("V4D-SAT: project created on production instance A is immediately analyzable on independent instance B",{skip},async()=>{
  const {Pool}=await import("pg");
  const {Client,StreamableHTTPClientTransport}=await import("@modelcontextprotocol/client");
  const {ensureProductionSchema}=await import("../../dist-integration/services/mcp-server/src/ensure-production-schema.js");
  const {createProductionMcpHttpServer}=await import("../../dist-integration/services/mcp-server/src/production-server.js");

  const resetPool=new Pool({connectionString:databaseUrl});
  await resetPool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  await resetPool.end();
  await ensureProductionSchema(databaseUrl);

  const scopes=["visual4d:read","visual4d:render","visual4d:write","visual4d:approve","visual4d:identity"];
  const verifier={async verify(token){if(token!=="continuity-token")throw new Error("INVALID_TEST_TOKEN");return tokenRecord("continuity-user",scopes);}};
  const common={databaseUrl,verifier,issuer:"https://issuer.example",resourceUri:"https://mcp.visual4dstudio.com/mcp",host:"127.0.0.1",port:0,rateLimitPerMinute:500};
  const appA=createProductionMcpHttpServer(common);
  const appB=createProductionMcpHttpServer(common);
  const [{url:urlA},{url:urlB}]=await Promise.all([appA.listen(),appB.listen()]);
  const pool=new Pool({connectionString:databaseUrl});

  const connect=async(url,name)=>{
    const client=new Client({name,version:"1.0.0"});
    await client.connect(new StreamableHTTPClientTransport(new URL(url),{requestInit:{headers:{Authorization:"Bearer continuity-token"}}}));
    return client;
  };
  const parse=response=>{
    if(response.structuredContent&&typeof response.structuredContent==="object")return response.structuredContent;
    const text=response.content.find(item=>item.type==="text");
    return JSON.parse(text?.text??"{}");
  };

  const clientA=await connect(urlA,"continuity-a");
  const clientB=await connect(urlB,"continuity-b");
  try{
    const createdResponse=await clientA.callTool({name:"projects.create",arguments:{name:"Cross-instance continuity",projectType:"FLYER",requestId:"continuity-create"}});
    assert.equal(createdResponse.isError??false,false);
    const created=parse(createdResponse);
    assert.match(created.projectId,/^project_/);

    const persisted=(await pool.query("SELECT id,current_stage,owner_user_id FROM projects WHERE id=$1",[created.projectId])).rows[0];
    assert.equal(persisted?.id,created.projectId);
    assert.equal(persisted?.current_stage,"DRAFT");
    assert.equal(persisted?.owner_user_id,"continuity-user");

    const analysisResponse=await clientB.callTool({name:"method.analyze",arguments:{projectId:created.projectId,sourceContent:"Cross-instance production continuity proof",requestId:"continuity-analyze"}});
    assert.equal(analysisResponse.isError??false,false,JSON.stringify(parse(analysisResponse)));
    const analysis=parse(analysisResponse);
    assert.equal(analysis.projectId,created.projectId);
    assert.equal(analysis.kind,"ANALYSIS");

    const projectAfter=(await pool.query("SELECT current_stage FROM projects WHERE id=$1",[created.projectId])).rows[0];
    assert.equal(projectAfter?.current_stage,"ANALYSIS_REVIEW");
  }finally{
    await Promise.allSettled([clientA.close(),clientB.close()]);
    await Promise.allSettled([appA.close(),appB.close()]);
    await pool.end();
  }
});
