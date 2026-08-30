import type { McpServer } from "@modelcontextprotocol/server";

export const RENDER_PREVIEW_RESOURCE_URI = "ui://visual4d/render-preview.html";
export const RENDER_PREVIEW_MIME_TYPE = "text/html+skybridge";

export const RENDER_PREVIEW_TOOL_META: Record<string, unknown> = {
  ui: { resourceUri: RENDER_PREVIEW_RESOURCE_URI, visibility: ["model", "app"] },
  "openai/outputTemplate": RENDER_PREVIEW_RESOURCE_URI,
  "openai/widgetAccessible": false,
  "openai/toolInvocation/invoking": "Componiendo vista previa Visual 4D…",
  "openai/toolInvocation/invoked": "Vista previa Visual 4D lista."
};

const RENDER_PREVIEW_HTML = String.raw`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Visual 4D Studio — Vista previa</title>
<style>
:root{color-scheme:light dark;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
*{box-sizing:border-box}body{margin:0;background:transparent;color:CanvasText}.shell{display:grid;gap:10px;padding:10px}.bar{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:12px;opacity:.8}.badge{font-weight:650}.frame{overflow:hidden;border:1px solid color-mix(in srgb,CanvasText 16%,transparent);border-radius:14px;background:#fff;box-shadow:0 8px 28px rgb(0 0 0/.08)}.canvas{width:100%;aspect-ratio:9/16;display:grid;place-items:center}.canvas svg{display:block;width:100%;height:100%}.fallback{padding:24px;text-align:center;line-height:1.45}.meta{font-size:11px;opacity:.65;overflow-wrap:anywhere}
</style>
</head>
<body>
<main class="shell" aria-live="polite">
  <div class="bar"><span class="badge">Visual 4D Studio</span><span>Preview determinista · solo lectura</span></div>
  <section class="frame"><div id="canvas" class="canvas"><div class="fallback">Preparando vista previa…</div></div></section>
  <div id="meta" class="meta"></div>
</main>
<script>
(() => {
  const canvas=document.getElementById('canvas');
  const meta=document.getElementById('meta');
  const output=window.openai?.toolOutput ?? null;
  const svg=output && typeof output.svg==='string' ? output.svg : '';
  const safe = svg.startsWith('<svg') && !/<script|<foreignObject|\son[a-z]+\s*=/i.test(svg);
  if(safe){ canvas.innerHTML=svg; }
  else { canvas.innerHTML='<div class="fallback">La vista previa se generó, pero el host no entregó un SVG renderizable al widget.</div>'; }
  const version=output && typeof output.version==='string' ? output.version : 'visual4d.render-service.v1';
  meta.textContent=version;
})();
</script>
</body>
</html>`;

export function registerRenderPreviewResource(server: McpServer): void {
  server.registerResource(
    "visual4d-render-preview",
    RENDER_PREVIEW_RESOURCE_URI,
    {
      title: "Visual 4D Render Preview",
      description: "Read-only inline preview surface for generation.render_preview.",
      mimeType: RENDER_PREVIEW_MIME_TYPE
    },
    async uri => ({
      contents: [{
        uri: uri.href,
        mimeType: RENDER_PREVIEW_MIME_TYPE,
        text: RENDER_PREVIEW_HTML,
        _meta: {
          ui: { csp: { connectDomains: [], resourceDomains: [] } },
          "openai/widgetPrefersBorder": true,
          "openai/widgetCSP": { connect_domains: [], resource_domains: [] }
        }
      }]
    })
  );
}
