import test from "node:test";
import assert from "node:assert/strict";

const databaseUrl=process.env.VISUAL4D_TEST_DATABASE_URL;
const reset=process.env.VISUAL4D_CERTIFICATION_ALLOW_SCHEMA_RESET==="true";
const skip=!databaseUrl||!reset;

function tokenRecord(subject,scopes){
  return {
    subject,
    issuer:"https://issuer.example",
    audience:["visual4d-mcp"],
    expiresAt:Math.floor(Date.now()/1000)+600,
    scopes
  };
}

test("V4D-SAT: production MCP enforces user isolation and least privilege on PostgreSQL",{skip},async()=>{
  const {Pool}=await import("pg");
  const {Client,StreamableHTTPClientTransport}=await import("@modelcontextprotocol/client");
  const {ensureProductionSchema}=await import("../../dist-integration/services/mcp-server/src/ensure-production-schema.js");
  const {createProductionMcpHttpServer}=await import("../../dist-integration/services/mcp-server/src/production-server.js");

  const resetPool=new Pool({connectionString:databaseUrl});
  await resetPool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  await resetPool.end();
  await ensureProductionSchema(databaseUrl);

  const allScopes=["visual4d:read","visual4d:render","visual4d:write","visual4d:approve","visual4d:identity"];
  const tokens=new Map([
    ["token-a",tokenRecord("security-user-a",allScopes)],
    ["token-b",tokenRecord("security-user-b",allScopes)],
    ["token-a-render",tokenRecord("security-user-a",["visual4d:render"])]
  ]);
  const verifier={
    async verify(token){
      const value=tokens.get(token);
      if(!value)throw new Error("INVALID_TEST_TOKEN");
      return value;
    }
  };

  const app=createProductionMcpHttpServer({
    databaseUrl,
    verifier,
    issuer:"https://issuer.example",
    resourceUri:"https://mcp.visual4dstudio.com/mcp",
    host:"127.0.0.1",
    port:0,
    rateLimitPerMinute:500
  });
  const {url}=await app.listen();
  const pool=new Pool({connectionString:databaseUrl});

  const connect=async(token)=>{
    const client=new Client({name:`security-${token}`,version:"1.0.0"});
    await client.connect(new StreamableHTTPClientTransport(new URL(url),{requestInit:{headers:{Authorization:`Bearer ${token}`}}}));
    return client;
  };
  const parse=(response)=>{
    const text=response.content.find(item=>item.type==="text");
    return JSON.parse(text?.text??"{}");
  };

  const clientA=await connect("token-a");
  const clientB=await connect("token-b");
  const renderOnly=await connect("token-a-render");

  try{
    const createdAResponse=await clientA.callTool({name:"projects.create",arguments:{name:"Security owner A",projectType:"FLYER",requestId:"security-a-create"}});
    assert.equal(createdAResponse.isError??false,false);
    const createdA=parse(createdAResponse);
    assert.match(createdA.projectId,/^project_/);

    const rowA=(await pool.query("SELECT owner_user_id,institution_id FROM projects WHERE id=$1",[createdA.projectId])).rows[0];
    assert.equal(rowA.owner_user_id,"security-user-a");

    // A fully authenticated second user must still be unable to mutate user A's project.
    const crossProject=await clientB.callTool({name:"method.analyze",arguments:{projectId:createdA.projectId,sourceContent:"cross-user attempt",requestId:"security-b-cross-project"}});
    assert.equal(crossProject.isError,true);
    assert.match(String(parse(crossProject).error),/FORBIDDEN_PROJECT_OWNER_MISMATCH/);

    // Identity administration must also remain isolated. The current service intentionally
    // reports the same owner-mismatch code for this path, so the security contract is that
    // the cross-user action is denied, not that a particular internal label is used.
    const candidateIdentity="security_identity_a_v2";
    await pool.query("INSERT INTO identity_versions(id,institution_id,version_number,name,status) VALUES($1,$2,2,'Security A v2','DRAFT')",[candidateIdentity,rowA.institution_id]);
    const crossIdentity=await clientB.callTool({name:"identity.activate_version",arguments:{institutionId:rowA.institution_id,identityVersionId:candidateIdentity,requestId:"security-b-cross-identity"}});
    assert.equal(crossIdentity.isError,true);
    assert.match(String(parse(crossIdentity).error),/FORBIDDEN_(PROJECT|INSTITUTION)_OWNER_MISMATCH/);

    // Authentication is not authorization: render-only cannot perform writes.
    const deniedWrite=await renderOnly.callTool({name:"projects.create",arguments:{name:"Must not exist",projectType:"FLYER",requestId:"security-render-write"}});
    assert.equal(deniedWrite.isError,true);
    assert.equal(parse(deniedWrite).error,"INSUFFICIENT_SCOPE");

    // User B can create only its own project and ownership derives from token sub.
    const createdBResponse=await clientB.callTool({name:"projects.create",arguments:{name:"Security owner B",projectType:"FLYER",requestId:"security-b-create"}});
    assert.equal(createdBResponse.isError??false,false);
    const createdB=parse(createdBResponse);
    assert.notEqual(createdB.projectId,createdA.projectId);
    const rowB=(await pool.query("SELECT owner_user_id FROM projects WHERE id=$1",[createdB.projectId])).rows[0];
    assert.equal(rowB.owner_user_id,"security-user-b");

    const forbiddenProjectCount=Number((await pool.query("SELECT count(*)::int AS n FROM projects WHERE title='Must not exist'")).rows[0]?.n??0);
    assert.equal(forbiddenProjectCount,0);
  } finally {
    await Promise.allSettled([clientA.close(),clientB.close(),renderOnly.close()]);
    await app.close();
    await pool.end();
  }
});
