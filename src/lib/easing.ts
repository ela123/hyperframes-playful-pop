import { SPRING } from "../tokens.ts";

export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - clamp01(t), 3);
export const easeInCubic = (t: number): number => Math.pow(clamp01(t), 3);
export const easeInOutCubic = (t: number): number => {
  t = clamp01(t);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
export const easeOutBack = (t: number, s = 1.70158): number => {
  t = clamp01(t) - 1;
  return 1 + (s + 1) * t * t * t + s * t * t;
};

export interface SpringOpts {
  damping: number;
  stiffness: number;
  mass?: number;
  /** Cap the first overshoot to this fraction (0.15 => peaks at 1.15). Keeps the bounce shape, tames the height. */
  overshoot?: number;
  /** Play in real time (seconds) instead of settle-normalised. */
  realtime?: boolean;
}

/**
 * Analytic damped-oscillator step response, usable as a GSAP-style ease (t in 0..1 -> value).
 * Pure function of t. By default time is normalised so the motion settles (residual < 0.5%)
 * exactly at t = 1, regardless of `duration`, i.e. "settles at the end of the entrance".
 */
export function springEase(duration: number, o: SpringOpts): (t: number) => number {
  const m = o.mass ?? 1;
  const w0 = Math.sqrt(o.stiffness / m);
  const z = o.damping / (2 * Math.sqrt(o.stiffness * m));
  const overdamped = z >= 1;
  const wd = overdamped ? 0 : w0 * Math.sqrt(1 - z * z);
  const raw = (tau: number): number =>
    overdamped
      ? 1 - (1 + w0 * tau) * Math.exp(-w0 * tau)
      : 1 - Math.exp(-z * w0 * tau) * (Math.cos(wd * tau) + ((z * w0) / wd) * Math.sin(wd * tau));
  const settle = overdamped ? 7 / w0 : Math.log(1 / 0.005) / (z * w0);
  const peak = overdamped ? 0 : Math.exp((-Math.PI * z) / Math.sqrt(1 - z * z));
  const k = o.overshoot == null || peak === 0 ? 1 : o.overshoot / peak;
  return (t: number): number => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const tau = o.realtime ? t * duration : t * settle;
    const v = raw(tau);
    return v > 1 ? 1 + (v - 1) * k : v;
  };
}

export const popSpring = springEase(1, { ...SPRING, overshoot: 0.15 });
export const settleSpring = springEase(1, { ...SPRING, overshoot: 0.08 });
export const doodleSpring = springEase(1, { ...SPRING, overshoot: 0.2 });

/** Remaining height fraction (1 -> 0) of a drop that bounces twice with decaying height. */
export function dropBounce(t: number): number {
  t = clamp01(t);
  if (t < 0.45) return 1 - Math.pow(t / 0.45, 2);
  if (t < 0.75) { const u = (t - 0.45) / 0.3; return 0.28 * 4 * u * (1 - u); }
  if (t < 0.92) { const u = (t - 0.75) / 0.17; return 0.09 * 4 * u * (1 - u); }
  return 0;
}

export const round2 = (n: number): number => Math.round(n * 100) / 100;
