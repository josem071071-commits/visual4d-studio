import test from "node:test";
import assert from "node:assert/strict";

const url=process.env.VISUAL4D_TEST_DATABASE_URL;

test("local authenticated MCP rejects unauthenticated requests and serves render preview",{skip:!url},async()=>{
  const {createLocalMcpHttpServer}=await import("../../dist-integration/services/mcp-server/src/local-server.js");
  const {Client,StreamableHTTPClientTransport}=await import("@modelcontextprotocol/client");
  const app=createLocalMcpHttpServer({databaseUrl:url,auth:{token:'integration-secret',userId:'usr_pg'},port:0});
  try{
    const {url:mcpUrl}=await app.listen();
    const bad=await fetch(mcpUrl,{method:'POST',headers:{'content-type':'application/json'},body:'{}'}); assert.equal(bad.status,401);
    const client=new Client({name:'visual4d-it',version:'0.4.3'});
    await client.connect(new StreamableHTTPClientTransport(new URL(mcpUrl),{requestInit:{headers:{Authorization:'Bearer integration-secret'}}}));
    const tools=await client.listTools();
    assert.ok(tools.tools.some(t=>t.name==='method.analyze'));
    assert.ok(tools.tools.some(t=>t.name==='approvals.approve_stage'));
    const renderTool=tools.tools.find(t=>t.name==='generation.render_preview');
    assert.ok(renderTool);
    assert.equal(renderTool.annotations?.readOnlyHint,true);
    assert.equal(renderTool._meta?.['openai/outputTemplate'],'ui://visual4d/render-preview.html');
    assert.equal(renderTool._meta?.ui?.resourceUri,'ui://visual4d/render-preview.html');

    const resources=await client.listResources();
    const previewResource=resources.resources.find(r=>r.uri==='ui://visual4d/render-preview.html');
    assert.ok(previewResource);
    assert.equal(previewResource.mimeType,'text/html+skybridge');
    const resource=await client.readResource({uri:'ui://visual4d/render-preview.html'});
    assert.equal(resource.contents.length,1);
    assert.equal(resource.contents[0].mimeType,'text/html+skybridge');
    assert.match(resource.contents[0].text,/window\.openai/);

    const result=await client.callTool({name:'generation.render_preview',arguments:{
      intent:{headlineProminence:'HIGH',headlineZone:'UPPER_LEFT',heroZone:'CENTER',negativeSpace:'HIGH',textDensity:'LOW',alignment:'LEFT_DOMINANT'},
      content:{headline:'Preview MCP real',body:['Autenticado','Read-only']},
      identity:{version:'visual4d.identity.v1',colors:{background:'#FFFFFF',primary:'#173B57',text:'#111827',mutedText:'#4B5563',heroSurface:'#E8EDF2'},typography:{family:'SYSTEM_SANS'}}
    }});
    assert.equal(result.isError??false,false);
    assert.equal(result._meta?.['openai/outputTemplate'],'ui://visual4d/render-preview.html');
    assert.equal(result.structuredContent?.version,'visual4d.render-service.v1');
    assert.match(result.structuredContent?.svg,/<svg/);
    const text=result.content.find(item=>item.type==='text')?.text;
    assert.equal(typeof text,'string');
    const parsed=JSON.parse(text);
    assert.equal(parsed.version,'visual4d.render-service.v1');
    assert.match(parsed.svg,/<svg/);
    await client.close();
  } finally { await app.close(); }
});
