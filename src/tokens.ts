// Single source of truth for palettes, fonts, scales, timings, counts.
// This is the ONLY file allowed to contain color literals (enforced by `npm run check:static`).
import type { AspectRatio, ColorName, EffectFamily, Intensity, Position, PresetName, Role } from "./types.ts";

export const COLORS: Record<ColorName, string> = {
  // --- Curated Cohesive Palette (2 main colors + 1 accent) ---
  canvasText: "#FAF8F5",       // Soft, high-contrast crisp warm white
  canvasBackdrop: "#11141A",   // Deep charcoal / obsidian backdrop
  canvasAccent: "#E5A83B",     // Warm golden amber (rich, editorial, readable)

  // Expressive mood accents
  accentEmerald: "#10B981",    // Crisp fresh green
  accentTeal: "#2DD4BF",       // Digital electric cyan
  accentRose: "#F43F5E",       // High-energy emphasis
  accentBlue: "#3B82F6",       // Clean corporate blue
  canvasMuted: "#94A3B8",      // Subtle secondary text
  canvasBorder: "#272E3B",     // Terminal & card border

  // --- Backwards-compatible mappings for legacy tokens ---
  ink: "#11141A",
  cream: "#FAF8F5",
  pink: "#F43F5E",
  yellow: "#E5A83B",
  sky: "#2DD4BF",
  mint: "#10B981",
  violet: "#8B5CF6",
  slateDark: "#11141A",
  slateMedium: "#1E293B",
  snowWhite: "#FAF8F5",
  emeraldAccent: "#10B981",
  electricBlue: "#3B82F6",
  amberGold: "#E5A83B",
  mutedGray: "#94A3B8",
  obsidianDark: "#0A0D12",
  charcoalCard: "#141822",
  platinumWhite: "#FAF8F5",
  goldenAmber: "#E5A83B",
  champagne: "#FDE68A",
  cinematicTeal: "#2DD4BF",
  deepCrimson: "#E11D48",
  quietWhite: "#FAF8F5",
  quietBackdrop: "#11141A",
  quietAmber: "#E5A83B",
  quietOchre: "#C88A3A",
  quietUnderline: "#E5A83B",
};

/** 5 Curated Effect Templates */
export const EFFECT_FAMILIES: EffectFamily[] = [
  "flicker-strobe",
  "kinetic-pop",
  "digital-decoder",
  "speed-slide",
  "typewriter-terminal",
];

/** Intensity settings: subtle (default), medium, bold */
export const INTENSITY_SETTINGS: Record<Intensity, {
  scaleOvershoot: number;
  flickerBeats: number;
  slideDistancePx: number;
  glitchSplitPx: number;
  typingCadenceMs: number;
}> = {
  subtle: { scaleOvershoot: 1.07, flickerBeats: 2, slideDistancePx: 14, glitchSplitPx: 1.5, typingCadenceMs: 40 },
  medium: { scaleOvershoot: 1.13, flickerBeats: 3, slideDistancePx: 24, glitchSplitPx: 3, typingCadenceMs: 50 },
  bold:   { scaleOvershoot: 1.20, flickerBeats: 3, slideDistancePx: 38, glitchSplitPx: 5, typingCadenceMs: 65 },
};

/** Consistent accent cycle: single refined accent to avoid circus rainbow distraction */
export const CYCLE: ColorName[] = ["canvasAccent", "canvasAccent"];

export function getPresetCycle(preset: PresetName): ColorName[] {
  switch (preset) {
    case "digital-decoder":
      return ["accentTeal", "canvasAccent"];
    case "flicker-strobe":
      return ["canvasAccent", "canvasAccent"];
    case "kinetic-pop":
      return ["canvasAccent", "accentRose"];
    case "speed-slide":
      return ["canvasAccent", "accentBlue"];
    case "typewriter-terminal":
      return ["canvasAccent", "accentEmerald"];
    case "quiet-art":
      return ["canvasAccent", "canvasAccent"];
    case "minimal-pro":
      return ["canvasAccent", "accentBlue"];
    case "cinematic":
      return ["canvasAccent", "canvasAccent"];
    case "playful-pop":
    default:
      return ["canvasAccent", "canvasAccent"];
  }
}

