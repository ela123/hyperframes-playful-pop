// Emphasis while spoken. Pure functions of f = frames since the word's spoken start.
import type { EmphasisName, PresetName, Role } from "./types.ts";
import { TIMING } from "./tokens.ts";
import { clamp01, easeInCubic, easeOutCubic, lerp } from "./lib/easing.ts";
import { rng } from "./lib/prng.ts";

export const ACCENT_EMPHASIS: EmphasisName[] = ["wobble", "squash-bounce", "doodle-underline"];

/** Hero & accent emphasis customized per preset. */
export function pickEmphasis(
  role: Role,
  seed: number,
  prevAccent: EmphasisName | null,
  preset: PresetName = "playful-pop",
): EmphasisName[] {
  if (preset === "minimal-pro") {
    if (role === "hero") return ["pill-highlight"];
    if (role === "accent") return ["accent-color"];
    return [];
  }
  if (preset === "cinematic") {
    if (role === "hero") return ["cinematic-glow"];
    if (role === "accent") return ["accent-color"];
    return [];
  }

  // playful-pop
  if (role === "hero") return ["marker-highlight", "star-burst"];
  if (role !== "accent") return [];
  let k = rng(seed).int(0, 2);
  if (ACCENT_EMPHASIS[k] === prevAccent) k = (k + 1) % 3;
  return [ACCENT_EMPHASIS[k]];
}

export interface EmphasisState {
  rot: number; sx: number; sy: number;
  marker: number;          // 0..1 wipe amount (scaleX), 0 = hidden
  markerActive: boolean;   // text turns ink while the marker is up
  underline: number;       // 0..1 stroke draw progress
  stars: number;           // 0..1 progress of the star burst, <0 = not started, >1 = done
}
export const NO_EMPHASIS: EmphasisState = { rot: 0, sx: 1, sy: 1, marker: 0, markerActive: false, underline: 0, stars: -1 };

export function emphasisState(names: EmphasisName[], f: number, dur: number, wobbleSign: number): EmphasisState {
  const s: EmphasisState = { ...NO_EMPHASIS };
  if (f < 0 || names.length === 0) return s;
  for (const n of names) {
    switch (n) {
      case "pill-highlight": {
        const wipe = clamp01(f / 3);
        const release = clamp01((f - dur) / 3);
        s.marker = easeOutCubic(wipe) * (1 - easeInCubic(release));
        s.markerActive = f < dur + 3 && f >= 0;
        break;
      }
      case "cinematic-glow": {
        const p = clamp01(f / Math.max(dur, 1));
        s.markerActive = f >= 0 && f < dur + 4;
        s.sx = lerp(1, 1.04, Math.sin(p * Math.PI));
        s.sy = s.sx;
        break;
      }
      case "accent-color": {
        s.markerActive = f >= 0 && f < dur + 2;
        break;
      }
      case "marker-highlight": {
        const wipe = clamp01(f / TIMING.markerWipe);
        const release = clamp01((f - dur) / TIMING.markerRelease);
        s.marker = easeOutCubic(wipe) * (1 - easeInCubic(release));
        s.markerActive = f < dur + TIMING.markerRelease && f >= 0;
        break;
      }
      case "wobble": {
        const decay = clamp01(1 - f / Math.max(dur, 1));
        s.rot = 4 * wobbleSign * Math.sin(f * 0.9) * decay;
        break;
      }
      case "squash-bounce": {
        const p = clamp01(f / TIMING.squashFrames);
        if (p < 1) {
          // 1.0 -> 1.18/0.88 -> 0.95/1.06 -> 1.0
          if (p < 0.3) { const e = easeOutCubic(p / 0.3); s.sx = lerp(1, 1.18, e); s.sy = lerp(1, 0.88, e); }
          else if (p < 0.65) { const e = easeOutCubic((p - 0.3) / 0.35); s.sx = lerp(1.18, 0.95, e); s.sy = lerp(0.88, 1.06, e); }
          else { const e = easeOutCubic((p - 0.65) / 0.35); s.sx = lerp(0.95, 1, e); s.sy = lerp(1.06, 1, e); }
        }
        break;
      }
      case "doodle-underline":
        s.underline = easeOutCubic(clamp01(f / TIMING.underlineDraw));
        break;
      case "star-burst":
        s.stars = f / TIMING.starFrames;
        break;
    }
  }
  return s;
}

/** One star of the burst: position along its seeded angle (ease-out) and fade. */
export function starState(p: number, angleDeg: number, dist: number): { x: number; y: number; o: number; s: number } {
  if (p < 0 || p > 1) return { x: 0, y: 0, o: 0, s: 0 };
  const e = easeOutCubic(p);
  const a = (angleDeg * Math.PI) / 180;
  return { x: Math.cos(a) * dist * e, y: Math.sin(a) * dist * e, o: 1 - easeInCubic(p), s: lerp(0.4, 1, e) };
}
