import type { Visual4DProductionScope } from "./production-auth.js";

export const VISUAL4D_TOOL_SCOPES: Readonly<Record<string, readonly Visual4DProductionScope[]>> = {
  "generation.render_preview": ["visual4d:render"],
  "projects.create": ["visual4d:write"],
  "method.analyze": ["visual4d:write"],
  "method.structure": ["visual4d:write"],
  "method.resolve_resources": ["visual4d:write"],
  "method.art_direct": ["visual4d:write"],
  "generation.create_design": ["visual4d:write"],
  "verification.save": ["visual4d:write"],
  "versions.mark_final": ["visual4d:write"],
  "approvals.approve_stage": ["visual4d:approve"],
  "identity.activate_version": ["visual4d:identity"]
};

export function requiredScopesForTool(toolName:string):readonly Visual4DProductionScope[] {
  const scopes=VISUAL4D_TOOL_SCOPES[toolName];
  if(!scopes) throw new Error(`PRODUCTION_SCOPE_POLICY_MISSING:${toolName}`);
  return scopes;
}
