import test from "node:test";
import assert from "node:assert/strict";
import { createRenderPreviewTool } from "../../dist-integration/services/mcp-server/src/render-tool.js";

const validInput={
 intent:{headlineProminence:"HIGH",headlineZone:"UPPER_LEFT",heroZone:"CENTER",negativeSpace:"HIGH",textDensity:"LOW",alignment:"LEFT_DOMINANT"},
 content:{headline:"Preview desde MCP",body:["Determinista","Read-only"],footer:"Sprint 3.5"},
 identity:{version:"visual4d.identity.v1",colors:{background:"#FFFFFF",primary:"#173B57",text:"#111827",mutedText:"#4B5563",heroSurface:"#E8EDF2"},typography:{family:"SYSTEM_SANS"}}
};

test("Sprint 3.5 render MCP tool is explicitly read-only and closed-world",()=>{
 const tool=createRenderPreviewTool();
 assert.equal(tool.name,"generation.render_preview");
 assert.deepEqual(tool.annotations,{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false});
 assert.equal(tool.inputSchema.additionalProperties,false);
});

test("Sprint 3.5 render MCP tool returns deterministic SVG without persistence inputs",async()=>{
 const tool=createRenderPreviewTool();
 const a=await tool.execute(validInput),b=await tool.execute(validInput);
 assert.deepEqual(a,b);
 assert.equal(a.version,"visual4d.render-service.v1");
 assert.match(a.svg,/<svg/);
 assert.equal("projectId" in tool.inputSchema.properties,false);
 assert.equal("requestId" in tool.inputSchema.properties,false);
});

test("Sprint 3.5 parser rejects invalid enums before service execution",async()=>{
 const tool=createRenderPreviewTool();
 await assert.rejects(()=>tool.execute({...validInput,intent:{...validInput.intent,heroZone:"REMOTE"}}),/INVALID_HEROZONE/);
});

test("Sprint 3.5 preserves identity policy failures",async()=>{
 const tool=createRenderPreviewTool();
 const bad={...validInput,identity:{...validInput.identity,colors:{...validInput.identity.colors,primary:"#EEEEEE"}}};
 await assert.rejects(()=>tool.execute(bad),/PRIMARY_BACKGROUND_CONTRAST_LOW/);
});