export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export interface FontSpec { family: string; weight: number; file: string; fallback: string }

export const FONTS: Record<Role, FontSpec> = {
  hero: { family: "EB Garamond", weight: 700, file: "EBGaramond-700.woff2", fallback: "'Garamond', 'Georgia', serif" },
  accent: { family: "EB Garamond", weight: 600, file: "EBGaramond-700.woff2", fallback: "'Garamond', 'Georgia', serif" },
  normal: { family: "EB Garamond", weight: 400, file: "EBGaramond-400.woff2", fallback: "'Garamond', 'Georgia', serif" },
  connector: { family: "EB Garamond", weight: 400, file: "EBGaramond-400.woff2", fallback: "'Garamond', 'Georgia', serif" },
};

export function getPresetFonts(preset: PresetName, overrideFamily?: string): Record<Role, FontSpec> {
  if (overrideFamily && overrideFamily !== "default") {
    const fallback = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    return {
      hero: { family: overrideFamily, weight: 700, file: "EBGaramond-700.woff2", fallback },
      accent: { family: overrideFamily, weight: 600, file: "EBGaramond-400.woff2", fallback },
      normal: { family: overrideFamily, weight: 400, file: "EBGaramond-400.woff2", fallback },
      connector: { family: overrideFamily, weight: 400, file: "EBGaramond-400.woff2", fallback },
    };
  }

  if (preset === "typewriter-terminal") {
    const fam = "JetBrains Mono";
    const fallback = "'JetBrains Mono', 'Fira Code', 'Courier New', monospace";
    return {
      hero: { family: fam, weight: 700, file: "EBGaramond-700.woff2", fallback },
      accent: { family: fam, weight: 600, file: "EBGaramond-400.woff2", fallback },
      normal: { family: fam, weight: 400, file: "EBGaramond-400.woff2", fallback },
      connector: { family: fam, weight: 400, file: "EBGaramond-400.woff2", fallback },
    };
  }

  if (preset === "kinetic-pop" || preset === "digital-decoder" || preset === "minimal-pro") {
    const fam = "Inter";
    const fallback = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    return {
      hero: { family: fam, weight: 700, file: "EBGaramond-700.woff2", fallback },
      accent: { family: fam, weight: 600, file: "EBGaramond-400.woff2", fallback },
      normal: { family: fam, weight: 400, file: "EBGaramond-400.woff2", fallback },
      connector: { family: fam, weight: 400, file: "EBGaramond-400.woff2", fallback },
    };
  }

  // flicker-strobe, speed-slide, quiet-art, cinematic
  const fam = "EB Garamond";
  const fallback = "'EB Garamond', 'Garamond', 'Georgia', serif";
  return {
    hero: { family: fam, weight: 700, file: "EBGaramond-700.woff2", fallback },
    accent: { family: fam, weight: 600, file: "EBGaramond-400.woff2", fallback },
    normal: { family: fam, weight: 400, file: "EBGaramond-400.woff2", fallback },
    connector: { family: fam, weight: 400, file: "EBGaramond-400.woff2", fallback },
  };
}

/** @font-face declarations to emit. */
export const FONT_FACES = [
  { family: "EB Garamond", file: "EBGaramond-400.woff2", weight: "400" },
  { family: "EB Garamond", file: "EBGaramond-700.woff2", weight: "700" },
  { family: "Fredoka", file: "Fredoka-Variable.woff2", weight: "300 700" },
  { family: "Lilita One", file: "LilitaOne-Regular.woff2", weight: "400" },
];

/** Scale ratios for roles. Subdued so the emphasized word stands out without ballooning. */
export const SCALE: Record<Role, number> = { hero: 1.15, accent: 1.05, normal: 1.0, connector: 0.95 };

