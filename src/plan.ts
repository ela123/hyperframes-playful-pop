// captions.json + measurements + config  ->  Plan (fully baked: layout, timing, seeded decoration).
// Pure and deterministic. Runs in Node at build time; the browser only plays the plan back.
import type {
  Box, CaptionWord, CaptionsFile, ChunkPlan, ColorName, EmphasisName, Measures, MeasureKey, Plan, PopConfig,
  Role, StarSpec, WordPlan,
} from "./types.ts";
import { CHUNKING, CYCLE, MIN_FONT_SCALE, MAX_ROT, MAX_ROT_HERO, QUALITY, TIMING, getPresetCycle } from "./tokens.ts";
import { derivedSeed, rng, wordSeed } from "./lib/prng.ts";
import { round2 } from "./lib/easing.ts";
import { assignRoles, chunkWords, parseCount, splitLines } from "./lib/text.ts";
import { displayText, layoutChunk, maxLineWidth, toMeasureKey, measureKeyOf } from "./lib/layout.ts";
import type { LayoutItem, LayoutResult } from "./lib/layout.ts";
import { entranceFrames, pickEntrance } from "./entrances.ts";
import { pickEmphasis } from "./emphasis.ts";
import { scheduleShakes } from "./camera.ts";
import { planGraphics } from "./graphics.ts";

export const frameOf = (ms: number, fps: number): number => Math.round((ms * fps) / 1000);

interface SrcChunk { words: (CaptionWord & { role: Role })[]; lineSizes: number[]; endMs: number }

/* ------------------------------ normalise captions.json ------------------------------ */
function fillRoles(words: CaptionWord[]): (CaptionWord & { role: Role })[] {
  if (words.some((w) => !w.role)) {
    const tmp = words.map((w) => ({ ...w, role: undefined as Role | undefined }));
    assignRoles(tmp as CaptionWord[]);
    words.forEach((w, i) => { if (!w.role) w.role = tmp[i].role; });
  }
  return words as (CaptionWord & { role: Role })[];
}

