import test from "node:test";
import assert from "node:assert/strict";

const databaseUrl=process.env.VISUAL4D_TEST_DATABASE_URL;
const reset=process.env.VISUAL4D_CERTIFICATION_ALLOW_SCHEMA_RESET==="true";
const skip=!databaseUrl||!reset;

function tokenRecord(subject,scopes){
  return{subject,issuer:"https://issuer.example",audience:["visual4d-mcp"],expiresAt:Math.floor(Date.now()/1000)+600,scopes};
}

test("V4D-SAT: Approval UI Bridge issues and consumes exact one-time grants in production MCP",{skip},async()=>{
  const {Pool}=await import("pg");
  const {Client,StreamableHTTPClientTransport}=await import("@modelcontextprotocol/client");
  const {ensureProductionSchema}=await import("../../dist-integration/services/mcp-server/src/ensure-production-schema.js");
  const {createProductionMcpHttpServer}=await import("../../dist-integration/services/mcp-server/src/production-server.js");

  const resetPool=new Pool({connectionString:databaseUrl});
  await resetPool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  await resetPool.end();
  await ensureProductionSchema(databaseUrl);

  const allScopes=["visual4d:read","visual4d:render","visual4d:write","visual4d:approve","visual4d:identity"];
  const verifier={async verify(token){if(token!=="approval-ui-token")throw new Error("INVALID_TEST_TOKEN");return tokenRecord("approval-ui-user",allScopes);}};
  const app=createProductionMcpHttpServer({databaseUrl,verifier,issuer:"https://issuer.example",resourceUri:"https://mcp.visual4dstudio.com/mcp",host:"127.0.0.1",port:0,rateLimitPerMinute:500});
  const {url}=await app.listen();
  const pool=new Pool({connectionString:databaseUrl});
  const client=new Client({name:"approval-ui-certifier",version:"1.0.0"});
  await client.connect(new StreamableHTTPClientTransport(new URL(url),{requestInit:{headers:{Authorization:"Bearer approval-ui-token"}}}));

  const parse=response=>{
    if(response.structuredContent&&typeof response.structuredContent==="object")return response.structuredContent;
    const text=response.content.find(item=>item.type==="text");
    return JSON.parse(text?.text??"{}");
  };

  try{
    const tools=await client.listTools();
    const issueTool=tools.tools.find(tool=>tool.name==="approvals.issue_grant");
    assert.ok(issueTool);
    assert.deepEqual(issueTool._meta?.ui?.visibility,["app"]);
    assert.equal(issueTool._meta?.["visual4d/uiOnly"],true);
    const analyzeTool=tools.tools.find(tool=>tool.name==="method.analyze");
    assert.equal(analyzeTool?._meta?.["openai/outputTemplate"],"ui://visual4d/approval.html");
    assert.equal(analyzeTool?._meta?.["openai/widgetAccessible"],true);

    const created=parse(await client.callTool({name:"projects.create",arguments:{name:"Approval UI Bridge Certification",projectType:"FLYER",requestId:"approval-ui-create"}}));
    const analysisResponse=await client.callTool({name:"method.analyze",arguments:{projectId:created.projectId,sourceContent:"Contenido de prueba para aprobación explícita",requestId:"approval-ui-analyze"}});
    assert.equal(analysisResponse.isError??false,false);
    const analysis=parse(analysisResponse);
    assert.deepEqual(analysis._approval,{projectId:created.projectId,kind:"ANALYSIS",artifactVersionId:analysis.id});

    // Text in chat or a fabricated token is not an approval credential.
    const fakeApproval=await client.callTool({name:"approvals.approve_stage",arguments:{projectId:created.projectId,kind:"ANALYSIS",artifactVersionId:analysis.id,approvalGrant:"Aprobar-analisis-no-es-grant",requestId:"approval-ui-fake"}});
    assert.equal(fakeApproval.isError,true);
    assert.match(String(parse(fakeApproval).error),/INVALID_OR_EXPIRED_APPROVAL_GRANT/);

    // Simulate the widget click: issue an app-only grant bound to this exact artifact.
    const issueResponse=await client.callTool({name:"approvals.issue_grant",arguments:{projectId:created.projectId,kind:"ANALYSIS",artifactVersionId:analysis.id,requestId:"approval-ui-issue"}});
    assert.equal(issueResponse.isError??false,false);
    const issued=parse(issueResponse);
    assert.equal(typeof issued.approvalGrant,"string");
    assert.ok(issued.approvalGrant.length>=32);

    const approved=await client.callTool({name:"approvals.approve_stage",arguments:{projectId:created.projectId,kind:"ANALYSIS",artifactVersionId:analysis.id,approvalGrant:issued.approvalGrant,requestId:"approval-ui-approve"}});
    assert.equal(approved.isError??false,false);

    // One-time means one-time: replay is rejected.
    const replay=await client.callTool({name:"approvals.approve_stage",arguments:{projectId:created.projectId,kind:"ANALYSIS",artifactVersionId:analysis.id,approvalGrant:issued.approvalGrant,requestId:"approval-ui-replay"}});
    assert.equal(replay.isError,true);
    assert.match(String(parse(replay).error),/INVALID_OR_EXPIRED_APPROVAL_GRANT/);

    // A grant issued for another version cannot approve the exact current version.
    const wrongIssue=parse(await client.callTool({name:"approvals.issue_grant",arguments:{projectId:created.projectId,kind:"ANALYSIS",artifactVersionId:"analysis_wrong_version",requestId:"approval-ui-wrong-issue"}}));
    const wrongVersion=await client.callTool({name:"approvals.approve_stage",arguments:{projectId:created.projectId,kind:"ANALYSIS",artifactVersionId:analysis.id,approvalGrant:wrongIssue.approvalGrant,requestId:"approval-ui-wrong-use"}});
    assert.equal(wrongVersion.isError,true);
    assert.match(String(parse(wrongVersion).error),/INVALID_OR_EXPIRED_APPROVAL_GRANT/);

    const states=await pool.query("SELECT state,count(*)::int AS n FROM approval_grants GROUP BY state ORDER BY state");
    assert.ok(states.rows.some(row=>row.state==="CONSUMED"&&Number(row.n)>=1));
    const project=await pool.query("SELECT current_stage FROM projects WHERE id=$1",[created.projectId]);
    assert.equal(project.rows[0]?.current_stage,"ANALYSIS_APPROVED");
  } finally {
    await client.close();
    await app.close();
    await pool.end();
  }
});
