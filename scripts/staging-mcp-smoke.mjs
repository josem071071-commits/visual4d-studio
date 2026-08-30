import assert from "node:assert/strict";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const mcpUrl=process.env.STAGING_MCP_URL;
const token=process.env.STAGING_MCP_TOKEN;
if(!mcpUrl||!token) throw new Error("STAGING_MCP_URL and STAGING_MCP_TOKEN are required");

const healthUrl=new URL('/healthz',mcpUrl).toString();
const health=await fetch(healthUrl);
assert.equal(health.status,200);
const healthBody=await health.json();
assert.equal(healthBody.ok,true);

const unauth=await fetch(mcpUrl,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
assert.equal(unauth.status,401);

const client=new Client({name:'visual4d-staging-smoke',version:'4.1'});
try{
  await client.connect(new StreamableHTTPClientTransport(new URL(mcpUrl),{requestInit:{headers:{Authorization:`Bearer ${token}`}}}));
  const tools=await client.listTools();
  const renderTool=tools.tools.find(t=>t.name==='generation.render_preview');
  assert.ok(renderTool,'generation.render_preview must be discoverable');
  assert.equal(renderTool.annotations?.readOnlyHint,true);

  const result=await client.callTool({name:'generation.render_preview',arguments:{
    intent:{headlineProminence:'HIGH',headlineZone:'UPPER_LEFT',heroZone:'CENTER',negativeSpace:'HIGH',textDensity:'LOW',alignment:'LEFT_DOMINANT'},
    content:{eyebrow:'STAGING',headline:'Visual 4D Sprint 4.1',body:['HTTPS-ready deployment adapter','Authenticated MCP smoke test'],footer:'Deterministic preview'},
    identity:{version:'visual4d.identity.v1',colors:{background:'#FFFFFF',primary:'#173B57',text:'#111827',mutedText:'#4B5563',heroSurface:'#E8EDF2'},typography:{family:'SYSTEM_SANS'}}
  }});
  assert.equal(result.isError??false,false);
  const text=result.content.find(item=>item.type==='text')?.text;
  assert.equal(typeof text,'string');
  const parsed=JSON.parse(text);
  assert.equal(parsed.version,'visual4d.render-service.v1');
  assert.match(parsed.svg,/<svg/);
  console.log(JSON.stringify({status:'PASS',service:healthBody.service,tool:'generation.render_preview',renderVersion:parsed.version}));
} finally {
  await client.close();
}
