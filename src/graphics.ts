// Decorative layer: doodles, comic burst, halftone blob, confetti. Everything is generated from seeded PRNGs at
// build time (planning) or is a pure function of the frame (state functions below).
import type {
  BurstSpec, Box, ColorName, ConfettiSpec, DoodleKind, DoodleSpec, HalftoneSpec, PopConfig, WordPlan,
} from "./types.ts";
import { CYCLE, DECOR, QUALITY, TIMING } from "./tokens.ts";
import { derivedSeed, rng } from "./lib/prng.ts";
import { clamp01, doodleSpring, easeOutCubic, lerp, round2 } from "./lib/easing.ts";

/* ------------------------------ shape paths (local coords, centred, size = 1 => +-0.5) ------------------------------ */
export interface ShapePath { d: string; filled: boolean }
const f = (n: number): string => String(round2(n));

export function shapePath(kind: DoodleKind, seed: number): ShapePath {
  const r = rng(seed);
  switch (kind) {
    case "star": {
      let d = "";
      for (let i = 0; i < 10; i++) {
        const a = (Math.PI / 5) * i - Math.PI / 2;
        const rad = (i % 2 === 0 ? 0.5 : 0.22) * (1 + r.range(-0.06, 0.06));
        d += (i === 0 ? "M" : "L") + f(Math.cos(a) * rad) + "," + f(Math.sin(a) * rad);
      }
      return { d: d + "Z", filled: true };
    }
    case "sparkle": {
      const p = 0.5, q = 0.06 + r.range(0, 0.03);
      return { d: `M0,${-p} Q${q},${-q} ${p},0 Q${q},${q} 0,${p} Q${-q},${q} ${-p},0 Q${-q},${-q} 0,${-p}Z`, filled: true };
    }
    case "heart":
      return { d: "M0,0.38 C-0.62,-0.02 -0.38,-0.5 0,-0.18 C0.38,-0.5 0.62,-0.02 0,0.38Z", filled: true };
    case "squiggle": {
      let d = "M-0.5,0";
      const n = 4;
      for (let i = 0; i < n; i++) {
        const x0 = -0.5 + i / n, x1 = -0.5 + (i + 1) / n, amp = (i % 2 === 0 ? -1 : 1) * (0.16 + r.range(-0.03, 0.03));
        d += ` Q${f((x0 + x1) / 2)},${f(amp * 2)} ${f(x1)},0`;
      }
      return { d, filled: false };
    }
    case "arrow": {
      const j = r.range(-0.05, 0.05);
      return { d: `M-0.5,0.25 Q-0.1,${f(-0.3 + j)} 0.42,-0.12 M0.42,-0.12 L0.2,-0.28 M0.42,-0.12 L0.18,0.04`, filled: false };
    }
    case "circle": {
      const n = 8;
      const pts: [number, number][] = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, rad = 0.46 * (1 + r.range(-0.07, 0.07));
        pts.push([Math.cos(a) * rad, Math.sin(a) * rad]);
      }
      let d = `M${f((pts[0][0] + pts[n - 1][0]) / 2)},${f((pts[0][1] + pts[n - 1][1]) / 2)}`;
      for (let i = 0; i < n; i++) {
        const nx = pts[(i + 1) % n];
        d += ` Q${f(pts[i][0])},${f(pts[i][1])} ${f((pts[i][0] + nx[0]) / 2)},${f((pts[i][1] + nx[1]) / 2)}`;
      }
      return { d: d + "Z", filled: false };
    }
    case "zigzag": {
      let d = "M-0.5,0.1";
      const n = 5;
      for (let i = 1; i <= n; i++) d += ` L${f(-0.5 + i / n)},${f((i % 2 ? -0.12 : 0.12) + r.range(-0.03, 0.03))}`;
      return { d, filled: false };
    }
  }
}

/** Comic explosion: spiky polygon, local coords +-0.5. */
export function burstPath(seed: number, spikes = 14): string {
  const r = rng(seed);
  let d = "";
  for (let i = 0; i < spikes * 2; i++) {
    const a = (Math.PI / spikes) * i;
    const rad = i % 2 === 0 ? 0.5 * (0.92 + r.range(0, 0.16)) : 0.33 * (0.85 + r.range(0, 0.2));
    d += (i === 0 ? "M" : "L") + f(Math.cos(a) * rad) + "," + f(Math.sin(a) * rad);
  }
  return d + "Z";
}

