import type { RenderElement, RenderSpec, SafeFontFamily } from "../../renderer/src/index.js";
import { validateRenderSpec } from "../../renderer/src/index.js";

export type FontToken = "SYSTEM_SANS" | "SYSTEM_SERIF" | "SYSTEM_MONO";

export interface VisualIdentityTokens {
  version: "visual4d.identity.v1";
  colors: {
    background: string;
    primary: string;
    text: string;
    mutedText: string;
    heroSurface: string;
  };
  typography: {
    family: FontToken;
  };
}

export interface IdentityValidationResult {
  valid: boolean;
  errors: readonly string[];
}

const HEX = /^#[0-9A-Fa-f]{6}$/;
const FONTS: Record<FontToken, SafeFontFamily> = {
  SYSTEM_SANS: "Arial, Helvetica, sans-serif",
  SYSTEM_SERIF: "Georgia, 'Times New Roman', serif",
  SYSTEM_MONO: "Courier New, Courier, monospace"
};

function channel(hex: string, offset: number): number {
  return Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
}

function linear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  if (!HEX.test(hex)) throw new Error("INVALID_HEX_COLOR");
  return 0.2126 * linear(channel(hex, 1)) + 0.7152 * linear(channel(hex, 3)) + 0.0722 * linear(channel(hex, 5));
}

export function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

export function validateIdentityTokens(tokens: VisualIdentityTokens): IdentityValidationResult {
  const errors: string[] = [];
  for (const [name, value] of Object.entries(tokens.colors)) {
    if (!HEX.test(value)) errors.push(`INVALID_COLOR:${name}`);
  }
  if (!(tokens.typography.family in FONTS)) errors.push("UNSAFE_FONT_TOKEN");
  if (errors.length === 0) {
    if (contrastRatio(tokens.colors.text, tokens.colors.background) < 4.5) errors.push("TEXT_BACKGROUND_CONTRAST_LOW");
    if (contrastRatio(tokens.colors.mutedText, tokens.colors.background) < 4.5) errors.push("MUTED_BACKGROUND_CONTRAST_LOW");
    if (contrastRatio(tokens.colors.primary, tokens.colors.background) < 4.5) errors.push("PRIMARY_BACKGROUND_CONTRAST_LOW");
  }
  return { valid: errors.length === 0, errors };
}

function styleElement(element: RenderElement, tokens: VisualIdentityTokens, family: SafeFontFamily): RenderElement {
  if (element.kind === "rect") {
    if (element.role === "BACKGROUND") return { ...element, fill: tokens.colors.background };
    if (element.role === "HERO_PLACEHOLDER") return { ...element, fill: tokens.colors.heroSurface };
    return { ...element, fill: tokens.colors.primary };
  }
  if (element.kind === "image") return element;
  if (element.role === "HEADLINE") return { ...element, fill: tokens.colors.primary, fontFamily: family };
  if (element.role === "BODY") return { ...element, fill: tokens.colors.text, fontFamily: family };
  return { ...element, fill: tokens.colors.mutedText, fontFamily: family };
}

export function applyIdentityTokens(spec: RenderSpec, tokens: VisualIdentityTokens): RenderSpec {
  const tokenValidation = validateIdentityTokens(tokens);
  if (!tokenValidation.valid) throw new Error(`INVALID_IDENTITY_TOKENS:${tokenValidation.errors.join(",")}`);
  const family = FONTS[tokens.typography.family];
  const styled: RenderSpec = { ...spec, elements: spec.elements.map((element) => styleElement(element, tokens, family)) };
  const renderValidation = validateRenderSpec(styled);
  if (!renderValidation.valid) throw new Error(`INVALID_STYLED_RENDER_SPEC:${renderValidation.errors.join(",")}`);
  return styled;
}
