// Entrances: pure functions of progress p (0..1 over the entrance) -> transform state.
// All effects adhere to anti-distraction rules:
// - Settle strictly within 0.15 to 0.4 seconds.
// - Max 1 effect per caption chunk.
// - Text settles into a clean, 100% still, readable state.
import type { AnimationStyle, EntranceName, Intensity, PresetName, Role } from "./types.ts";
import { INTENSITY_SETTINGS, TIMING } from "./tokens.ts";
import { clamp01, easeOutCubic, lerp, springEase } from "./lib/easing.ts";

export interface XForm { o: number; sx: number; sy: number; rot: number; x: number; y: number }
export const IDENTITY: XForm = { o: 1, sx: 1, sy: 1, rot: 0, x: 0, y: 0 };
export const HIDDEN: XForm = { o: 0, sx: 1, sy: 1, rot: 0, x: 0, y: 0 };

export const entranceFrames = (name: EntranceName): number => TIMING.entranceFrames[name] || 8;

/** Entrance chosen by ROLE and EFFECT. Enforces strictly max 1 effect per caption. */
export function pickEntrance(
  role: Role,
  counters: { hero: number; accent: number; normal: number },
  preset: PresetName = "kinetic-pop",
  animStyle: AnimationStyle = "default",
): EntranceName {
  if (animStyle === "static") return "clean-fade";
  if (animStyle === "subtle-fade") return "clean-fade";

  // Only the hero element gets the active curated effect!
  // Normal and connector words receive a clean, quiet fade to prevent visual competition.
  if (role === "hero") {
    switch (preset) {
      case "flicker-strobe":
      case "cinematic":
        return "flicker-strobe";
      case "digital-decoder":
        return "digital-decoder";
      case "speed-slide":
      case "minimal-pro":
        return "speed-slide";
      case "typewriter-terminal":
      case "quiet-art":
        return "typewriter-terminal";
      case "kinetic-pop":
      case "playful-pop":
      default:
        return "kinetic-pop";
    }
  }

  return "clean-fade";
}

/** Pure transform calculation for frame progress p (0..1) */
export function entranceState(
  name: EntranceName,
  p: number,
  u = 1,
  wobbleSign = 1,
  intensity: Intensity = "subtle",
): XForm {
  if (p < 0) return HIDDEN;
  if (p >= 1) return IDENTITY;

  const config = INTENSITY_SETTINGS[intensity] || INTENSITY_SETTINGS.subtle;
  const fadeIn = (k: number): number => clamp01(p * k);

  switch (name) {
    // 1. Flicker & Strobe: soft neon flicker with eased opacity & ambient glow, 2-3 soft beats
    case "flicker-strobe": {
      let opacity = 0;
      if (config.flickerBeats <= 2) {
        if (p < 0.3) opacity = lerp(0.25, 0.85, p / 0.3);
        else if (p < 0.65) opacity = lerp(0.45, 0.95, (p - 0.3) / 0.35);
        else opacity = lerp(0.85, 1.0, (p - 0.65) / 0.35);
      } else {
        if (p < 0.22) opacity = lerp(0.2, 0.8, p / 0.22);
        else if (p < 0.48) opacity = lerp(0.35, 0.9, (p - 0.22) / 0.26);
        else if (p < 0.76) opacity = lerp(0.6, 0.95, (p - 0.48) / 0.28);
        else opacity = lerp(0.9, 1.0, (p - 0.76) / 0.24);
      }
      const s = lerp(0.98, 1.0, easeOutCubic(p));
      return { o: clamp01(opacity), sx: s, sy: s, rot: 0, x: 0, y: 0 };
    }

    // 2. Kinetic & Punchy Pop: scale overshoot with damped spring ease, settling into stillness
    case "kinetic-pop":
    case "sticker-slap":
    case "spin-pop":
    case "pop":
    case "jelly": {
      const ease = springEase(1, { damping: 14, stiffness: 220, overshoot: config.scaleOvershoot - 1 });
      const s = lerp(0.92, 1.0, ease(p));
      return { o: fadeIn(6), sx: s, sy: s, rot: 0, x: 0, y: 0 };
    }

    // 3. Digital Glitch & Decoder: brief micro horizontal slice displacement, decodes clean
    case "digital-decoder": {
      let dx = 0;
      if (p < 0.6) {
        const slicePhase = Math.sin(p * Math.PI * 6);
        dx = slicePhase * config.glitchSplitPx * u * (1 - p / 0.6);
      }
      return { o: fadeIn(5), sx: 1, sy: 1, rot: 0, x: dx, y: 0 };
    }

    // 4. Directional Blur & Speed Slides: smooth directional slide-in with deceleration
    case "speed-slide":
    case "slide-fade-up":
    case "cinematic-drift": {
      const e = easeOutCubic(p);
      const x = lerp(-config.slideDistancePx * u, 0, e);
      return { o: fadeIn(4), sx: 1, sy: 1, rot: 0, x, y: 0 };
    }

    // 5. Typewriter & Code Terminal: human typing cadence and soft focus
    case "typewriter-terminal":
    case "soft-rise": {
      const e = easeOutCubic(p);
      const y = lerp(8 * u, 0, e);
      return { o: fadeIn(4), sx: 1, sy: 1, rot: 0, x: 0, y };
    }

    // Clean Fade: standard unobtrusive entrance for non-hero words
    case "clean-fade":
    case "fade-pop":
    case "drop-bounce":
    case "wiggle-in":
    default:
      return { o: fadeIn(4), sx: 1, sy: 1, rot: 0, x: 0, y: 0 };
  }
}
