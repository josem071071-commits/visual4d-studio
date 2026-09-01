import test from "node:test";
import assert from "node:assert/strict";

const databaseUrl=process.env.VISUAL4D_TEST_DATABASE_URL;
const reset=process.env.VISUAL4D_CERTIFICATION_ALLOW_SCHEMA_RESET==="true";
const skip=!databaseUrl||!reset;

const renderInput={
  intent:{headlineProminence:"HIGH",headlineZone:"UPPER_LEFT",heroZone:"CENTER",negativeSpace:"HIGH",textDensity:"LOW",alignment:"LEFT_DOMINANT"},
  content:{headline:"Observability certification",body:["safe logs"],footer:"V4D-SAT"},
  identity:{version:"visual4d.identity.v1",colors:{background:"#FFFFFF",primary:"#173B57",text:"#111827",mutedText:"#4B5563",heroSurface:"#E8EDF2"},typography:{family:"SYSTEM_SANS"}}
};

test("V4D-SAT: production tool logs are structured and do not expose bearer tokens",{skip},async()=>{
  const {Pool}=await import("pg");
  const {ensureProductionSchema}=await import("../../dist-integration/services/mcp-server/src/ensure-production-schema.js");
  const {createProductionMcpHttpServer}=await import("../../dist-integration/services/mcp-server/src/production-server.js");
  const {Client,StreamableHTTPClientTransport}=await import("@modelcontextprotocol/client");

  const resetPool=new Pool({connectionString:databaseUrl});
  await resetPool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  await resetPool.end();
  await ensureProductionSchema(databaseUrl);

  const secretToken="super-secret-observability-token";
  const verifier={
    verify:async(token)=>{
      assert.equal(token,secretToken);
      return{
        subject:"usr_observability",
        issuer:"https://issuer.example/",
        audience:["visual4d-mcp"],
        expiresAt:Math.floor(Date.now()/1000)+600,
        scopes:["visual4d:read","visual4d:render","visual4d:write","visual4d:approve","visual4d:identity"]
      };
    }
  };
  const app=createProductionMcpHttpServer({
    databaseUrl,verifier,issuer:"https://issuer.example/",resourceUri:"https://mcp.example/mcp",host:"127.0.0.1",port:0
  });
  const {url}=await app.listen();
  const client=new Client({name:"v4d-sat-observability",version:"1"});
  const originalError=console.error;
  const lines=[];
  console.error=(...args)=>{lines.push(args.map(String).join(" "));};

  try{
    await client.connect(new StreamableHTTPClientTransport(new URL(url),{requestInit:{headers:{Authorization:`Bearer ${secretToken}`}}}));
    const result=await client.callTool({name:"generation.render_preview",arguments:renderInput});
    assert.notEqual(result.isError,true);
  }finally{
    await client.close();
    console.error=originalError;
    await app.close();
  }

  assert.equal(lines.some(line=>line.includes(secretToken)),false);
  const line=lines.find(item=>item.startsWith("[mcp-tool] "));
  assert.ok(line);
  const event=JSON.parse(line.slice("[mcp-tool] ".length));
  assert.equal(event.tool,"generation.render_preview");
  assert.equal(event.actorUserId,"usr_observability");
  assert.equal(event.outcome,"success");
  assert.equal(typeof event.durationMs,"number");
  assert.ok(event.durationMs>=0);
});
