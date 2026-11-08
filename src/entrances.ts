// Entrances: pure functions of progress p (0..1 over the entrance) -> transform state.
// o = opacity multiplier, sx/sy = scale multipliers, rot = degrees added to the resting rotation, x/y = px offsets.
import type { AnimationStyle, EntranceName, PresetName, Role } from "./types.ts";
import { TIMING } from "./tokens.ts";
import { clamp01, dropBounce, easeInOutCubic, easeOutCubic, lerp, popSpring, settleSpring, doodleSpring } from "./lib/easing.ts";

export interface XForm { o: number; sx: number; sy: number; rot: number; x: number; y: number }
export const IDENTITY: XForm = { o: 1, sx: 1, sy: 1, rot: 0, x: 0, y: 0 };
export const HIDDEN: XForm = { o: 0, sx: 1, sy: 1, rot: 0, x: 0, y: 0 };

export const entranceFrames = (name: EntranceName): number => TIMING.entranceFrames[name] || 6;

/** Entrance chosen by ROLE and PRESET. Minimal & Cinematic use lightweight zero-overhead animations. */
export function pickEntrance(
  role: Role,
  counters: { hero: number; accent: number; normal: number },
  preset: PresetName = "playful-pop",
  animStyle: AnimationStyle = "default",
): EntranceName {
  if (animStyle === "subtle-fade") return "clean-fade";
  if (animStyle === "slide-up") return role === "connector" ? "clean-fade" : "slide-fade-up";
  if (animStyle === "scale-punch") return role === "hero" ? "pop" : "clean-fade";
  if (animStyle === "static") return "clean-fade";

  if (preset === "quiet-art") {
    return "soft-rise";
  }

  if (preset === "minimal-pro") {
    switch (role) {
      case "hero":
      case "accent":
        return "slide-fade-up";
      default:
        return "clean-fade";
    }
  }

  if (preset === "cinematic") {
    switch (role) {
      case "hero":
      case "accent":
        return "cinematic-drift";
      default:
        return "clean-fade";
    }
  }

  // playful-pop
  switch (role) {
    case "hero": return counters.hero++ % 2 === 0 ? "sticker-slap" : "spin-pop";
    case "accent": return counters.accent++ % 2 === 0 ? "jelly" : "drop-bounce";
    case "connector": return "fade-pop";
    default: return counters.normal++ % 3 === 2 ? "wiggle-in" : "pop";
  }
}

export function entranceState(name: EntranceName, p: number, u: number, wobbleSign = 1): XForm {
  if (p < 0) return HIDDEN;
  if (p >= 1) return IDENTITY;
  const fadeIn = (k: number): number => clamp01(p * k);
  switch (name) {
    case "soft-rise": {
      const y = lerp(14 * u, 0, easeOutCubic(p));
      return { o: fadeIn(2.5), sx: 1, sy: 1, rot: 0, x: 0, y };
    }
    case "clean-fade":
      return { o: fadeIn(4), sx: 1, sy: 1, rot: 0, x: 0, y: 0 };
    case "slide-fade-up": {
      const y = lerp(12 * u, 0, easeOutCubic(p));
      return { o: fadeIn(5), sx: 1, sy: 1, rot: 0, x: 0, y };
    }
    case "cinematic-drift": {
      const s = lerp(0.96, 1.0, easeOutCubic(p));
      return { o: fadeIn(4), sx: s, sy: s, rot: 0, x: 0, y: 0 };
    }
    case "sticker-slap": {
      const s = p < 0.6 ? lerp(1.8, 0.92, easeOutCubic(p / 0.6)) : lerp(0.92, 1, easeOutCubic((p - 0.6) / 0.4));
      return { o: fadeIn(8), sx: s, sy: s, rot: 6 * wobbleSign * (1 - easeOutCubic(p / 0.5)), x: 0, y: 0 };
    }
    case "spin-pop": {
      const s = p < 0.6 ? lerp(0, 1.1, easeOutCubic(p / 0.6)) : lerp(1.1, 1, easeInOutCubic((p - 0.6) / 0.4));
      return { o: fadeIn(6), sx: s, sy: s, rot: -180 * (1 - easeOutCubic(p)), x: 0, y: 0 };
    }
    case "jelly": {
      let sx: number, sy: number;
      if (p < 0.4) { const e = easeOutCubic(p / 0.4); sx = lerp(1.3, 0.9, e); sy = lerp(0.7, 1.15, e); }
      else { const e = doodleSpring((p - 0.4) / 0.6); sx = lerp(0.9, 1, e); sy = lerp(1.15, 1, e); }
      return { o: fadeIn(8), sx, sy, rot: 0, x: 0, y: 0 };
    }
    case "drop-bounce":
      return { o: fadeIn(8), sx: 1, sy: 1, rot: 0, x: 0, y: -60 * u * dropBounce(p) };
    case "pop": {
      const s = popSpring(p);
      return { o: fadeIn(8), sx: s, sy: s, rot: 0, x: 0, y: 0 };
    }
    case "wiggle-in": {
      const s = lerp(0.6, 1, settleSpring(p));
      return { o: fadeIn(6), sx: s, sy: s, rot: 12 * wobbleSign * Math.sin(p * Math.PI * 3) * (1 - p), x: 0, y: 0 };
    }
    case "fade-pop": {
      const s = p < 0.5 ? lerp(1, 1.1, p / 0.5) : lerp(1.1, 1, (p - 0.5) / 0.5);
      return { o: fadeIn(2), sx: s, sy: s, rot: 0, x: 0, y: 0 };
    }
    default:
      return { o: fadeIn(4), sx: 1, sy: 1, rot: 0, x: 0, y: 0 };
  }
}