function splitAtBestGap(words: CaptionWord[]): [CaptionWord[], CaptionWord[]] {
  const mid = words.length / 2;
  let best = Math.ceil(mid), bestScore = -Infinity;
  for (let i = 1; i < words.length; i++) {
    const gap = words[i].startMs - words[i - 1].endMs;
    const score = gap - Math.abs(i - mid) * 40;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return [words.slice(0, best), words.slice(best)];
}

function enforceLimits(c: SrcChunk, out: SrcChunk[], maxWords = CHUNKING.maxWords): void {
  if (c.words.length > maxWords || c.lineSizes.length > CHUNKING.maxLines) {
    const [a, b] = splitAtBestGap(c.words);
    const mk = (ws: typeof c.words, endMs: number): SrcChunk => ({ words: ws, lineSizes: splitLines(ws).map((l) => l.length), endMs });
    enforceLimits(mk(a, a[a.length - 1].endMs), out, maxWords);
    enforceLimits(mk(b, c.endMs), out, maxWords);
    return;
  }
  out.push(c);
}

export function normalize(captions: CaptionsFile, maxWords = CHUNKING.maxWords): SrcChunk[] {
  const out: SrcChunk[] = [];
  if (captions.chunks && captions.chunks.length) {
    for (const ch of captions.chunks) {
      const words = ch.lines.flatMap((l) => l.words.map((w) => ({ ...w })));
      if (!words.length) continue;
      const lineSizes = ch.lines.map((l) => l.words.length).filter((n) => n > 0);
      enforceLimits({ words: fillRoles(words), lineSizes, endMs: Math.max(ch.endMs, words[words.length - 1].endMs) }, out, maxWords);
    }
  } else if (captions.words?.length) {
    for (const g of chunkWords(captions.words.map((w) => ({ ...w })), maxWords)) {
      enforceLimits({ words: fillRoles(g), lineSizes: splitLines(g).map((l) => l.length), endMs: g[g.length - 1].endMs + CHUNKING.tailMs }, out, maxWords);
    }
  } else throw new Error("captions.json has neither `chunks` nor `words`");
  return out;
}

export function collectMeasureKeys(captions: CaptionsFile, cfg?: PopConfig): MeasureKey[] {
  const seen = new Map<string, MeasureKey>();
  const preset = cfg?.preset ?? "playful-pop";
  const fontOverride = cfg?.fontOverride;
  const maxWords = cfg?.maxWordsPerCaption ?? CHUNKING.maxWords;
  for (const c of normalize(captions, maxWords)) {
    for (const w of c.words) {
      const k = toMeasureKey(w.role, w.text, preset, fontOverride);
      seen.set(k.key, k);
    }
  }
  return [...seen.values()];
}

/* ------------------------------ fit: line balance, shrink (>=70%), split ------------------------------ */
interface Fitted { src: SrcChunk; layout: LayoutResult; scale: number; notes: string[] }

const itemsOf = (c: SrcChunk, cfg: PopConfig): LayoutItem[] =>
  c.words.map((w) => ({ role: w.role, display: displayText(w.role, w.text, cfg.preset) }));

function fit(src: SrcChunk, measures: Measures, cfg: PopConfig, warnings: string[]): Fitted[] {
  const items = itemsOf(src, cfg);
  const maxW = maxLineWidth(cfg);
  const notes: string[] = [];
  let lineSizes = src.lineSizes;
  let lay = layoutChunk(items, lineSizes, 1, measures, cfg);
  if (lay.maxLineW <= maxW) return [{ src: { ...src, lineSizes }, layout: lay, scale: 1, notes }];

  if (lineSizes.length === 1 && items.length >= 2) {
    let bestK = 1, bestW = Infinity;
    for (let k = 1; k < items.length; k++) {
      const l = layoutChunk(items, [k, items.length - k], 1, measures, cfg);
      if (l.maxLineW < bestW) { bestW = l.maxLineW; bestK = k; }
    }
    lineSizes = [bestK, items.length - bestK];
    lay = layoutChunk(items, lineSizes, 1, measures, cfg);
    notes.push("re-flowed to 2 lines");
    if (lay.maxLineW <= maxW) return [{ src: { ...src, lineSizes }, layout: lay, scale: 1, notes }];
  }
  for (let s = 0.95; s >= MIN_FONT_SCALE - 1e-9; s -= 0.05) {
    const l = layoutChunk(items, lineSizes, s, measures, cfg);
    if (l.maxLineW <= maxW) { notes.push(`shrunk to ${Math.round(s * 100)}%`); return [{ src: { ...src, lineSizes }, layout: l, scale: s, notes }]; }
  }
  if (src.words.length >= 2) {
    const [a, b] = splitAtBestGap(src.words);
    warnings.push(`chunk "${src.words.map((w) => w.text).join(" ")}" did not fit at >=70%: split in two`);
    const mk = (ws: typeof src.words, endMs: number): SrcChunk => ({ words: ws, lineSizes: splitLines(ws).map((l) => l.length), endMs });
    return [...fit(mk(a, a[a.length - 1].endMs), measures, cfg, warnings), ...fit(mk(b, src.endMs), measures, cfg, warnings)];
  }
  warnings.push(`word "${src.words[0].text}" is wider than the safe area even at 70%; kept at 70%`);
  const l = layoutChunk(items, lineSizes, MIN_FONT_SCALE, measures, cfg);
  return [{ src, layout: l, scale: MIN_FONT_SCALE, notes: ["single word wider than safe area"] }];
}

/* ------------------------------ sticker + doodle geometry ------------------------------ */
function blobPath(w: number, h: number, inset: number, seed: number): string {
  const r = rng(seed);
  const x0 = inset, y0 = inset, x1 = w - inset, y1 = h - inset;
  const rad = Math.min(h, w) * 0.28;
  const j = (): number => r.range(-0.03, 0.03) * h;
  const p = (x: number, y: number): string => `${round2(x + j())},${round2(y + j())}`;
  return (
    `M${p(x0 + rad, y0)} L${p(x1 - rad, y0)} Q${p(x1, y0)} ${p(x1, y0 + rad)} L${p(x1, y1 - rad)} ` +
    `Q${p(x1, y1)} ${p(x1 - rad, y1)} L${p(x0 + rad, y1)} Q${p(x0, y1)} ${p(x0, y1 - rad)} L${p(x0, y0 + rad)} ` +
    `Q${p(x0, y0)} ${p(x0 + rad, y0)}Z`
  );
}

function underlinePath(textW: number, padX: number, y: number, fontPx: number, seed: number): { d: string; len: number } {
  const r = rng(seed);
  const seg = Math.max(2, Math.round(textW / (fontPx * 0.45)));
  const step = textW / seg;
  let d = `M${round2(padX)},${round2(y)}`, len = 0, px = padX, py = y;
  for (let i = 0; i < seg; i++) {
    const nx = padX + (i + 1) * step, ny = y + r.range(-0.02, 0.02) * fontPx;
    const cy = y + (i % 2 === 0 ? 1 : -1) * (0.07 + r.range(-0.015, 0.015)) * fontPx;
    d += ` Q${round2((px + nx) / 2)},${round2(cy)} ${round2(nx)},${round2(ny)}`;
    len += Math.hypot(nx - px, ny - py) * 1.12;
    px = nx; py = ny;
  }
  return { d, len: round2(len) };
}

/* ------------------------------ timing ------------------------------ */
interface Timing { fe: number; fx: number; squeezed: boolean; end: number; exitStart: number; exitDur: number; lastEntEnd: number; rest: number }

/**
 * Chunk timing. Entrances are pinned to speech (spoken start - 2f). The chunk then needs
 * entrance + >=6f rest + 6f exit (+1f per extra line) before the next chunk starts.
 * If the next chunk is too close ("touching"), we give up, in this order (section 7 + 6):
 *   1. rest (down to 2f)        2. exit (down to 3f)        3. entrance, proportionally (down to 2f)
 */
function schedule(starts: number[], baseDurs: number[], nLines: number, endDesired: number, limit: number): Timing {
  const stagger = (nLines - 1) * TIMING.exitLineStagger;
  const durs = (fe: number): number[] => baseDurs.map((d) => Math.max(TIMING.minPhase, Math.round(d * fe)));
  const lastEnd = (fe: number): number => Math.max(...starts.map((s, i) => s + durs(fe)[i]));
  const exitOf = (fx: number): number => Math.max(3, Math.round(TIMING.exitFrames * fx));
  const s0 = Math.min(...starts);

  const need1 = lastEnd(1) + TIMING.minRest + exitOf(1) + stagger;
  if (limit >= need1) {
    const end = Math.min(limit, Math.max(endDesired, need1));
    const exitStart = end - stagger - exitOf(1);
    return { fe: 1, fx: 1, squeezed: false, end, exitStart, exitDur: exitOf(1), lastEntEnd: lastEnd(1), rest: exitStart - lastEnd(1) };
  }
  const end = Math.max(limit, s0 + 5);
  for (const fe of [1, 0.85, 0.7, 0.55, 0.4, 0.3]) {
    for (const fx of [1, 0.67, 0.5]) {
      const exitStart = end - stagger - exitOf(fx);
      const rest = exitStart - lastEnd(fe);
      if (rest >= 2) return { fe, fx, squeezed: true, end, exitStart, exitDur: exitOf(fx), lastEntEnd: lastEnd(fe), rest };
    }
  }
  const exitStart = end - stagger - exitOf(0.5);
  return { fe: 0.3, fx: 0.5, squeezed: true, end, exitStart, exitDur: exitOf(0.5), lastEntEnd: lastEnd(0.3), rest: exitStart - lastEnd(0.3) };
}

/* ------------------------------ build ------------------------------ */
export function buildPlan(captions: CaptionsFile, measures: Measures, cfg: PopConfig): Plan {
  const warnings: string[] = [];
  const fps = cfg.fps;
  const q = QUALITY[cfg.quality];
  const maxWords = cfg.maxWordsPerCaption ?? CHUNKING.maxWords;
  const fitted: Fitted[] = [];
  for (const c of normalize(captions, maxWords)) fitted.push(...fit(c, measures, cfg, warnings));

  // first entrance start of every chunk (needed to stop chunk i at chunk i+1's start)
  const firstStart = fitted.map((f) => Math.max(0, Math.min(...f.src.words.map((w) => frameOf(w.startMs, fps))) - TIMING.anticipation));

  const counters = { hero: 0, accent: 0, normal: 0 };
  let colorCursor = 0;
  let prevAccent: EmphasisName | null = null;
  const chunks: ChunkPlan[] = [];
  const heroFrames: { frame: number; chunk: number; seed: number }[] = [];
  const cycle = getPresetCycle(cfg.preset);
  const isPop = cfg.preset === "playful-pop";
  const defaultNormalColor: ColorName =
    cfg.preset === "minimal-pro" ? "snowWhite" : cfg.preset === "cinematic" ? "platinumWhite" : "cream";

  fitted.forEach((ft, ci) => {
    const { src, layout, scale } = ft;
    const words: WordPlan[] = [];
    const starts: number[] = [], baseDurs: number[] = [];

    src.words.forEach((cw, j) => {
      const seed = wordSeed(ci, j);
      const r = rng(seed);
      const role = cw.role;
      const wb = layout.words[j];
      const display = displayText(role, cw.text, cfg.preset);
      const spokenStart = frameOf(cw.startMs, fps);
      const spokenEnd = Math.max(frameOf(cw.endMs, fps), spokenStart + TIMING.minSpoken);
      const entName = pickEntrance(role, counters, cfg.preset, cfg.animationStyle);
      const entStart = Math.max(0, spokenStart - TIMING.anticipation);
      const dur = entranceFrames(entName);
      starts.push(entStart); baseDurs.push(dur);
      const maxRot = role === "hero" ? MAX_ROT_HERO : MAX_ROT;
      const rot = isPop ? round2(r.range(-maxRot, maxRot)) : 0;
      const emphasis = pickEmphasis(role, derivedSeed(seed, 4), prevAccent, cfg.preset);
      if (role === "accent") prevAccent = emphasis[0];
      let color: ColorName = defaultNormalColor;
      if (role === "hero" || role === "accent") color = cycle[colorCursor++ % cycle.length];
      const hero = role === "hero";
      const back = (isPop && hero) ? blobPath(wb.box.w, wb.box.h, wb.fontPx * 0.03, derivedSeed(seed, 6)) : "";
      const needsUl = isPop && emphasis.includes("doodle-underline");
      const ul = needsUl ? underlinePath(wb.textW, wb.padX, wb.padY + wb.ascentPx + wb.descentPx * 0.45, wb.fontPx, derivedSeed(seed, 7)) : { d: "", len: 0 };
      const nStars = (isPop && hero) ? rng(derivedSeed(seed, 8)).int(q.stars[0], q.stars[1]) : 0;
      const sr = rng(derivedSeed(seed, 9));
      const stars: StarSpec[] = [];
      for (let k = 0; k < nStars; k++) {
        stars.push({
          angle: round2((k / nStars) * 360 + sr.range(-18, 18)),
          dist: round2(Math.max(wb.box.w, wb.box.h) * sr.range(0.62, 0.95)),
          size: round2(sr.range(30, 48) * cfg.unit), rot: round2(sr.range(0, 72)),
        });
      }
      const sgn = rot >= 0 ? 1 : -1;
      words.push({
        id: `w${ci}-${j}`, text: cw.text, display, role, chunk: ci, index: j, line: wb.line, color, rot,
        fontPx: round2(wb.fontPx), ascentPx: round2(wb.ascentPx), descentPx: round2(wb.descentPx), textW: round2(wb.textW),
        box: { x: round2(wb.box.x), y: round2(wb.box.y), w: round2(wb.box.w), h: round2(wb.box.h) },
        padX: round2(wb.padX), padY: round2(wb.padY),
        spokenStart, spokenEnd,
        entrance: { name: entName, start: entStart, dur },
        emphasis, emphStart: spokenStart, emphDur: spokenEnd - spokenStart,
        count: parseCount(cw.text), seed,
        backPath: back, backRot: isPop ? round2(-rot - sgn * 2.5) : 0,
        markerRot: isPop ? round2(-rot * 0.6 + sr.range(-3, 3)) : 0,
        underline: ul.d, underlineLen: ul.len, stars, wobbleSign: r.sign(),
      });
    });

    const limit = ci < fitted.length - 1 ? Math.max(firstStart[ci + 1], Math.min(...starts) + 6) : cfg.durationFrames;
    const endDesired = frameOf(src.endMs, fps);
    const t = schedule(starts, baseDurs, src.lineSizes.length, endDesired, limit);
    const notes = [...ft.notes];
    if (t.squeezed) notes.push(`next chunk is close: rest ${t.rest}f` + (t.fx < 1 ? `, exit ${t.exitDur}f` : "") + (t.fe < 1 ? `, entrances shortened to ${Math.round(t.fe * 100)}%` : ""));
    words.forEach((w, i) => { w.entrance.dur = Math.max(TIMING.minPhase, Math.round(baseDurs[i] * t.fe)); });

    const startFrame = Math.min(...starts);
    const bbox: Box = { x: round2(layout.bbox.x), y: round2(layout.bbox.y), w: round2(layout.bbox.w), h: round2(layout.bbox.h) };
    const lines = layout.lines.map((l, li) => ({
      index: li, words: words.filter((w) => w.line === li).map((w) => w.id),
      box: { x: round2(l.box.x), y: round2(l.box.y), w: round2(l.box.w), h: round2(l.box.h) },
    }));
    const lr = rng(derivedSeed(ci * 1000 + 500, 11));
    const exitRots = lines.map(() => isPop ? round2(lr.sign() * lr.range(4, 8)) : 0);
    const g = planGraphics(ci, words, bbox, startFrame, t.end, cfg, words.map((w) => w.color));
    notes.push(...g.notes);

    if (isPop) {
      for (const w of words) if (w.role === "hero") heroFrames.push({ frame: w.spokenStart, chunk: ci, seed: w.seed });
    }

    chunks.push({
      index: ci, startFrame, endFrame: t.exitStart + t.exitDur + (lines.length - 1) * TIMING.exitLineStagger,
      exitStart: t.exitStart, exitDur: t.exitDur, restFrames: t.rest, fontScale: scale,
      words, lines, bbox, origin: { x: round2(bbox.x + bbox.w / 2), y: round2(bbox.y + bbox.h / 2) },
      shakes: [], exitRots, doodles: g.doodles, bursts: g.bursts, confetti: g.confetti, halftone: g.halftone, notes,
    });
  });

  // camera shakes: global rule "max one per 20 frames"
  const ok = new Set(scheduleShakes(heroFrames.map((h) => h.frame)));
  for (const h of heroFrames) {
    if (!ok.has(h.frame)) continue;
    ok.delete(h.frame);
    const a = rng(derivedSeed(h.seed, 12)).range(0, Math.PI * 2);
    chunks[h.chunk].shakes.push({ frame: h.frame, dx: round2(Math.cos(a)), dy: round2(Math.sin(a)) });
  }

  for (const c of chunks) for (const n of c.notes) warnings.push(`chunk ${c.index}: ${n}`);
  return { config: cfg, chunks, warnings };
}

export { measureKeyOf };
