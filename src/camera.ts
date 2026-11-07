// Camera feel: short decaying shake on hero starts + slow push-in parallax. Pure functions of the frame.
import { CAMERA } from "./tokens.ts";
import { clamp01 } from "./lib/easing.ts";

export function shakeOffset(frameSince: number, dx: number, dy: number, u: number): { x: number; y: number } {
  if (frameSince < 0 || frameSince >= CAMERA.shakeFrames) return { x: 0, y: 0 };
  const amp = CAMERA.shakeAmpPx * u * Math.exp(-0.7 * frameSince);
  return { x: dx * amp * Math.cos(frameSince * 2.1), y: dy * amp * Math.sin(frameSince * 2.1 + 0.6) };
}

/** Accept hero start frames with at most one shake per 20 frames. */
export function scheduleShakes(frames: number[]): number[] {
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
