import test from "node:test";
import assert from "node:assert/strict";

const url=process.env.VISUAL4D_TEST_DATABASE_URL;

test("local authenticated MCP rejects unauthenticated requests and serves tools with bearer token",{skip:!url},async()=>{
  const {createLocalMcpHttpServer}=await import("../../dist-integration/services/mcp-server/src/local-server.js");
  const {Client,StreamableHTTPClientTransport}=await import("@modelcontextprotocol/client");
  const app=createLocalMcpHttpServer({databaseUrl:url,auth:{token:'integration-secret',userId:'usr_pg'},port:0});
  try{
    const {url:mcpUrl}=await app.listen();
    const bad=await fetch(mcpUrl,{method:'POST',headers:{'content-type':'application/json'},body:'{}'}); assert.equal(bad.status,401);
    const client=new Client({name:'visual4d-it',version:'0.2.2'});
    await client.connect(new StreamableHTTPClientTransport(new URL(mcpUrl),{requestInit:{headers:{Authorization:'Bearer integration-secret'}}}));
    const tools=await client.listTools(); assert.ok(tools.tools.some(t=>t.name==='method.analyze')); assert.ok(tools.tools.some(t=>t.name==='approvals.approve_stage'));
    await client.close();
  } finally { await app.close(); }
});
