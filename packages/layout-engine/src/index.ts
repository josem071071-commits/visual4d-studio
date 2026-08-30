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

export interface LayoutValidationResult {
  valid: boolean;
  errors: readonly string[];
}

const CANVAS = { width: 1080, height: 1920 } as const;
const SAFE = { top: 72, right: 64, bottom: 72, left: 64 } as const;
const GAP = 28;

function headlineHeight(prominence: LayoutIntent["headlineProminence"]): number {
  switch (prominence) {
    case "LOW": return 150;
    case "MEDIUM": return 190;
    case "HIGH": return 225;
    case "VERY_HIGH": return 260;
  }
}

function headlineWidth(zone: LayoutIntent["headlineZone"], innerWidth: number): number {
  return zone === "UPPER_CENTER" ? Math.round(innerWidth * 0.82) : Math.round(innerWidth * 0.76);
}

function horizontalX(zone: LayoutIntent["headlineZone"], width: number, innerWidth: number): number {
  if (zone === "UPPER_LEFT") return SAFE.left;
  if (zone === "UPPER_RIGHT") return SAFE.left + innerWidth - width;
  return SAFE.left + Math.round((innerWidth - width) / 2);
}

function textConstraints(intent: LayoutIntent): LayoutSpec["constraints"] {
  return {
    minBodyFontPx: intent.textDensity === "HIGH" ? 28 : intent.textDensity === "MEDIUM" ? 30 : 32,
    minHeadlineFontPx: intent.headlineProminence === "VERY_HIGH" ? 64 : intent.headlineProminence === "HIGH" ? 60 : 56,
    maxBodyLinesPerBlock: intent.textDensity === "HIGH" ? 6 : intent.textDensity === "MEDIUM" ? 5 : 4
  };
}

export function solveNineSixteenFlyer(intent: LayoutIntent): LayoutSpec {
  const innerWidth = CANVAS.width - SAFE.left - SAFE.right;
  const topY = 190;
  const hHeight = headlineHeight(intent.headlineProminence);
  const hWidth = headlineWidth(intent.headlineZone, innerWidth);
  const headline: Rect = {
    x: horizontalX(intent.headlineZone, hWidth, innerWidth),
    y: topY,
    width: hWidth,
    height: hHeight
  };

  const contentBottom = CANVAS.height - SAFE.bottom - 128;
  const heroTop = headline.y + headline.height + GAP;
  let hero: Rect;
  let content: Rect;

  if (intent.heroZone === "RIGHT" || intent.heroZone === "LEFT") {
    const columnGap = intent.negativeSpace === "HIGH" ? 48 : 32;
    const heroWidth = Math.round(innerWidth * (intent.negativeSpace === "HIGH" ? 0.50 : 0.54));
    const contentWidth = innerWidth - heroWidth - columnGap;
    const sideHeight = Math.min(900, contentBottom - heroTop);
    const heroX = intent.heroZone === "LEFT" ? SAFE.left : SAFE.left + innerWidth - heroWidth;
    const contentX = intent.heroZone === "LEFT" ? heroX + heroWidth + columnGap : SAFE.left;
    hero = { x: heroX, y: heroTop, width: heroWidth, height: sideHeight };
    content = { x: contentX, y: heroTop, width: contentWidth, height: sideHeight };
  } else {
    const heroHeight = intent.heroZone === "CENTER" ? 660 : intent.heroZone === "UPPER" ? 560 : 500;
    const heroY = intent.heroZone === "LOWER" ? heroTop + 360 : heroTop;
    hero = { x: SAFE.left, y: heroY, width: innerWidth, height: heroHeight };

    if (intent.heroZone === "LOWER") {
      content = { x: SAFE.left, y: heroTop, width: innerWidth, height: 320 };
    } else {
      const contentY = hero.y + hero.height + GAP;
      content = { x: SAFE.left, y: contentY, width: innerWidth, height: Math.max(220, contentBottom - contentY) };
    }
  }

  return {
    canvas: CANVAS,
    safeArea: SAFE,
    regions: {
      header: { x: SAFE.left, y: SAFE.top, width: innerWidth, height: 100 },
      headline,
      hero,
      content,
      footer: { x: SAFE.left, y: 1748, width: innerWidth, height: 100 }
    },
    constraints: textConstraints(intent)
  };
}

function rectInsideSafeArea(rect: Rect, spec: LayoutSpec): boolean {
  const minX = spec.safeArea.left;
  const maxX = spec.canvas.width - spec.safeArea.right;
  const minY = spec.safeArea.top;
  const maxY = spec.canvas.height - spec.safeArea.bottom;
  return rect.x >= minX && rect.y >= minY && rect.x + rect.width <= maxX && rect.y + rect.height <= maxY;
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function validateLayoutSpec(spec: LayoutSpec): LayoutValidationResult {
  const errors: string[] = [];
  if (spec.canvas.width !== 1080 || spec.canvas.height !== 1920) errors.push("CANVAS_MUST_BE_1080X1920");

  const entries = Object.entries(spec.regions) as Array<[keyof FlyerRegions, Rect]>;
  for (const [name, rect] of entries) {
    if (rect.width <= 0 || rect.height <= 0) errors.push(`${String(name).toUpperCase()}_NON_POSITIVE_SIZE`);
    if (!rectInsideSafeArea(rect, spec)) errors.push(`${String(name).toUpperCase()}_OUTSIDE_SAFE_AREA`);
  }

  const pairs: Array<[keyof FlyerRegions, keyof FlyerRegions]> = [
    ["header", "headline"],
    ["headline", "hero"],
    ["headline", "content"],
    ["hero", "content"],
    ["hero", "footer"],
    ["content", "footer"]
  ];
  for (const [a, b] of pairs) {
    if (overlaps(spec.regions[a], spec.regions[b])) errors.push(`${String(a).toUpperCase()}_${String(b).toUpperCase()}_OVERLAP`);
  }

  return { valid: errors.length === 0, errors };
}
