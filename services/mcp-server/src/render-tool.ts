import type { ToolDefinition } from "./tool-registry.js";
import type { LayoutIntent } from "../../../packages/layout-engine/src/index.js";
import type { FlyerRenderContent } from "../../../packages/renderer/src/index.js";
import type { RasterAssetBinding } from "../../../packages/asset-binding/src/index.js";
import type { VisualIdentityTokens } from "../../../packages/identity-style/src/index.js";
import { renderVisual4DFlyer } from "../../../packages/render-service/src/index.js";

const SOURCE_TYPES=["USER_INPUT","SOURCE_DOCUMENT","MASTER_ASSET","DOCUMENTARY_ASSET","INSTITUTIONAL_ASSET","GENERATED_ASSET","APPROVED_STRUCTURE","SYSTEM_DERIVED"] as const;
const MEDIA_TYPES=["image/png","image/jpeg","image/webp"] as const;
const FONT_TOKENS=["SYSTEM_SANS","SYSTEM_SERIF","SYSTEM_MONO"] as const;

function strict(required:string[],properties:Record<string,unknown>){return{type:"object",required,additionalProperties:false,properties};}
function obj(input:Record<string,unknown>,key:string):Record<string,unknown>{const value=input[key];if(!value||typeof value!=="object"||Array.isArray(value))throw new Error(`INVALID_${key.toUpperCase()}`);return value as Record<string,unknown>;}
function str(input:Record<string,unknown>,key:string):string{const value=input[key];if(typeof value!=="string"||!value.trim())throw new Error(`INVALID_${key.toUpperCase()}`);return value;}
function bool(input:Record<string,unknown>,key:string):boolean{const value=input[key];if(typeof value!=="boolean")throw new Error(`INVALID_${key.toUpperCase()}`);return value;}
function strings(input:Record<string,unknown>,key:string):string[]{const value=input[key];if(!Array.isArray(value)||!value.every(v=>typeof v==="string"))throw new Error(`INVALID_${key.toUpperCase()}`);return value;}
function enumValue<T extends readonly string[]>(input:Record<string,unknown>,key:string,allowed:T):T[number]{const value=str(input,key);if(!allowed.includes(value as T[number]))throw new Error(`INVALID_${key.toUpperCase()}`);return value as T[number];}
function optionalString(input:Record<string,unknown>,key:string):string|undefined{const value=input[key];if(value===undefined)return undefined;if(typeof value!=="string")throw new Error(`INVALID_${key.toUpperCase()}`);return value;}

function parseIntent(input:Record<string,unknown>):LayoutIntent{
 const value=obj(input,"intent");
 return{
  headlineProminence:enumValue(value,"headlineProminence",["LOW","MEDIUM","HIGH","VERY_HIGH"] as const),
  headlineZone:enumValue(value,"headlineZone",["UPPER_LEFT","UPPER_CENTER","UPPER_RIGHT"] as const),
  heroZone:enumValue(value,"heroZone",["UPPER","CENTER","LOWER","RIGHT","LEFT"] as const),
  negativeSpace:enumValue(value,"negativeSpace",["LOW","MEDIUM","HIGH"] as const),
  textDensity:enumValue(value,"textDensity",["LOW","MEDIUM","HIGH"] as const),
  alignment:enumValue(value,"alignment",["LEFT_DOMINANT","CENTERED","RIGHT_DOMINANT","BALANCED"] as const)
 };
}
function parseContent(input:Record<string,unknown>):FlyerRenderContent{
 const value=obj(input,"content");
 const content:FlyerRenderContent={headline:str(value,"headline"),body:strings(value,"body")};
 const eyebrow=optionalString(value,"eyebrow"),footer=optionalString(value,"footer"),heroLabel=optionalString(value,"heroLabel");
 if(eyebrow!==undefined)content.eyebrow=eyebrow;if(footer!==undefined)content.footer=footer;if(heroLabel!==undefined)content.heroLabel=heroLabel;
 return content;
}
function parseIdentity(input:Record<string,unknown>):VisualIdentityTokens{
 const value=obj(input,"identity"),colors=obj(value,"colors"),typography=obj(value,"typography");
 if(str(value,"version")!=="visual4d.identity.v1")throw new Error("INVALID_IDENTITY_VERSION");
 return{version:"visual4d.identity.v1",colors:{background:str(colors,"background"),primary:str(colors,"primary"),text:str(colors,"text"),mutedText:str(colors,"mutedText"),heroSurface:str(colors,"heroSurface")},typography:{family:enumValue(typography,"family",FONT_TOKENS)}};
}
function parseAsset(input:Record<string,unknown>):RasterAssetBinding|undefined{
 const raw=input.heroAsset;if(raw===undefined)return undefined;if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new Error("INVALID_HEROASSET");const value=raw as Record<string,unknown>;
 const approvedAt=value.approvedAt;if(approvedAt!==null&&typeof approvedAt!=="string")throw new Error("INVALID_APPROVEDAT");
 return{elementId:str(value,"elementId"),assetId:str(value,"assetId"),sourceType:enumValue(value,"sourceType",SOURCE_TYPES),generatedByAI:bool(value,"generatedByAI"),documentary:bool(value,"documentary"),approved:bool(value,"approved"),approvedAt,mediaType:enumValue(value,"mediaType",MEDIA_TYPES),dataUri:str(value,"dataUri")};
}

