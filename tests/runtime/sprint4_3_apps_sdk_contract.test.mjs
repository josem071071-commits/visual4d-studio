import test from "node:test";
import assert from "node:assert/strict";
import { createRenderPreviewTool } from "../../dist-integration/services/mcp-server/src/render-tool.js";
import { registerRenderPreviewResource, RENDER_PREVIEW_MIME_TYPE, RENDER_PREVIEW_RESOURCE_URI } from "../../dist-integration/services/mcp-server/src/apps-ui.js";
import { APPROVAL_GRANT_TOOL_NAME, APPROVAL_UI_MIME_TYPE, APPROVAL_UI_RESOURCE_URI, approvalMetaForTool, createApprovalGrantUiTool, registerApprovalUiResource, withApprovalStructuredContent } from "../../dist-integration/services/mcp-server/src/approval-ui-bridge.js";
import { MemoryApprovalGrantStore } from "../../dist-integration/services/mcp-server/src/approval-grants.js";

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

test("Approval UI is attached only to approvable workflow stages",()=>{
  const analysis=approvalMetaForTool("method.analyze");
  assert.equal(analysis?.["openai/outputTemplate"],APPROVAL_UI_RESOURCE_URI);
  assert.equal(analysis?.["openai/widgetAccessible"],true);
  assert.deepEqual(analysis?.ui?.visibility,["model","app"]);
  assert.equal(analysis?.["visual4d/approvalKind"],"ANALYSIS");
  assert.equal(approvalMetaForTool("projects.create"),undefined);
  assert.equal(approvalMetaForTool("generation.render_preview"),undefined);
});

test("Approval structured content binds exact project, kind and artifact version",()=>{
  const content=withApprovalStructuredContent("method.analyze",{projectId:"project_1"},{id:"analysis_1",payload:{ok:true}});
  assert.deepEqual(content?._approval,{projectId:"project_1",kind:"ANALYSIS",artifactVersionId:"analysis_1"});
  assert.equal(content?.id,"analysis_1");
});

test("Approval grant issuer is UI-only and requires the approve capability",async()=>{
  const store=new MemoryApprovalGrantStore();
  const tool=createApprovalGrantUiTool(store,()=>({userId:"user-1",permissions:["visual4d:approve"]}));
  assert.equal(tool.name,APPROVAL_GRANT_TOOL_NAME);
  assert.deepEqual(tool._meta?.ui?.visibility,["app"]);
  assert.equal(tool._meta?.["openai/widgetAccessible"],true);
  const issued=await tool.execute({projectId:"project_1",kind:"ANALYSIS",artifactVersionId:"analysis_1",requestId:"ui-grant-1"});
  assert.equal(typeof issued.approvalGrant,"string");
  assert.equal(issued.kind,"ANALYSIS");
});

test("Approval resource renders an explicit user button and performs issue then consume calls",async()=>{
  let captured;
  const fake={registerResource(name,uri,config,callback){captured={name,uri,config,callback};}};
  registerApprovalUiResource(fake);
  assert.equal(captured.name,"visual4d-approval-ui");
  assert.equal(captured.uri,APPROVAL_UI_RESOURCE_URI);
  assert.equal(captured.config.mimeType,APPROVAL_UI_MIME_TYPE);
  const result=await captured.callback(new URL(APPROVAL_UI_RESOURCE_URI));
  const resource=result.contents[0];
  assert.match(resource.text,/Aprobar etapa/);
  assert.match(resource.text,/window\.openai\.callTool\('approvals\.issue_grant'/);
  assert.match(resource.text,/window\.openai\.callTool\('approvals\.approve_stage'/);
  assert.match(resource.text,/escribir “Aprobar” en el chat no genera/);
  assert.deepEqual(resource._meta["openai/widgetCSP"],{connect_domains:[],resource_domains:[]});
});