export function starPoints(): string {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2, rad = i % 2 === 0 ? 0.5 : 0.22;
    d += (i === 0 ? "M" : "L") + f(Math.cos(a) * rad) + "," + f(Math.sin(a) * rad);
  }
  return d + "Z";
}

/* ------------------------------ planning (build time) ------------------------------ */
export interface Rect { x0: number; y0: number; x1: number; y1: number }
const toRect = (b: Box, pad = 0): Rect => ({ x0: b.x - pad, y0: b.y - pad, x1: b.x + b.w + pad, y1: b.y + b.h + pad });
const rectsHit = (a: Rect, b: Rect): boolean => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

/** The footprint of a word including sticker, rotation and shadow slack. Shared by planning and `npm run check`. */
export function wordFootprint(w: WordPlan, pad: number): Rect {
  const rotSlack = Math.abs(w.rot) * 0.0175 * Math.max(w.box.w, w.box.h) * 0.5;
  const slack = pad + rotSlack + w.fontPx * 0.1 + (w.role === "hero" ? w.fontPx * 0.08 : 0);
  return toRect(w.box, slack);
}
/** The footprint of a doodle, including float amplitude and the rotation circle. */
export function doodleFootprint(d: DoodleSpec, u: number): Rect {
  const rad = d.size * 0.75 + d.floatAmp * 1.1 + 6 * u;
  return { x0: d.cx - rad, y0: d.cy - rad, x1: d.cx + rad, y1: d.cy + rad };
}

export interface GraphicsPlan { doodles: DoodleSpec[]; bursts: BurstSpec[]; confetti: ConfettiSpec[]; halftone: HalftoneSpec; notes: string[] }

const KINDS: DoodleKind[] = ["star", "sparkle", "heart", "squiggle", "arrow", "circle", "zigzag"];

export function planGraphics(
  chunkIndex: number, words: WordPlan[], bbox: Box, startFrame: number, endFrame: number,
  cfg: PopConfig, takenColors: ColorName[],
): GraphicsPlan {
  // Minimal Professional and Cinematic Modern avoid expensive decorative clutter
  if (cfg.preset && cfg.preset !== "playful-pop") {
    const dummyHalftone: HalftoneSpec = {
      cx: 0, cy: 0, rx: 0, ry: 0, color: "cream", gap: 0, dot: 0,
    };
    return { doodles: [], bursts: [], confetti: [], halftone: dummyHalftone, notes: [] };
  }

  const u = cfg.unit;
  const notes: string[] = [];
  const baseSeed = chunkIndex * 1000 + 777;
  const r = rng(derivedSeed(baseSeed, 1));
  const q = QUALITY[cfg.quality];
  const pad = DECOR.doodlePadPx * u;

  // ---- doodles: seeded rejection sampling, outside text bbox + padding, never overlapping each other
  const textRects = words.map((w) => wordFootprint(w, pad));
  const area: Rect = {
    x0: cfg.width * 0.08, x1: cfg.width * 0.92,
    y0: Math.max(cfg.height * 0.22, bbox.y - 230 * u), y1: cfg.height * 0.9,
  };
  const target = r.int(DECOR.doodlesMin, DECOR.doodlesMax);
  const doodles: DoodleSpec[] = [];
  const cycle = r.int(0, CYCLE.length - 1);
  let attempts = 0;
  while (doodles.length < target && attempts < 400) {
    attempts++;
    const size = r.range(DECOR.doodleSizePx[0], DECOR.doodleSizePx[1]) * u * (attempts > 200 ? 0.7 : 1);
    const kind = KINDS[(chunkIndex * 3 + doodles.length + r.int(0, 2)) % KINDS.length];
    const d: DoodleSpec = {
      kind, cx: r.range(area.x0, area.x1), cy: r.range(area.y0, area.y1), size,
      rot0: r.range(-25, 25), rotSpeed: r.range(-0.35, 0.35) || 0.2,
      color: CYCLE[(cycle + doodles.length * 2 + 1) % CYCLE.length], seed: derivedSeed(baseSeed, 100 + doodles.length),
      floatAmp: DECOR.floatAmpPx * u, phaseX: r.range(0, 6.28), phaseY: r.range(0, 6.28), popDelay: doodles.length * 2,
    };
    const rect = doodleFootprint(d, u);
    if (rect.x0 < area.x0 - 20 * u || rect.x1 > area.x1 + 20 * u || rect.y0 < 0 || rect.y1 > cfg.height * 0.95) continue;
    if (textRects.some((t) => rectsHit(rect, t))) continue;
    if (doodles.some((o) => rectsHit(rect, doodleFootprint(o, u)))) continue;
    doodles.push(d);
  }
  if (doodles.length < DECOR.doodlesMin) notes.push(`only ${doodles.length} doodles fit (min ${DECOR.doodlesMin})`);

  // ---- halftone dot blob behind the text
  const taken = new Set(takenColors);
  const ht = CYCLE.filter((c) => !taken.has(c));
  const halftone: HalftoneSpec = {
    cx: bbox.x + bbox.w / 2, cy: bbox.y + bbox.h / 2, rx: bbox.w * 0.62 + 90 * u, ry: bbox.h * 0.95 + 40 * u,
    color: (ht.length ? ht[chunkIndex % ht.length] : CYCLE[chunkIndex % CYCLE.length]), gap: 20 * u, dot: 5.5 * u,
  };

  // ---- hero bursts + confetti
  const bursts: BurstSpec[] = [];
  const confetti: ConfettiSpec[] = [];
  for (const w of words) {
    if (w.role !== "hero") continue;
    const rr = rng(derivedSeed(w.seed, 2));
    const cx = w.box.x + w.box.w / 2, cy = w.box.y + w.box.h / 2;
    const bc = CYCLE[(CYCLE.indexOf(w.color) + 2) % CYCLE.length];
    bursts.push({
      word: w.id, cx, cy, size: Math.max(w.box.w * 0.95, w.box.h * 1.7), color: bc, rot0: rr.range(-12, 12), spin: rr.range(-0.15, 0.15),
      start: w.spokenStart, path: burstPath(derivedSeed(w.seed, 3)),
    });
    const n = rr.int(q.confetti[0], q.confetti[1]);
    for (let i = 0; i < n; i++) {
      const circle = rr.next() < 0.4;
      const s = rr.range(10, 20) * u;
      confetti.push({
        circle, w: s, h: circle ? s : s * rr.range(0.4, 0.7), color: CYCLE[(i + chunkIndex) % CYCLE.length],
        x0: cx + rr.range(-0.3, 0.3) * w.box.w, y0: cy - w.box.h * 0.3,
        vx: rr.range(-520, 520) * u, vy: -rr.range(520, 980) * u, g: DECOR.confettiGravity * u,
        rot0: rr.range(0, 360), rotSpeed: rr.range(-14, 14), delay: rr.int(0, 3), start: w.spokenStart, life: rr.int(34, 52),
      });
    }
  }
  return { doodles, bursts, confetti, halftone, notes };
}

