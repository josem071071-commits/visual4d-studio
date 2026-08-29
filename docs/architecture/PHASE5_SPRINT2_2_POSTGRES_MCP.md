# Phase 5 — Sprint 2.2 PostgreSQL + Local Authenticated MCP

## Scope

This sprint introduces the first real persistence adapter and first actual MCP HTTP boundary. It remains **development-only** and **loopback-only**. It is not yet a ChatGPT production deployment.

## PostgreSQL repository

`PostgresProjectRepository` implements the existing `ProjectRepository` contract with node-postgres (`pg`):

- optimistic project revisions;
- transactional identity activation;
- advisory transaction locks for artifact version allocation;
- exact-version approvals;
- persisted idempotency results;
- resource/asset loading;
- versioned analysis, structure, resources, art direction, design and verification records.

Migration `0004_sprint2_2_pg_mcp.sql` adds project-scoped design foreign keys so a verification or FINAL project cannot reference another project's design.

## MCP v2

The local server targets the stable MCP TypeScript SDK v2 (`@modelcontextprotocol/server` and `@modelcontextprotocol/node` 2.0.0) and Zod 4.4.3.

- Endpoint: `/mcp`
- Default bind: `127.0.0.1`
- Transport: Streamable HTTP through the official MCP v2 handler
- Authentication: development-only static Bearer token
- Actor identity: server-derived, never supplied as tool input
- Unauthorized requests: rejected before MCP processing

## Explicit user approval boundary

MCP cannot self-authorize an approval merely because the model calls an approval tool.

A separate endpoint `/local/approval-grants` requires:

- authenticated user;
- `x-visual4d-user-action: approve`;
- exact project, artifact kind and artifact version.

It mints a short-lived, one-time approval grant. `approvals.approve_stage` must consume that grant. This is a local prototype for a future UI-confirmation / OAuth-backed approval flow.

## Important limitation

The loopback Bearer-token server is for local integration tests/Inspector only. ChatGPT cloud cannot use `127.0.0.1` as a production app endpoint. A later sprint must deploy HTTPS and replace static local auth with the production authentication mechanism supported by the ChatGPT/App environment.

## Dependency gate

The execution environment used to build this artifact cannot access npm reliably, so the previous stale lockfile was removed rather than falsified. On a network-connected development machine the mandatory gate is:

```bash
npm install
npm run build:integration
npm test
npm run test:postgres-migration
npm run test:integration:postgres
npm run test:integration:mcp
```

Commit the newly generated lockfile only after this clean connected build succeeds.
