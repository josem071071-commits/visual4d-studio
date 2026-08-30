# Visual 4D Studio — Security Policy

## Security principles
Visual 4D Studio is designed around explicit authorization, least privilege, deterministic verification and separation between users/projects.

## Credentials
Never place passwords, API keys, OAuth client secrets, refresh tokens or Bearer tokens in issues, screenshots, commits, documentation examples or support messages.

The existing `VISUAL4D_STAGING_AUTH_TOKEN` is a staging credential and is not a production user-authentication mechanism.

## Production authentication target
Production user access must use per-user authorization (OAuth 2.1/OIDC compatible), short-lived access tokens, validated issuer/audience/expiry/signature and least-privilege scopes.

Shared static production tokens are prohibited for end-user access.

## Approval boundary
Actions that approve gated Visual 4D workflow stages must require explicit user intent and authorization. Generic write permission must not silently imply approval permission.

## Master assets
Assets designated as MASTER ASSETS must not be generatively modified or reinterpreted by the system unless the user explicitly replaces the source asset through an authorized workflow.

## Reporting a vulnerability
Until a dedicated security mailbox/domain is established, use the repository owner's private contact channel rather than a public GitHub issue for sensitive vulnerability details.

Before public launch this section must be updated with a dedicated security contact and response expectations.

## Disclosure
Do not publish secrets, exploit details affecting an unpatched deployment, or personal user data in a public report.
