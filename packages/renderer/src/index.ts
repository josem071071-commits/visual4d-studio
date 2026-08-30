import type { LayoutSpec, Rect } from "../../layout-engine/src/index.js";
import { validateLayoutSpec } from "../../layout-engine/src/index.js";

export type SafeRasterMediaType = "image/png" | "image/jpeg" | "image/webp";

export interface FlyerRenderContent {
  eyebrow?: string;
  headline: string;
  body: readonly string[];
  footer?: string;
  heroLabel?: string;
}

export type RenderElement =
  | { kind: "rect"; id: string; box: Rect; role: "BACKGROUND" | "HERO_PLACEHOLDER" | "ACCENT" }
  | { kind: "text"; id: string; box: Rect; role: "EYEBROW" | "HEADLINE" | "BODY" | "FOOTER" | "HERO_LABEL"; text: string; fontSize: number; maxLines: number; align: "left" | "center" | "right" }
  | { kind: "image"; id: string; box: Rect; role: "HERO_IMAGE"; mediaType: SafeRasterMediaType; dataUri: string; assetId: string; provenance: { sourceType: string; generatedByAI: boolean; documentary: boolean } };

export interface RenderSpec {
  version: "visual4d.render.v1";
  canvas: { width: number; height: number };
  elements: readonly RenderElement[];
}

export interface RenderValidationResult {
  valid: boolean;
  errors: readonly string[];
}

const MAX_INLINE_IMAGE_BYTES = 8_000_000;

function alignForBox(box: Rect, canvasWidth: number): "left" | "center" | "right" {
  const center = box.x + box.width / 2;
  if (Math.abs(center - canvasWidth / 2) < 80) return "center";
  return center < canvasWidth / 2 ? "left" : "right";
}

export function createFlyerRenderSpec(layout: LayoutSpec, content: FlyerRenderContent): RenderSpec {
  const validation = validateLayoutSpec(layout);
  if (!validation.valid) throw new Error(`INVALID_LAYOUT_SPEC:${validation.errors.join(",")}`);
  if (!content.headline.trim()) throw new Error("HEADLINE_REQUIRED");

  const elements: RenderElement[] = [
    { kind: "rect", id: "background", box: { x: 0, y: 0, width: layout.canvas.width, height: layout.canvas.height }, role: "BACKGROUND" },
    { kind: "rect", id: "hero", box: layout.regions.hero, role: "HERO_PLACEHOLDER" }
  ];

  if (content.eyebrow?.trim()) {
    elements.push({ kind: "text", id: "eyebrow", box: layout.regions.header, role: "EYEBROW", text: content.eyebrow.trim(), fontSize: 30, maxLines: 2, align: "left" });
  }

  elements.push({
    kind: "text",
    id: "headline",
    box: layout.regions.headline,
    role: "HEADLINE",
    text: content.headline.trim(),
    fontSize: layout.constraints.minHeadlineFontPx,
    maxLines: 3,
    align: alignForBox(layout.regions.headline, layout.canvas.width)
  });

  const bodyText = content.body.map((item) => item.trim()).filter(Boolean).join(" • ");
  if (bodyText) {
    elements.push({
      kind: "text",
      id: "body",
      box: layout.regions.content,
      role: "BODY",
      text: bodyText,
      fontSize: layout.constraints.minBodyFontPx,
      maxLines: layout.constraints.maxBodyLinesPerBlock,
      align: "left"
    });
  }

  if (content.heroLabel?.trim()) {
    elements.push({ kind: "text", id: "hero-label", box: layout.regions.hero, role: "HERO_LABEL", text: content.heroLabel.trim(), fontSize: 28, maxLines: 2, align: "center" });
  }

  if (content.footer?.trim()) {
    elements.push({ kind: "text", id: "footer", box: layout.regions.footer, role: "FOOTER", text: content.footer.trim(), fontSize: 28, maxLines: 2, align: "left" });
  }

  return { version: "visual4d.render.v1", canvas: layout.canvas, elements };
}

function insideCanvas(box: Rect, width: number, height: number): boolean {
  return box.x >= 0 && box.y >= 0 && box.width > 0 && box.height > 0 && box.x + box.width <= width && box.y + box.height <= height;
}