const intentSchema=strict(["headlineProminence","headlineZone","heroZone","negativeSpace","textDensity","alignment"],{headlineProminence:{type:"string",enum:["LOW","MEDIUM","HIGH","VERY_HIGH"]},headlineZone:{type:"string",enum:["UPPER_LEFT","UPPER_CENTER","UPPER_RIGHT"]},heroZone:{type:"string",enum:["UPPER","CENTER","LOWER","RIGHT","LEFT"]},negativeSpace:{type:"string",enum:["LOW","MEDIUM","HIGH"]},textDensity:{type:"string",enum:["LOW","MEDIUM","HIGH"]},alignment:{type:"string",enum:["LEFT_DOMINANT","CENTERED","RIGHT_DOMINANT","BALANCED"]}});
const contentSchema=strict(["headline","body"],{eyebrow:{type:"string"},headline:{type:"string",minLength:1},body:{type:"array",items:{type:"string"},maxItems:20},footer:{type:"string"},heroLabel:{type:"string"}});
const identitySchema=strict(["version","colors","typography"],{version:{type:"string",enum:["visual4d.identity.v1"]},colors:strict(["background","primary","text","mutedText","heroSurface"],{background:{type:"string",pattern:"^#[0-9A-Fa-f]{6}$"},primary:{type:"string",pattern:"^#[0-9A-Fa-f]{6}$"},text:{type:"string",pattern:"^#[0-9A-Fa-f]{6}$"},mutedText:{type:"string",pattern:"^#[0-9A-Fa-f]{6}$"},heroSurface:{type:"string",pattern:"^#[0-9A-Fa-f]{6}$"}}),typography:strict(["family"],{family:{type:"string",enum:FONT_TOKENS}})});
const assetSchema=strict(["elementId","assetId","sourceType","generatedByAI","documentary","approved","approvedAt","mediaType","dataUri"],{elementId:{type:"string",enum:["hero"]},assetId:{type:"string",minLength:1},sourceType:{type:"string",enum:SOURCE_TYPES},generatedByAI:{type:"boolean"},documentary:{type:"boolean"},approved:{type:"boolean"},approvedAt:{anyOf:[{type:"string"},{type:"null"}]},mediaType:{type:"string",enum:MEDIA_TYPES},dataUri:{type:"string",minLength:1,maxLength:60000}});

export function createRenderPreviewTool():ToolDefinition{
 return{name:"generation.render_preview",description:"Render a deterministic Visual 4D preview from validated layout intent, content, identity tokens and an optional inline raster hero asset. This tool is read-only and does not persist, approve or finalize anything.",inputSchema:strict(["intent","content","identity"],{intent:intentSchema,content:contentSchema,identity:identitySchema,heroAsset:assetSchema}),annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},execute:async input=>{const heroAsset=parseAsset(input);const request={intent:parseIntent(input),content:parseContent(input),identity:parseIdentity(input),...(heroAsset===undefined?{}:{heroAsset})};return renderVisual4DFlyer(request);}};
}
