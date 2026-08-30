# Visual 4D Studio — App Submission Checklist

Use this checklist immediately before any ChatGPT/OpenAI app submission. Revalidate against the current submission UI and developer guidelines because platform requirements can change.

## Product
- [ ] Official app name approved.
- [ ] Short and long descriptions approved.
- [ ] Example prompts accurately describe available capabilities.
- [ ] No claim implies a capability that has not been certified.

## Branding
- [ ] Final icon approved and exported at required sizes.
- [ ] Wordmark approved.
- [ ] Screenshots use the real product experience.
- [ ] Third-party marks are used only with appropriate rights.

## Legal and privacy
- [ ] Privacy Policy published at stable HTTPS URL.
- [ ] Terms published at stable HTTPS URL.
- [ ] Support URL/contact published.
- [ ] Security reporting process published.
- [ ] Operator/legal identity finalized.
- [ ] Data collection, purpose, retention and deletion disclosures match production behavior.
- [ ] Third-party processors/subprocessors reviewed and disclosed where required.

## Authentication and authorization
- [ ] No shared staging Bearer token used by end users.
- [ ] OAuth/OIDC authorization works per user.
- [ ] Least-privilege scopes implemented.
- [ ] Token expiry and revocation verified.
- [ ] User disconnect removes/revokes access as designed.
- [ ] Tenant/user isolation tests pass.

## Tools and actions
- [ ] Tool inventory matches production MCP discovery.
- [ ] Read/write classifications are accurate.
- [ ] Read-only tools do not create hidden external side effects.
- [ ] Write actions require appropriate user/app permissions.
- [ ] Approval actions preserve explicit Visual 4D approval gates.

## Apps SDK UI
- [ ] UI resources load over the production integration.
- [ ] CSP/network permissions are minimal.
- [ ] Structured content is sufficient for the widget without leaking secrets.
- [ ] Error states are understandable and safe.

## Reliability
- [ ] Health endpoint passes.
- [ ] Production MCP endpoint passes authenticated discovery.
- [ ] `generation.render_preview` passes production smoke test.
- [ ] PostgreSQL migration and rollback/recovery plan reviewed.
- [ ] Monitoring and incident response ownership assigned.

## Submission
- [ ] Re-read current OpenAI developer/submission guidelines on submission day.
- [ ] Confirm current directory/plugin packaging requirements.
- [ ] Confirm plan/workspace eligibility for testing and publishing.
- [ ] Save a copy of the exact submitted metadata and version/commit SHA.

Final rule: submit only when every applicable item is checked and `publication_ready` in the public metadata can truthfully be changed to `true`.