export function isSafeRasterDataUri(mediaType: SafeRasterMediaType, dataUri: string): boolean {
  const prefix = `data:${mediaType};base64,`;
  if (!dataUri.startsWith(prefix)) return false;
  const payload = dataUri.slice(prefix.length);
  if (!payload || payload.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(payload)) return false;
  const approximateBytes = Math.floor((payload.length * 3) / 4);
  return approximateBytes > 0 && approximateBytes <= MAX_INLINE_IMAGE_BYTES;
}

export function validateRenderSpec(spec: RenderSpec): RenderValidationResult {
  const errors: string[] = [];
  if (spec.canvas.width <= 0 || spec.canvas.height <= 0) errors.push("INVALID_CANVAS");
  const ids = new Set<string>();
  for (const element of spec.elements) {
    if (ids.has(element.id)) errors.push(`DUPLICATE_ID:${element.id}`);
    ids.add(element.id);
    if (!insideCanvas(element.box, spec.canvas.width, spec.canvas.height)) errors.push(`OUTSIDE_CANVAS:${element.id}`);
    if (element.kind === "text" && !element.text.trim()) errors.push(`EMPTY_TEXT:${element.id}`);
    if (element.kind === "image" && !isSafeRasterDataUri(element.mediaType, element.dataUri)) errors.push(`UNSAFE_IMAGE_DATA:${element.id}`);
  }
  return { valid: errors.length === 0, errors };
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function wrapText(text: string, box: Rect, fontSize: number, maxLines: number): string[] {
  const approxCharWidth = Math.max(1, fontSize * 0.56);
  const maxChars = Math.max(8, Math.floor(box.width / approxCharWidth));
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars || !current) {
      current = next;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length === maxLines - 1) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    const last = lines[maxLines - 1] ?? "";
    lines[maxLines - 1] = `${last.replace(/[.…]+$/u, "").slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
  }
  return lines;
}

function textAnchor(align: "left" | "center" | "right"): "start" | "middle" | "end" {
  return align === "center" ? "middle" : align === "right" ? "end" : "start";
}

function textX(element: Extract<RenderElement, { kind: "text" }>): number {
  if (element.align === "center") return element.box.x + element.box.width / 2;
  if (element.align === "right") return element.box.x + element.box.width;
  return element.box.x;
}

function roleFill(role: Extract<RenderElement, { kind: "rect" }>["role"]): string {
  if (role === "BACKGROUND") return "#ffffff";
  if (role === "HERO_PLACEHOLDER") return "#e8edf2";
  return "#d7dde5";
}

function textFill(role: Extract<RenderElement, { kind: "text" }>["role"]): string {
  return role === "EYEBROW" || role === "FOOTER" || role === "HERO_LABEL" ? "#4b5563" : "#111827";
}

export function renderSvg(spec: RenderSpec): string {
  const validation = validateRenderSpec(spec);
  if (!validation.valid) throw new Error(`INVALID_RENDER_SPEC:${validation.errors.join(",")}`);

  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${spec.canvas.width}" height="${spec.canvas.height}" viewBox="0 0 ${spec.canvas.width} ${spec.canvas.height}" role="img">`];
  for (const element of spec.elements) {
    if (element.kind === "rect") {
      parts.push(`<rect id="${escapeXml(element.id)}" x="${element.box.x}" y="${element.box.y}" width="${element.box.width}" height="${element.box.height}" fill="${roleFill(element.role)}"/>`);
      continue;
    }
    if (element.kind === "image") {
      parts.push(`<image id="${escapeXml(element.id)}" x="${element.box.x}" y="${element.box.y}" width="${element.box.width}" height="${element.box.height}" href="${escapeXml(element.dataUri)}" preserveAspectRatio="xMidYMid slice" data-asset-id="${escapeXml(element.assetId)}" data-source-type="${escapeXml(element.provenance.sourceType)}"/>`);
      continue;
    }
    const lines = wrapText(element.text, element.box, element.fontSize, element.maxLines);
    const lineHeight = Math.round(element.fontSize * 1.18);
    const x = textX(element);
    const startY = element.role === "HERO_LABEL" ? element.box.y + element.box.height / 2 : element.box.y + element.fontSize;
    parts.push(`<text id="${escapeXml(element.id)}" x="${x}" y="${startY}" font-family="Arial, Helvetica, sans-serif" font-size="${element.fontSize}" fill="${textFill(element.role)}" text-anchor="${textAnchor(element.align)}">`);
    lines.forEach((line, index) => {
      parts.push(`<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`);
    });
    parts.push("</text>");
  }
  parts.push("</svg>");
  return parts.join("");
}
