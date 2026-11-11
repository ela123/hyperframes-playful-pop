// captions.json (or config.captions) + measurements + config  ->  Plan (fully baked: layout, timing).
// Pure, deterministic, anti-distraction architecture.
import type {
  Box, CaptionWord, CaptionsFile, ChunkPlan, ColorName, EmphasisName, Measures, MeasureKey, Plan, PopConfig,
  Role, WordPlan,
} from "./types.ts";
import { CHUNKING, MIN_FONT_SCALE, TIMING, getPresetCycle } from "./tokens.ts";
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

/* ------------------------------ normalise captions ------------------------------ */
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

export function normalize(captions: CaptionsFile, maxWords = CHUNKING.maxWords, cfg?: PopConfig): SrcChunk[] {
  const out: SrcChunk[] = [];

  // Single config file convenience: if inline captions are provided in pop.config.json, use them directly!
  if (cfg?.captions && cfg.captions.length > 0) {
    for (const item of cfg.captions) {
      const parts = item.text.trim().split(/\s+/).filter(Boolean);
      if (!parts.length) continue;
      const count = parts.length;
      const totalDur = Math.max(100, item.endMs - item.startMs);
      const step = totalDur / count;
      const words: CaptionWord[] = parts.map((w, idx) => {
        const isHero = item.hero ? w.toLowerCase().replace(/[^a-z0-9]/g, "") === item.hero.toLowerCase().replace(/[^a-z0-9]/g, "") : idx === 0;
        return {
          text: w,
          startMs: Math.round(item.startMs + idx * step),
          endMs: Math.round(item.startMs + (idx + 1) * step),
          role: (isHero ? "hero" : "normal") as Role,
        };
      });
      enforceLimits({
        words: fillRoles(words),
        lineSizes: splitLines(words).map((l) => l.length),
        endMs: item.endMs,
      }, out, maxWords);
    }
    return out;
  }

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
  const preset = cfg?.preset ?? "kinetic-pop";
  const fontOverride = cfg?.fontOverride;
  const maxWords = cfg?.maxWordsPerCaption ?? CHUNKING.maxWords;
  for (const c of normalize(captions, maxWords, cfg)) {
    for (const w of c.words) {
      const k = toMeasureKey(w.role, w.text, preset, fontOverride);
      seen.set(k.key, k);
    }
  }
  return [...seen.values()];
}

/* ------------------------------ fit: line balance, shrink (>=75%), split ------------------------------ */
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
    warnings.push(`chunk "${src.words.map((w) => w.text).join(" ")}" did not fit at >=75%: split in two`);
    const mk = (ws: typeof src.words, endMs: number): SrcChunk => ({ words: ws, lineSizes: splitLines(ws).map((l) => l.length), endMs });
    return [...fit(mk(a, a[a.length - 1].endMs), measures, cfg, warnings), ...fit(mk(b, src.endMs), measures, cfg, warnings)];
  }
  warnings.push(`word "${src.words[0].text}" is wider than the safe area even at 75%; kept at 75%`);
  const l = layoutChunk(items, lineSizes, MIN_FONT_SCALE, measures, cfg);
  return [{ src, layout: l, scale: MIN_FONT_SCALE, notes: ["single word wider than safe area"] }];
}

/* ------------------------------ timing ------------------------------ */
interface Timing { fe: number; fx: number; squeezed: boolean; end: number; exitStart: number; exitDur: number; lastEntEnd: number; rest: number }

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

