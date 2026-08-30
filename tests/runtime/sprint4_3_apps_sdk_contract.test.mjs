import test from "node:test";
import assert from "node:assert/strict";
import { createRenderPreviewTool } from "../../dist-integration/services/mcp-server/src/render-tool.js";
import { registerRenderPreviewResource, RENDER_PREVIEW_MIME_TYPE, RENDER_PREVIEW_RESOURCE_URI } from "../../dist-integration/services/mcp-server/src/apps-ui.js";

test("Sprint 4.3 render tool advertises ChatGPT and MCP Apps UI metadata",()=>{
  const tool=createRenderPreviewTool();
  assert.equal(tool.title,"Visual 4D Render Preview");
  assert.equal(tool.annotations?.readOnlyHint,true);
  assert.equal(tool._meta?.["openai/outputTemplate"],RENDER_PREVIEW_RESOURCE_URI);
  assert.equal(tool._meta?.["openai/widgetAccessible"],false);
  assert.equal(tool._meta?.ui?.resourceUri,RENDER_PREVIEW_RESOURCE_URI);
  assert.deepEqual(tool._meta?.ui?.visibility,["model","app"]);
});

test("Sprint 4.3 registers a self-contained read-only preview resource",async()=>{
  let captured;
  const fake={registerResource(name,uri,config,callback){captured={name,uri,config,callback};}};
  registerRenderPreviewResource(fake);
  assert.equal(captured.name,"visual4d-render-preview");
  assert.equal(captured.uri,RENDER_PREVIEW_RESOURCE_URI);
  assert.equal(captured.config.mimeType,RENDER_PREVIEW_MIME_TYPE);
  const result=await captured.callback(new URL(RENDER_PREVIEW_RESOURCE_URI));
  assert.equal(result.contents.length,1);
  const resource=result.contents[0];
  assert.equal(resource.mimeType,"text/html+skybridge");
  assert.match(resource.text,/Visual 4D Studio/);
  assert.match(resource.text,/window\.openai/);
  assert.doesNotMatch(resource.text,/https?:\/\//);
  assert.deepEqual(resource._meta["openai/widgetCSP"],{connect_domains:[],resource_domains:[]});
});
