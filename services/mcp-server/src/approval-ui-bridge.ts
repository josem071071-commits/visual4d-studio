import type { McpServer } from "@modelcontextprotocol/server";
import type { ActorContext, ArtifactKind } from "../../../packages/repositories/src/index.js";
import type { ApprovalGrantStore } from "./approval-grants.js";
import type { ActorProvider, ToolDefinition } from "./tool-registry.js";

export const APPROVAL_UI_RESOURCE_URI="ui://visual4d/approval.html";
export const APPROVAL_UI_MIME_TYPE="text/html+skybridge";
export const APPROVAL_GRANT_TOOL_NAME="approvals.issue_grant";

const APPROVABLE_TOOL_KINDS:Readonly<Record<string,ArtifactKind>>={
  "method.analyze":"ANALYSIS",
  "method.structure":"STRUCTURE",
  "method.resolve_resources":"RESOURCES",
  "method.art_direct":"ART_DIRECTION",
  "verification.save":"VERIFICATION"
};

function isRecord(value:unknown):value is Record<string,unknown>{
  return value!==null&&typeof value==="object"&&!Array.isArray(value);
}

function requiredString(input:Record<string,unknown>,key:string):string{
  const value=input[key];
  if(typeof value!=="string"||value.trim()==="")throw new Error(`INVALID_${key.toUpperCase()}`);
  return value;
}

export function approvalKindForTool(toolName:string):ArtifactKind|undefined{
  return APPROVABLE_TOOL_KINDS[toolName];
}

export function approvalMetaForTool(toolName:string,base?:Record<string,unknown>):Record<string,unknown>|undefined{
  const kind=approvalKindForTool(toolName);
  if(!kind)return base;
  return{
    ...(base??{}),
    ui:{resourceUri:APPROVAL_UI_RESOURCE_URI,visibility:["model","app"]},
    "openai/outputTemplate":APPROVAL_UI_RESOURCE_URI,
    "openai/widgetAccessible":true,
    "openai/toolInvocation/invoked":"Etapa Visual 4D lista para aprobación.",
    "visual4d/approvalKind":kind
  };
}

export function withApprovalStructuredContent(toolName:string,input:Record<string,unknown>,output:unknown):Record<string,unknown>|undefined{
  if(!isRecord(output))return undefined;
  const kind=approvalKindForTool(toolName);
  if(!kind)return output;
  const projectId=input.projectId;
  const artifactVersionId=output.id;
  if(typeof projectId!=="string"||typeof artifactVersionId!=="string")return output;
  return{
    ...output,
    _approval:{projectId,kind,artifactVersionId}
  };
}

export function createApprovalGrantUiTool(grants:ApprovalGrantStore,actorProvider:ActorProvider):ToolDefinition{
  return{
    name:APPROVAL_GRANT_TOOL_NAME,
    title:"Issue Visual 4D approval grant",
    description:"UI-only bridge. Issues a short-lived one-time approval grant only after an explicit click in the Visual 4D approval widget.",
    inputSchema:{
      type:"object",
      required:["projectId","kind","artifactVersionId","requestId"],
      additionalProperties:false,
      properties:{
        projectId:{type:"string",minLength:1},
        kind:{type:"string",enum:["ANALYSIS","STRUCTURE","RESOURCES","ART_DIRECTION","VERIFICATION","DESIGN"]},
        artifactVersionId:{type:"string",minLength:1},
        requestId:{type:"string",minLength:1}
      }
    },
    annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false},
    _meta:{
      ui:{visibility:["app"]},
      "openai/widgetAccessible":true,
      "visual4d/uiOnly":true
    },
    execute:async input=>{
      const actor:ActorContext=await actorProvider();
      const kind=requiredString(input,"kind") as ArtifactKind;
      const projectId=requiredString(input,"projectId");
      const artifactVersionId=requiredString(input,"artifactVersionId");
      const approvalGrant=await grants.issue({userId:actor.userId,projectId,kind,artifactVersionId});
      return{approvalGrant,expiresInSeconds:300,projectId,kind,artifactVersionId};
    }
  };
}

