// Minimal, clean graphics helper for the simplified artistic caption engine.
// All decorative cartoon clutter (confetti, comic bursts, halftone blobs, doodle shapes)
// has been eliminated in accordance with the anti-distraction rules.
import type { Box, ColorName, DoodleKind, DoodleSpec, PopConfig, WordPlan } from "./types.ts";

export interface ShapePath { d: string; filled: boolean }

export function shapePath(kind: DoodleKind, seed: number): ShapePath {
  return { d: "", filled: false };
}

export function starPoints(): string {
  return "";
}

export function doodleFootprint(d: DoodleSpec, u: number): { x0: number; y0: number; x1: number; y1: number } {
  return { x0: d.cx, y0: d.cy, x1: d.cx, y1: d.cy };
}

export function wordFootprint(w: WordPlan, pad: number): { x0: number; y0: number; x1: number; y1: number } {
  return { x0: w.box.x - pad, y0: w.box.y - pad, x1: w.box.x + w.box.w + pad, y1: w.box.y + w.box.h + pad };
}

export function planGraphics(
  ci: number,
  words: WordPlan[],
  bbox: Box,
  startFrame: number,
  endFrame: number,
  cfg: PopConfig,
  colors: ColorName[],
) {
  return {
    doodles: [] as DoodleSpec[],
    bursts: [],
    confetti: [],
    halftone: null,
    notes: [] as string[],
  };
}

export function doodleState(d: any, lf: any, xp: any) {
  return { x: 0, y: 0, rot: 0, s: 0 };
}

export function burstState(b: any, f: any, xp: any) {
  return { s: 0, o: 0, rot: 0 };
}

export function confettiState(p: any, f: any) {
  return { x: 0, y: 0, rot: 0, o: 0 };
}

