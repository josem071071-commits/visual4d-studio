# V4D-SAT Production Baseline

Status: **CERTIFIED BASELINE / PRE-v1 RELEASE CANDIDATE FOUNDATION**

## Frozen rollback reference

- Repository commit: `3dbc162d03b97c0024b6968d324c398e435724b4`
- Railway deployment status reported to GitHub: `success`
- Production MCP: `https://mcp.visual4dstudio.com/mcp`
- Production health: `https://mcp.visual4dstudio.com/healthz`
- Public website: `https://www.visual4dstudio.com`
- Production schema contract: migrations `0001` through `0006`
- MCP catalog expected size: **11 tools**

## Evidence already established

- OAuth authorization-code/PKCE flow completes and ChatGPT connects to the MCP service.
- MCP initialization and tool discovery are operational.
- `projects.create` was executed from ChatGPT against production and returned a real persisted project with `isError=false`.
- Railway production configuration is pinned to `Dockerfile.production` and guarded by CI.
- PostgreSQL production bootstrap is versioned and idempotent.
- The public website, legal/support routes and custom MCP health endpoint have passed external GitHub Actions checks.
- Cloudflare custom domain and Railway custom MCP domain are independently deployed.

## Protected baseline

Future changes must not regress:

`WEB -> CLOUDFLARE -> RAILWAY -> POSTGRESQL -> OAUTH -> MCP -> tools/list -> projects.create -> CHATGPT`

## Promotion rule

This baseline is not v1.0.0. Promotion requires V4D-SAT certification of all 11 MCP tools, the complete stateful workflow, persistence/recovery, observability, security review and release documentation.
