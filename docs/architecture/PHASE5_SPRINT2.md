# Phase 5 — Sprint 2: Persistence/Service/MCP Contract Layer

Sprint 2 adds an executable workflow service on top of the hardened domain core.

## Scope
- Repository contract plus executable in-memory adapter for deterministic tests.
- Project workflow service enforcing institution ownership, identity isolation, 9:16 format, version-specific approvals, and MASTER ASSET current-version integrity.
- Protocol-neutral MCP tool registry with narrow tool contracts. Binding to the official MCP SDK is intentionally deferred until the service semantics pass integration tests.
- PostgreSQL migration 0002 adds one-active-identity enforcement, provenance consistency, project stage/status consistency, and version tables.

## Explicit non-goals
- No image generation.
- No Chromium renderer.
- No ChatGPT UI.
- No network-facing MCP server yet.
- No production PostgreSQL adapter until the SQL migration is exercised against a real test database.

## Gate to Sprint 3
A complete in-memory Visual 4D workflow must pass: ANALYZE → approval → STRUCTURE → approval → RESOURCES → approval → ART DIRECTION → approval → GENERATE → VERIFY → FINAL, including negative tests for stale approvals, inactive master versions, and critical verification errors.
