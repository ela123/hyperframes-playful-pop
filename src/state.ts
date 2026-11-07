// The whole caption animation as ONE pure function: (chunk, frame) -> visual state.
// No DOM, no clocks, no accumulated state. composition.ts just writes this state to the DOM;
// scripts/check.ts hashes it to prove determinism.
import type { ChunkPlan, PopConfig, WordPlan } from "./types.ts";
import { ROLE_OPACITY, TIMING } from "./tokens.ts";
import { clamp01, doodleSpring, round2 } from "./lib/easing.ts";
import { entranceState } from "./entrances.ts";
import { emphasisState, starState } from "./emphasis.ts";
import { exitState } from "./exit.ts";
import { parallax, shakeOffset } from "./camera.ts";
import { burstState, confettiState, doodleState } from "./graphics.ts";
import { formatCount } from "./lib/text.ts";

export interface StarVis { x: number; y: number; o: number; s: number }
export interface WordVis {
  o: number; transform: string; text: string;
  marker: number; markerOn: boolean; underline: number; stars: StarVis[];
}
export interface ChunkVis {
  visible: boolean;
  shake: { x: number; y: number };
  textScale: number; bgScale: number;
  lines: { transform: string; o: number }[];
  words: WordVis[];
  doodles: { x: number; y: number; rot: number; s: number }[];
  bursts: { s: number; o: number; rot: number }[];
  confetti: { x: number; y: number; rot: number; o: number }[];
  halftone: { s: number };
}

const r3 = (n: number): number => Math.round(n * 1000) / 1000;

function wordVis(w: WordPlan, frame: number, u: number): WordVis {
  const ent = entranceState(w.entrance.name, (frame - w.entrance.start) / w.entrance.dur, u, w.wobbleSign);
  const emp = emphasisState(w.emphasis, frame - w.emphStart, w.emphDur, w.wobbleSign);
  const rot = w.rot + ent.rot + emp.rot;
  const sx = ent.sx * emp.sx, sy = ent.sy * emp.sy;
  let text = w.display;
  if (w.count) text = formatCount(w.count, clamp01((frame - w.spokenStart) / Math.max(1, w.emphDur)));
  const stars: StarVis[] = w.stars.map((s) => (emp.stars < 0 ? { x: 0, y: 0, o: 0, s: 0 } : starState(emp.stars, s.angle, s.dist)));
  return {
    o: r3(ent.o * ROLE_OPACITY[w.role]),
    transform: `translate(${r3(ent.x)}px, ${r3(ent.y)}px) rotate(${r3(rot)}deg) scale(${r3(sx)}, ${r3(sy)})`,
    text, marker: r3(emp.marker), markerOn: emp.markerActive, underline: r3(emp.underline),
    stars: stars.map((s) => ({ x: r3(s.x), y: r3(s.y), o: r3(s.o), s: r3(s.s) })),
  };
}

export function chunkVis(c: ChunkPlan, frame: number, cfg: PopConfig): ChunkVis {
  const u = cfg.unit;
  const visible = frame >= c.startFrame && frame < c.endFrame;
  const lf = frame - c.startFrame;
  const lineExit = c.lines.map((l) => (frame - (c.exitStart + l.index * TIMING.exitLineStagger)) / c.exitDur);
  const xp = lineExit.length ? clamp01(lineExit[0]) : 0;

  let sx = 0, sy = 0;
  for (const sk of c.shakes) { const o = shakeOffset(frame - sk.frame, sk.dx, sk.dy, u); sx += o.x; sy += o.y; }
  const par = parallax((frame - c.startFrame) / Math.max(1, c.endFrame - c.startFrame));

  return {
    visible,
    shake: { x: r3(sx), y: r3(sy) },
    textScale: r3(par.text), bgScale: r3(par.bg),
    lines: lineExit.map((p, i) => {
      const e = exitState(p, c.exitRots[i]);
      return { transform: `rotate(${r3(e.rot)}deg) scale(${r3(e.scale)})`, o: e.o };
    }),
    words: c.words.map((w) => wordVis(w, frame, u)),
    doodles: c.doodles.map((d) => { const s = doodleState(d, lf, xp); return { x: r3(s.x), y: r3(s.y), rot: r3(s.rot), s: r3(s.s) }; }),
    bursts: c.bursts.map((b) => { const s = burstState(b, frame, xp); return { s: r3(s.s), o: r3(s.o), rot: r3(s.rot) }; }),
    confetti: c.confetti.map((p) => { const s = confettiState(p, frame); return { x: r3(s.x), y: r3(s.y), rot: r3(s.rot), o: r3(s.o) }; }),
    halftone: { s: r3(doodleSpring(clamp01(lf / 10)) * (1 - xp * xp)) },
  };
}

export { round2 };