export function getPresetScale(preset: PresetName): Record<Role, number> {
  switch (preset) {
    case "kinetic-pop":
      return { hero: 1.20, accent: 1.06, normal: 1.0, connector: 0.95 };
    case "flicker-strobe":
    case "digital-decoder":
    case "speed-slide":
    case "typewriter-terminal":
    default:
      return { hero: 1.12, accent: 1.04, normal: 1.0, connector: 0.95 };
  }
}

export const ROLE_OPACITY: Record<Role, number> = { hero: 1, accent: 1, normal: 1, connector: 0.92 };
export const BASE_FONT_PX = 56;

export function getPresetBaseFontPx(preset: PresetName, mult = 1): number {
  return BASE_FONT_PX * mult;
}

export const MIN_FONT_SCALE = 0.75;
export const MAX_ROT = 0; // Artistic zero tilt: keep captions clean and readable
export const MAX_ROT_HERO = 0;

export const STROKE_EM = 0; // Clean typography, no heavy comic stroke
export const SHADOW_EM = { x: 0, y: 0.04 };
export const BACKING_OUTLINE_EM = 0.03;

export const SAFE = { bottom: 0.12, side: 0.08, top: 0.06 };

export function getSafeArea(aspectRatio: AspectRatio, position: Position): { bottom: number; side: number; top: number } {
  if (aspectRatio === "9:16") {
    if (position === "center") return { bottom: 0.44, side: 0.08, top: 0.44 };
    if (position === "top") return { bottom: 0.80, side: 0.08, top: 0.14 };
    return { bottom: 0.22, side: 0.08, top: 0.06 };
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

/** Anti-Distraction timing: effects settle within 0.15s to 0.4s (5 to 11 frames @ 30fps) */
export const TIMING = {
  fps: 30,
  anticipation: 2,
  minRest: 6,
  exitFrames: 5,
  exitLineStagger: 1,
  minSpoken: 6,
  minPhase: 2,
  entranceFrames: {
    "flicker-strobe": 8,       // 0.27s: 2-3 soft beat flicker, settles to steady light
    "kinetic-pop": 8,          // 0.27s: scale overshoot, settles into readable still word
    "digital-decoder": 8,      // 0.27s: brief tech glyph decode, settles clean
    "speed-slide": 8,          // 0.27s: directional slide & settle
    "typewriter-terminal": 10, // 0.33s: human typing rhythm & soft cursor
    "clean-fade": 5,           // 0.17s: quiet fade for non-hero words
    "soft-rise": 8,            // 0.27s: subtle rise
    // Legacy aliases (all constrained <= 8 frames)
    "sticker-slap": 8, "spin-pop": 8, jelly: 8, "drop-bounce": 8, pop: 6, "wiggle-in": 8, "fade-pop": 4,
    "slide-fade-up": 6, "cinematic-drift": 6,
  } as Record<string, number>,
  markerWipe: 4,
  markerRelease: 3,
  underlineDraw: 6,
  squashFrames: 6,
  starFrames: 0,
  burstFrames: 0,
  burstFadeAt: 0,
  burstFadeFrames: 0,
  burstFadeTo: 0,
};

export const SPRING = { damping: 14, stiffness: 220, mass: 1 };

export const CAMERA = {
  shakeFrames: 0,
  shakeAmpPx: 0,
  shakeMinGap: 20,
  parallaxText: 0,
  parallaxBg: 0,
};

export const DECOR = {
  doodlesMin: 0,
  doodlesMax: 0,
  doodleSizePx: [0, 0] as [number, number],
  doodlePadPx: 0,
  floatAmpPx: 0,
  halftoneOpacity: 0,
  overlayOpacity: 0.04,
  gradientMaxOpacity: 0.35,
  confettiGravity: 0,
};

export const QUALITY = {
  preview: { confetti: [0, 0], stars: [0, 0], overlay: false, filters: false, renderScale: 0.5 },
  final: { confetti: [0, 0], stars: [0, 0], overlay: true, filters: true, renderScale: 1 },
} as const;

export const CHUNKING = { maxWords: 4, maxLines: 2, pauseMs: 250, tailMs: 200 };
