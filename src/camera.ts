// Camera feel: pure functions of the frame.
// Camera shakes are disabled by default in accordance with anti-distraction rules.
import { CAMERA } from "./tokens.ts";
import { clamp01 } from "./lib/easing.ts";

export function shakeOffset(frameSince: number, dx: number, dy: number, u: number): { x: number; y: number } {
  if (CAMERA.shakeAmpPx <= 0 || frameSince < 0 || frameSince >= CAMERA.shakeFrames) return { x: 0, y: 0 };
  const amp = CAMERA.shakeAmpPx * u * Math.exp(-0.7 * frameSince);
  return { x: dx * amp * Math.cos(frameSince * 2.1), y: dy * amp * Math.sin(frameSince * 2.1 + 0.6) };
}

/** In the refactored artistic engine, camera shakes are silenced to keep text calm and readable. */
export function scheduleShakes(frames: number[]): number[] {
  if (CAMERA.shakeAmpPx <= 0) return [];
  const out: number[] = [];
  let last = -1e9;
  for (const f of [...frames].sort((a, b) => a - b)) {
    if (f - last >= CAMERA.shakeMinGap) { out.push(f); last = f; }
  }
  return out;
}

export function parallax(q: number): { text: number; bg: number } {
  const t = clamp01(q);
  return { text: 1 + CAMERA.parallaxText * t, bg: 1 + CAMERA.parallaxBg * t };
}
