// THE caption design system tokens: single source of truth for palettes, fonts, scales, timings, counts.
// This is the ONLY file allowed to contain color literals (enforced by `npm run check`).
import type { AspectRatio, ColorName, Position, PresetName, Role } from "./types.ts";

export const COLORS: Record<ColorName, string> = {
  // Playful Pop palette
  ink: "#1B1B2F",
  cream: "#FFF8E7",
  pink: "#FF3D8B",
  yellow: "#FFD93D",
  sky: "#4CC9F0",
  mint: "#3DDC97",
  violet: "#7B5CFF",
  // Minimal Professional palette
  slateDark: "#0F172A",
  slateMedium: "#1E293B",
  snowWhite: "#F8FAFC",
  emeraldAccent: "#10B981",
  electricBlue: "#3B82F6",
  amberGold: "#F59E0B",
  mutedGray: "#94A3B8",
  // Cinematic Modern palette
  obsidianDark: "#0A0A0F",
  charcoalCard: "#14141E",
  platinumWhite: "#F1F5F9",
  goldenAmber: "#EAB308",
  champagne: "#FDE68A",
  cinematicTeal: "#2DD4BF",
  deepCrimson: "#E11D48",
  // Quiet Art palette (calm, warm, editorial)
  quietWhite: "#FAF8F5",
  quietBackdrop: "#121110",
  quietAmber: "#D97736",
  quietOchre: "#C88A3A",
  quietUnderline: "#D97736",
};

/** Hero + accent words walk this cycle (global counter => never the same color twice in a row). */
export const CYCLE: ColorName[] = ["pink", "yellow", "sky", "mint", "violet"];

export function getPresetCycle(preset: PresetName): ColorName[] {
  switch (preset) {
    case "quiet-art":
      return ["quietAmber", "quietOchre"];
    case "minimal-pro":
      return ["emeraldAccent", "electricBlue", "amberGold"];
    case "cinematic":
      return ["goldenAmber", "champagne", "cinematicTeal"];
    case "playful-pop":
    default:
      return CYCLE;
  }
}

export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export interface FontSpec { family: string; weight: number; file: string; fallback: string }

export const FONTS: Record<Role, FontSpec> = {
  hero: { family: "Lilita One", weight: 400, file: "LilitaOne-Regular.woff2", fallback: "'Arial Black', sans-serif" },
  accent: { family: "Fredoka", weight: 700, file: "Fredoka-Variable.woff2", fallback: "'Arial Rounded MT Bold', sans-serif" },
  normal: { family: "Fredoka", weight: 600, file: "Fredoka-Variable.woff2", fallback: "'Arial Rounded MT Bold', sans-serif" },
  connector: { family: "Fredoka", weight: 500, file: "Fredoka-Variable.woff2", fallback: "'Arial Rounded MT Bold', sans-serif" },
};

export function getPresetFonts(preset: PresetName, overrideFamily?: string): Record<Role, FontSpec> {
  if (preset === "quiet-art") {
    const fam = overrideFamily || "EB Garamond";
    const fallback = "'EB Garamond', 'Garamond', 'Baskerville', 'Georgia', serif";
    return {
      hero: { family: fam, weight: 700, file: "EBGaramond-700.woff2", fallback },
      accent: { family: fam, weight: 400, file: "EBGaramond-400.woff2", fallback },
      normal: { family: fam, weight: 400, file: "EBGaramond-400.woff2", fallback },
      connector: { family: fam, weight: 400, file: "EBGaramond-400.woff2", fallback },
    };
  }
  if (preset === "minimal-pro") {
    const fam = overrideFamily || "Inter";
    const fallback = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    return {
      hero: { family: fam, weight: 800, file: "Inter-Variable.woff2", fallback },
      accent: { family: fam, weight: 700, file: "Inter-Variable.woff2", fallback },
      normal: { family: fam, weight: 600, file: "Inter-Variable.woff2", fallback },
      connector: { family: fam, weight: 500, file: "Inter-Variable.woff2", fallback },
    };
  }
  if (preset === "cinematic") {
    const fam = overrideFamily || "Montserrat";
    const fallback = "'Cinzel', 'Trebuchet MS', 'Georgia', 'Arial', sans-serif";
    return {
      hero: { family: fam, weight: 800, file: "Montserrat-Variable.woff2", fallback },
      accent: { family: fam, weight: 700, file: "Montserrat-Variable.woff2", fallback },
      normal: { family: fam, weight: 600, file: "Montserrat-Variable.woff2", fallback },
      connector: { family: fam, weight: 500, file: "Montserrat-Variable.woff2", fallback },
    };
  }
  if (overrideFamily) {
    return {
      hero: { family: overrideFamily, weight: 700, file: "LilitaOne-Regular.woff2", fallback: "'Arial Black', sans-serif" },
      accent: { family: overrideFamily, weight: 700, file: "Fredoka-Variable.woff2", fallback: "'Arial Rounded MT Bold', sans-serif" },
      normal: { family: overrideFamily, weight: 600, file: "Fredoka-Variable.woff2", fallback: "'Arial Rounded MT Bold', sans-serif" },
      connector: { family: overrideFamily, weight: 500, file: "Fredoka-Variable.woff2", fallback: "'Arial Rounded MT Bold', sans-serif" },
    };
  }
  return FONTS;
}

