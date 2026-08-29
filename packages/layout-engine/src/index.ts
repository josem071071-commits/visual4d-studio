export interface LayoutIntent {
  headlineProminence: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
  headlineZone: "UPPER_LEFT" | "UPPER_CENTER" | "UPPER_RIGHT";
  heroZone: "UPPER" | "CENTER" | "LOWER" | "RIGHT" | "LEFT";
  negativeSpace: "LOW" | "MEDIUM" | "HIGH";
  textDensity: "LOW" | "MEDIUM" | "HIGH";
  alignment: "LEFT_DOMINANT" | "CENTERED" | "RIGHT_DOMINANT" | "BALANCED";
}

export interface Rect { x: number; y: number; width: number; height: number; }

export interface FlyerRegions {
  header: Rect;
  headline: Rect;
  hero: Rect;
  content: Rect;
  footer: Rect;
}

export interface LayoutSpec {
  canvas: { width: number; height: number };
  safeArea: { top: number; right: number; bottom: number; left: number };
  regions: FlyerRegions;
  constraints: {
    minBodyFontPx: number;
    minHeadlineFontPx: number;
    maxBodyLinesPerBlock: number;
  };
}

export function solveNineSixteenFlyer(intent: LayoutIntent): LayoutSpec {
  const canvas = { width: 1080, height: 1920 };
  const safe = { top: 72, right: 64, bottom: 72, left: 64 };
  const innerWidth = canvas.width - safe.left - safe.right;

  // Deterministic baseline solver for v0.1.1. The contract is intentionally
  // region-based; richer candidate scoring is deferred to Sprint 2.
  const headlineHeight = intent.headlineProminence === "VERY_HIGH" ? 260 : 210;
  const heroHeight = intent.heroZone === "CENTER" ? 660 : 600;
  const topY = 190;

  return {
    canvas,
    safeArea: safe,
    regions: {
      header: { x: safe.left, y: safe.top, width: innerWidth, height: 100 },
      headline: { x: safe.left, y: topY, width: innerWidth, height: headlineHeight },
      hero: { x: safe.left, y: topY + headlineHeight + 28, width: innerWidth, height: heroHeight },
      content: {
        x: safe.left,
        y: topY + headlineHeight + heroHeight + 56,
        width: innerWidth,
        height: 430
      },
      footer: { x: safe.left, y: 1748, width: innerWidth, height: 100 }
    },
    constraints: {
      minBodyFontPx: 30,
      minHeadlineFontPx: 58,
      maxBodyLinesPerBlock: 4
    }
  };
}
