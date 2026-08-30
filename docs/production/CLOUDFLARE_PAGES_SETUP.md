# Visual 4D Studio — Cloudflare Pages Deployment

Target public site: `https://www.visual4dstudio.com`

## Source

- GitHub repository: `josem071071-commits/visual4d-studio`
- Production branch: `main`
- Static output directory: `website`
- Build command: none
- Framework preset: None / static HTML

The `website/` directory contains:

- `/` — product landing page
- `/privacy` — privacy policy
- `/terms` — terms of service
- `/support` — support information
- `/security` — security policy

Clean routes are supplied through `website/_redirects`.

## Cloudflare Pages procedure

1. In Cloudflare Dashboard open **Workers & Pages**.
2. Create a Pages application using **Connect to Git**.
3. Authorize/select the GitHub repository `josem071071-commits/visual4d-studio`.
4. Use production branch `main`.
5. Framework preset: **None**.
6. Build command: leave empty.
7. Build output directory: `website`.
8. Deploy and wait for the generated `*.pages.dev` URL to become healthy.
9. In the Pages project open **Custom domains** and add `www.visual4dstudio.com`.
10. Allow Cloudflare to create/adjust only the DNS record required for `www`.
11. Keep `mcp.visual4dstudio.com` unchanged; it belongs to Railway/MCP transport.

## Verification

All of these URLs must return HTTP 200 over HTTPS:

- `https://www.visual4dstudio.com/`
- `https://www.visual4dstudio.com/privacy`
- `https://www.visual4dstudio.com/terms`
- `https://www.visual4dstudio.com/support`
- `https://www.visual4dstudio.com/security`

The home page must identify Visual 4D Studio and the legal pages must display the operator/contact data currently recorded in `docs/public/app-manifest.public.json`.

## Manifest promotion after verification

Only after live verification set:

- `legal.privacy_url` → `https://www.visual4dstudio.com/privacy`
- `legal.terms_url` → `https://www.visual4dstudio.com/terms`
- `legal.support_url` → `https://www.visual4dstudio.com/support`
- `legal.security_url` → `https://www.visual4dstudio.com/security`

Do **not** set `publication_ready=true` at this stage. OAuth production/callback and branding gates remain independent.

## Rollback

If the Pages deployment or custom domain fails:

1. remove only the `www` custom-domain mapping created for Pages;
2. do not edit or delete the `mcp` CNAME/TXT records;
3. leave the source files in GitHub and correct the Pages configuration before retrying.