/* ------------------------------ pure state functions ------------------------------ */
/** Doodle at chunk-local frame lf, exit progress xp (0..1). */
export function doodleState(d: DoodleSpec, lf: number, xp: number): { x: number; y: number; rot: number; s: number } {
  const pop = doodleSpring(clamp01((lf - d.popDelay) / 8));
  const out = 1 - clamp01(xp) * clamp01(xp);
  return {
    x: Math.sin(lf * 0.07 + d.phaseX) * d.floatAmp,
    y: Math.cos(lf * 0.05 + d.phaseY) * d.floatAmp,
    rot: d.rot0 + d.rotSpeed * lf, s: lf < d.popDelay ? 0 : pop * out,
  };
}

export function burstState(b: BurstSpec, frame: number, xp: number): { s: number; o: number; rot: number } {
  const t = frame - b.start;
  if (t < 0) return { s: 0, o: 0, rot: b.rot0 };
  let s: number;
  if (t < TIMING.burstFrames) s = lerp(0, 1.2, easeOutCubic(t / TIMING.burstFrames));
  else s = lerp(1.2, 1, clamp01((t - TIMING.burstFrames) / 4));
  const fade = clamp01((t - TIMING.burstFadeAt) / TIMING.burstFadeFrames);
  return { s: s * (1 - clamp01(xp)), o: lerp(1, TIMING.burstFadeTo, fade), rot: b.rot0 + b.spin * t };
}

/** Confetti piece: position = p0 + v*t + 0.5*g*t^2, a pure function of time. */
export function confettiState(c: ConfettiSpec, frame: number): { x: number; y: number; rot: number; o: number } {
  const t = (frame - c.start - c.delay) / TIMING.fps;
  const life = c.life;
  const k = frame - c.start - c.delay;
  if (t < 0 || k > life) return { x: 0, y: 0, rot: 0, o: 0 };
  return {
    x: c.x0 + c.vx * t, y: c.y0 + c.vy * t + 0.5 * c.g * t * t, rot: c.rot0 + c.rotSpeed * k,
    o: k > life - 8 ? clamp01((life - k) / 8) : 1,
  };
}
