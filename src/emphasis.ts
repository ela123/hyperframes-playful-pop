// Emphasis while spoken. Pure functions of f = frames since the word's spoken start.
// Strict anti-distraction rules:
// - Never apply emphasis to every word or line.
// - Max 1 element highlighted per caption chunk.
// - Settle cleanly into a static, readable state.
import type { EmphasisName, PresetName, Role } from "./types.ts";
import { clamp01, easeOutCubic } from "./lib/easing.ts";

export function pickEmphasis(
  role: Role,
  seed: number,
  prevAccent: EmphasisName | null,
  preset: PresetName = "kinetic-pop",
): EmphasisName[] {
  // Only the hero receives emphasis; non-hero words stay clean and still
  if (role !== "hero") return [];

  switch (preset) {
    case "flicker-strobe":
    case "cinematic":
      return ["soft-glow"];
    case "digital-decoder":
      return ["decoder-glitch"];
    case "typewriter-terminal":
    case "quiet-art":
      return ["cursor-blink"];
    case "speed-slide":
    case "minimal-pro":
      return ["accent-color"];
    case "kinetic-pop":
    case "playful-pop":
    default:
      return ["pop-overshoot", "accent-color"];
  }
}

export interface EmphasisState {
  rot: number;
  sx: number;
  sy: number;
  marker: number;
  markerActive: boolean;
  underline: number;
  stars: number;
  glow: number;
  glitchActive: boolean;
  cursorVisible: boolean;
}

export const NO_EMPHASIS: EmphasisState = {
  rot: 0, sx: 1, sy: 1, marker: 0, markerActive: false, underline: 0, stars: -1,
  glow: 0, glitchActive: false, cursorVisible: false,
};

export function emphasisState(names: EmphasisName[], f: number, dur: number, wobbleSign: number): EmphasisState {
  const s: EmphasisState = { ...NO_EMPHASIS };
  if (f < 0 || names.length === 0) return s;

  for (const n of names) {
    switch (n) {
      case "soft-glow": {
        // Soft ambient warm glow during spoken window, smoothly settling
        const progress = clamp01(f / Math.max(dur, 1));
        s.glow = easeOutCubic(1 - Math.abs(progress - 0.5) * 0.8);
        s.markerActive = f >= 0 && f < dur + 2;
        break;
      }

      case "decoder-glitch": {
        // Only glitch/decode during the first 6-8 frames (<= 0.27s), then 100% still
        s.glitchActive = f >= 0 && f < 7;
        s.markerActive = f >= 0;
        break;
      }

      case "cursor-blink": {
        // Subtle terminal cursor blink (2 blinks per second, soft)
        const blinkCycle = Math.floor(f / 8) % 2 === 0;
        s.cursorVisible = blinkCycle && f >= 0 && f < dur + 6;
        s.markerActive = f >= 0;
        break;
      }

      case "pop-overshoot":
      case "accent-color": {
        s.markerActive = f >= 0 && f < dur + 2;
        break;
      }

      // Legacy fallback handlers
      case "pill-highlight":
      case "marker-highlight": {
        s.marker = clamp01(f / 4);
        s.markerActive = f >= 0 && f < dur + 2;
        break;
      }
      case "cinematic-glow": {
        s.glow = clamp01(f / 6);
        s.markerActive = f >= 0 && f < dur + 2;
        break;
      }
      case "quiet-underline":
      case "doodle-underline": {
        s.underline = clamp01(f / 6);
        s.markerActive = f >= 0;
        break;
      }
      case "wobble":
      case "squash-bounce":
      case "star-burst":
        break;
    }
  }

  return s;
}

export function starState(p: number, angle: number, dist: number): { x: number; y: number; o: number; s: number } {
  return { x: 0, y: 0, o: 0, s: 0 };
}

