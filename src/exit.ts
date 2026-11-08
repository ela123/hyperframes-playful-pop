// Chunk exit: pop-out 1.0 -> 1.08 -> 0, slight seeded rotation, per-line stagger, no drift, no blur.
import { easeInCubic, easeOutCubic, lerp, clamp01 } from "./lib/easing.ts";

export interface ExitState { scale: number; rot: number; o: number }

/** p = progress of this line's exit 0..1 (p<=0 => untouched). rotDeg is the seeded per-line target (+-8). */
export function exitState(p: number, rotDeg: number, cleanFade = false): ExitState {
  if (p <= 0) return { scale: 1, rot: 0, o: 1 };
  if (p >= 1) return { scale: cleanFade ? 1 : 0, rot: rotDeg, o: 0 };
  if (cleanFade) {
    return { scale: 1, rot: 0, o: clamp01(1 - p) };
  }
  const scale = p < 0.35 ? lerp(1, 1.08, easeOutCubic(p / 0.35)) : lerp(1.08, 0, easeInCubic((p - 0.35) / 0.65));
  return { scale, rot: rotDeg * easeInCubic(clamp01(p)), o: scale > 0.01 ? 1 : 0 };
}