/* ------------------------------ build plan ------------------------------ */
export function buildPlan(captions: CaptionsFile, measures: Measures, cfg: PopConfig): Plan {
  const warnings: string[] = [];
  const fps = cfg.fps;
  const maxWords = cfg.maxWordsPerCaption ?? CHUNKING.maxWords;
  const fitted: Fitted[] = [];
  for (const c of normalize(captions, maxWords, cfg)) fitted.push(...fit(c, measures, cfg, warnings));

  const firstStart = fitted.map((f) => Math.max(0, Math.min(...f.src.words.map((w) => frameOf(w.startMs, fps))) - TIMING.anticipation));

  const counters = { hero: 0, accent: 0, normal: 0 };
  let colorCursor = 0;
  let prevAccent: EmphasisName | null = null;
  const chunks: ChunkPlan[] = [];
  const cycle = getPresetCycle(cfg.preset);

  // Single cohesive palette: primary text color is high-contrast warm white/cream
  const defaultTextColor: ColorName = (cfg.textColorOverride as ColorName) || "canvasText";

  fitted.forEach((ft, ci) => {
    const { src, layout, scale } = ft;
    const words: WordPlan[] = [];
    const starts: number[] = [], baseDurs: number[] = [];

    // Ensure only 1 hero exists per chunk (enforcing max 1 effect per caption)
    let heroAssigned = false;

    src.words.forEach((cw, j) => {
      const seed = wordSeed(ci, j);
      let role = cw.role;
      if (role === "hero") {
        if (heroAssigned) role = "normal";
        else heroAssigned = true;
      }

      const wb = layout.words[j];
      const display = displayText(role, cw.text, cfg.preset);
      const spokenStart = frameOf(cw.startMs, fps);
      const spokenEnd = Math.max(frameOf(cw.endMs, fps), spokenStart + TIMING.minSpoken);
      const entName = pickEntrance(role, counters, cfg.preset, cfg.animationStyle);
      const entStart = Math.max(0, spokenStart - TIMING.anticipation);
      const dur = entranceFrames(entName);
      starts.push(entStart); baseDurs.push(dur);

      const emphasis = pickEmphasis(role, derivedSeed(seed, 4), prevAccent, cfg.preset);
      if (role === "accent") prevAccent = emphasis[0] || null;

      // Color assignment: Only the emphasized word uses the accent color!
      // All other words share the cohesive base text color.
      let color: ColorName = defaultTextColor;
      if (role === "hero") {
        color = (cfg.highlightColorOverride as ColorName) || cycle[colorCursor++ % cycle.length];
      }

      words.push({
        id: `w${ci}-${j}`, text: cw.text, display, role, chunk: ci, index: j, line: wb.line, color,
        rot: 0, // Zero rotation for a clean, professional, readable aesthetic
        fontPx: round2(wb.fontPx), ascentPx: round2(wb.ascentPx), descentPx: round2(wb.descentPx), textW: round2(wb.textW),
        box: { x: round2(wb.box.x), y: round2(wb.box.y), w: round2(wb.box.w), h: round2(wb.box.h) },
        padX: round2(wb.padX), padY: round2(wb.padY),
        spokenStart, spokenEnd,
        entrance: { name: entName, start: entStart, dur },
        emphasis, emphStart: spokenStart, emphDur: spokenEnd - spokenStart,
        count: parseCount(cw.text), seed,
        backPath: "", backRot: 0, markerRot: 0, underline: "", underlineLen: 0, stars: [], wobbleSign: 1,
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

    const g = planGraphics(ci, words, bbox, startFrame, t.end, cfg, words.map((w) => w.color));
    notes.push(...g.notes);

    chunks.push({
      index: ci, startFrame, endFrame: t.exitStart + t.exitDur + (lines.length - 1) * TIMING.exitLineStagger,
      exitStart: t.exitStart, exitDur: t.exitDur, restFrames: t.rest, fontScale: scale,
      words, lines, bbox, origin: { x: round2(bbox.x + bbox.w / 2), y: round2(bbox.y + bbox.h / 2) },
      shakes: [], exitRots: lines.map(() => 0), doodles: g.doodles, bursts: g.bursts, confetti: g.confetti, halftone: g.halftone, notes,
    });
  });

  for (const c of chunks) for (const n of c.notes) warnings.push(`chunk ${c.index}: ${n}`);
  return { config: cfg, chunks, warnings };
}

export { measureKeyOf };