const APPROVAL_UI_HTML=String.raw`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Visual 4D Studio — Aprobación</title>
<style>
:root{color-scheme:light dark;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
*{box-sizing:border-box}body{margin:0;background:transparent;color:CanvasText}.card{display:grid;gap:12px;padding:14px;border:1px solid color-mix(in srgb,CanvasText 16%,transparent);border-radius:14px}.top{display:flex;justify-content:space-between;gap:12px;align-items:center}.brand{font-weight:700}.stage{font-size:12px;opacity:.7}.copy{font-size:13px;line-height:1.45}.actions{display:flex;gap:8px;align-items:center}.approve{appearance:none;border:0;border-radius:10px;padding:10px 16px;font:inherit;font-weight:700;background:CanvasText;color:Canvas;cursor:pointer}.approve:disabled{opacity:.5;cursor:not-allowed}.status{font-size:12px;opacity:.78}.error{font-size:12px;color:#b42318;white-space:pre-wrap}
</style>
</head>
<body>
<main class="card">
  <div class="top"><span class="brand">Visual 4D Studio</span><span id="stage" class="stage">Etapa pendiente</span></div>
  <div class="copy">Revisa la etapa actual. La aprobación solo se ejecuta cuando pulses este botón; escribir “Aprobar” en el chat no genera la credencial de un solo uso.</div>
  <div class="actions"><button id="approve" class="approve" type="button">Aprobar etapa</button><span id="status" class="status"></span></div>
  <div id="error" class="error" hidden></div>
</main>
<script>
(() => {
  const button=document.getElementById('approve');
  const status=document.getElementById('status');
  const errorBox=document.getElementById('error');
  const stage=document.getElementById('stage');
  const labels={ANALYSIS:'Análisis',STRUCTURE:'Estructura',RESOURCES:'Recursos',ART_DIRECTION:'Dirección de arte',VERIFICATION:'Verificación',DESIGN:'Diseño'};
  const output=window.openai?.toolOutput ?? null;
  const approval=output && typeof output==='object' ? output._approval : null;
  const parseResult=(response)=>{
    if(response && response.structuredContent && typeof response.structuredContent==='object')return response.structuredContent;
    const text=response?.content?.find?.(item=>item?.type==='text')?.text;
    if(typeof text==='string'){try{return JSON.parse(text);}catch{}}
    return response ?? {};
  };
  const requestId=(prefix)=>`${prefix}-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`;
  if(!approval||typeof approval.projectId!=='string'||typeof approval.kind!=='string'||typeof approval.artifactVersionId!=='string'){
    button.disabled=true;status.textContent='Contexto de aprobación no disponible.';return;
  }
  stage.textContent=labels[approval.kind] ?? approval.kind;
  button.addEventListener('click',async()=>{
    if(typeof window.openai?.callTool!=='function'){
      errorBox.hidden=false;errorBox.textContent='El host no habilitó llamadas de herramienta desde el widget.';return;
    }
    button.disabled=true;errorBox.hidden=true;status.textContent='Generando autorización de un solo uso…';
    try{
      const issued=parseResult(await window.openai.callTool('approvals.issue_grant',{
        projectId:approval.projectId,kind:approval.kind,artifactVersionId:approval.artifactVersionId,requestId:requestId('grant')
      }));
      if(typeof issued.approvalGrant!=='string')throw new Error(issued.error ?? 'APPROVAL_GRANT_NOT_RETURNED');
      status.textContent='Aplicando aprobación…';
      const approved=parseResult(await window.openai.callTool('approvals.approve_stage',{
        projectId:approval.projectId,kind:approval.kind,artifactVersionId:approval.artifactVersionId,approvalGrant:issued.approvalGrant,requestId:requestId('approve')
      }));
      if(approved?.error)throw new Error(String(approved.error));
      status.textContent='Aprobado ✓';button.textContent='Etapa aprobada';
    }catch(error){
      button.disabled=false;status.textContent='';errorBox.hidden=false;errorBox.textContent=error instanceof Error?error.message:String(error);
    }
  });
})();
</script>
</body>
</html>`;

export function registerApprovalUiResource(server:McpServer):void{
  server.registerResource(
    "visual4d-approval-ui",
    APPROVAL_UI_RESOURCE_URI,
    {title:"Visual 4D Approval",description:"Explicit user-action approval surface for exact Visual 4D artifact versions.",mimeType:APPROVAL_UI_MIME_TYPE},
    async uri=>({contents:[{uri:uri.href,mimeType:APPROVAL_UI_MIME_TYPE,text:APPROVAL_UI_HTML,_meta:{ui:{csp:{connectDomains:[],resourceDomains:[]}},"openai/widgetPrefersBorder":true,"openai/widgetCSP":{connect_domains:[],resource_domains:[]}}}]})
  );
}