/** @font-face declarations to emit. */
export const FONT_FACES = [
  { family: "Lilita One", file: "LilitaOne-Regular.woff2", weight: "400" },
  { family: "Fredoka", file: "Fredoka-Variable.woff2", weight: "300 700" },
  { family: "EB Garamond", file: "EBGaramond-400.woff2", weight: "400" },
  { family: "EB Garamond", file: "EBGaramond-700.woff2", weight: "700" },
];

export const SCALE: Record<Role, number> = { hero: 2.0, accent: 1.35, normal: 1.0, connector: 0.6 };

export function getPresetScale(preset: PresetName): Record<Role, number> {
  switch (preset) {
    case "quiet-art":
      return { hero: 1.12, accent: 1.0, normal: 1.0, connector: 0.95 };
    case "minimal-pro":
      return { hero: 1.32, accent: 1.16, normal: 1.0, connector: 0.88 };
    case "cinematic":
      return { hero: 1.35, accent: 1.18, normal: 1.0, connector: 0.88 };
    case "playful-pop":
    default:
      return SCALE;
  }
}

export const ROLE_OPACITY: Record<Role, number> = { hero: 1, accent: 1, normal: 1, connector: 0.9 };
export const BASE_FONT_PX = 78;           // x unit

export function getPresetBaseFontPx(preset: PresetName, mult = 1): number {
  switch (preset) {
    case "quiet-art":
      return 54 * mult;
    case "minimal-pro":
      return 64 * mult;
    case "cinematic":
      return 60 * mult;
    case "playful-pop":
    default:
      return BASE_FONT_PX * mult;
  }
}

export const MIN_FONT_SCALE = 0.7;        // never shrink chunk text below 70%
export const MAX_ROT = 4;                 // resting rotation, degrees
export const MAX_ROT_HERO = 6;

/** Sticker text treatment. STROKE_EM is the *visible outer* width; CSS stroke is centred so it is doubled. */
export const STROKE_EM = 0.09;
export const SHADOW_EM = { x: 0.06, y: 0.08 };
export const BACKING_OUTLINE_EM = 0.05;

export const SAFE = { bottom: 0.12, side: 0.08, top: 0.06 };

export function getSafeArea(aspectRatio: AspectRatio, position: Position): { bottom: number; side: number; top: number } {
  if (aspectRatio === "9:16") {
    if (position === "center") return { bottom: 0.44, side: 0.08, top: 0.44 };
    if (position === "top") return { bottom: 0.80, side: 0.08, top: 0.14 };
    return { bottom: 0.22, side: 0.08, top: 0.06 }; // bottom is safe above TikTok/Reels UI
  }
  if (position === "center") return { bottom: 0.44, side: 0.08, top: 0.44 };
  if (position === "top") return { bottom: 0.82, side: 0.08, top: 0.08 };
  return { bottom: 0.12, side: 0.08, top: 0.06 };
}

export const ASPECT_DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
};

export const TIMING = {
  fps: 30,
  anticipation: 2,        // entrance starts this many frames before the spoken start
  minRest: 6,
  exitFrames: 6,
  exitLineStagger: 1,
  minSpoken: 6,
  minPhase: 2,            // floor when durations are shortened
  entranceFrames: {
    "sticker-slap": 8, "spin-pop": 8, jelly: 8, "drop-bounce": 8, pop: 6, "wiggle-in": 8, "fade-pop": 4,
    "clean-fade": 4, "slide-fade-up": 5, "cinematic-drift": 6, "soft-rise": 10,
  } as Record<string, number>,
  markerWipe: 4,
  markerRelease: 3,
  underlineDraw: 6,
  squashFrames: 9,
  starFrames: 14,
  burstFrames: 8,
  burstFadeAt: 12,
  burstFadeFrames: 4,
  burstFadeTo: 0.3,
};

export const SPRING = { damping: 9, stiffness: 260, mass: 1 };

export const CAMERA = {
  shakeFrames: 4,
  shakeAmpPx: 6,          // x unit
  shakeMinGap: 20,
  parallaxText: 0.04,
  parallaxBg: 0.02,
};

export const DECOR = {
  doodlesMin: 3,
  doodlesMax: 6,
  doodleSizePx: [70, 120] as [number, number], // x unit
  doodlePadPx: 36,
  floatAmpPx: 4,
  halftoneOpacity: 0.18,
  overlayOpacity: 0.06,
  gradientMaxOpacity: 0.35,
  confettiGravity: 1800,  // px/s^2 x unit
};

export const QUALITY = {
  preview: { confetti: [6, 6], stars: [4, 4], overlay: false, filters: false, renderScale: 0.5 },
  final: { confetti: [12, 20], stars: [6, 8], overlay: true, filters: true, renderScale: 1 },
} as const;

export const CHUNKING = { maxWords: 6, maxLines: 2, pauseMs: 250, tailMs: 200 };
