import assert from "node:assert/strict";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const url=process.env.VISUAL4D_STAGING_URL;
const token=process.env.VISUAL4D_STAGING_AUTH_TOKEN;
const previewUri="ui://visual4d/render-preview.html";

if(!url) throw new Error("VISUAL4D_STAGING_URL is required");
if(!token) throw new Error("VISUAL4D_STAGING_AUTH_TOKEN is required");

const client=new Client({name:"visual4d-external-certification",version:"0.4.3"});
try{
  const transport=new StreamableHTTPClientTransport(new URL(url),{
    requestInit:{headers:{Authorization:`Bearer ${token}`}}
  });
  await client.connect(transport);
  const tools=await client.listTools();
  assert.ok(tools.tools.some(t=>t.name==="method.analyze"),"method.analyze missing");
  const renderTool=tools.tools.find(t=>t.name==="generation.render_preview");
  assert.ok(renderTool,"generation.render_preview missing");
  assert.equal(renderTool.annotations?.readOnlyHint,true);
  assert.equal(renderTool._meta?.["openai/outputTemplate"],previewUri,"ChatGPT output template missing");
  assert.equal(renderTool._meta?.ui?.resourceUri,previewUri,"MCP Apps resource URI missing");
  assert.deepEqual(renderTool._meta?.ui?.visibility,["model","app"]);

  const resources=await client.listResources();
  const preview=resources.resources.find(r=>r.uri===previewUri);
  assert.ok(preview,"Visual 4D Apps SDK preview resource missing");
  assert.equal(preview.mimeType,"text/html+skybridge");

  const resource=await client.readResource({uri:previewUri});
  assert.equal(resource.contents.length,1);
  assert.equal(resource.contents[0].mimeType,"text/html+skybridge");
  assert.match(resource.contents[0].text,/Visual 4D Studio/);
  assert.match(resource.contents[0].text,/window\.openai/);
  assert.doesNotMatch(resource.contents[0].text,/https?:\/\//);

  const result=await client.callTool({name:"generation.render_preview",arguments:{
    intent:{headlineProminence:"HIGH",headlineZone:"UPPER_LEFT",heroZone:"CENTER",negativeSpace:"HIGH",textDensity:"LOW",alignment:"LEFT_DOMINANT"},
    content:{headline:"Visual 4D Apps SDK external certification",body:["Railway staging","Authenticated MCP","Inline preview resource"]},
    identity:{version:"visual4d.identity.v1",colors:{background:"#FFFFFF",primary:"#173B57",text:"#111827",mutedText:"#4B5563",heroSurface:"#E8EDF2"},typography:{family:"SYSTEM_SANS"}}
  }});
  assert.equal(result.isError??false,false);
  assert.equal(result._meta?.["openai/outputTemplate"],previewUri);
  assert.equal(result.structuredContent?.version,"visual4d.render-service.v1");
  assert.match(result.structuredContent?.svg,/<svg/);
  const text=result.content.find(item=>item.type==="text")?.text;
  assert.equal(typeof text,"string");
  const parsed=JSON.parse(text);
  assert.equal(parsed.version,"visual4d.render-service.v1");
  assert.match(parsed.svg,/<svg/);
  console.log("Visual 4D Sprint 4.3 external Apps SDK certification PASS");
} finally {
  await client.close().catch(()=>{});
}
