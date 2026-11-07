// Text measurement + line layout. Measurement happens ONCE, at build time, in a real browser with the real
// self-hosted fonts (scripts/measure.ts). Widths are stored in em so a single measurement serves every size.
// Layout itself is a pure function of those measurements.
import type { Box, Measure, MeasureKey, Measures, PopConfig, PresetName, Role } from "../types.ts";
import { BASE_FONT_PX, FONTS, getPresetBaseFontPx, getPresetFonts, getPresetScale, getSafeArea, SAFE, SCALE } from "../tokens.ts";

export function displayText(role: Role, text: string, preset: PresetName = "playful-pop"): string {
  if (preset === "cinematic") return text.toUpperCase();
  if (preset === "minimal-pro") return role === "connector" ? text.toLowerCase() : text;
  return role === "hero" ? text.toUpperCase() : role === "connector" ? text.toLowerCase() : text;
}
export const measureKeyOf = (role: Role, display: string): string => `${role}|${display}`;

export function toMeasureKey(role: Role, text: string, preset: PresetName = "playful-pop", fontOverride?: string): MeasureKey {
  const display = displayText(role, text, preset);
  const f = getPresetFonts(preset, fontOverride)[role] || FONTS[role];
  return { key: measureKeyOf(role, display), family: f.family, weight: f.weight, text: display };
}

/** Browser-side measurement as source text, executed by puppeteer after fonts are loaded. */
export const BROWSER_MEASURE_SOURCE = `
async (items) => {
  const c = document.createElement("canvas").getContext("2d");
  const out = {};
  const seen = new Set();
  for (const it of items) {
    const font = it.weight + " 100px \\"" + it.family + "\\"";
    if (!seen.has(font)) { await document.fonts.load(font, "AaBb"); seen.add(font); }
  }
  await document.fonts.ready;
  for (const it of items) {
    c.font = it.weight + " 100px \\"" + it.family + "\\"";
    const m = c.measureText(it.text);
    out[it.key] = { w: m.width / 100, ascent: m.fontBoundingBoxAscent / 100, descent: m.fontBoundingBoxDescent / 100 };
  }
  return out;
}`;

/** Fallback when no browser is available. Roughly right, flagged loudly by build.ts. */
export function heuristicMeasure(k: MeasureKey): Measure {
  const hero = k.family === "Lilita One";
  const avg = hero ? 0.56 : k.weight >= 700 ? 0.56 : k.weight >= 600 ? 0.55 : 0.53;
  let w = 0;
  for (const ch of k.text) {
    if (/[ilI.,'!|:;]/.test(ch)) w += avg * 0.5;
    else if (/[mwMW@]/.test(ch)) w += avg * 1.35;
    else if (/[A-Z0-9]/.test(ch)) w += avg * 1.08;
    else w += avg;
  }
  return { w, ascent: hero ? 0.93 : 0.97, descent: hero ? 0.26 : 0.24 };
}

export interface LayoutItem { role: Role; display: string }
export interface WordBox {
  box: Box; line: number; fontPx: number; ascentPx: number; descentPx: number; textW: number; padX: number; padY: number;
}
export interface LayoutResult {
  words: WordBox[];
  lines: { box: Box; count: number }[];
  bbox: Box;
  maxLineW: number;
}

export const maxLineWidth = (cfg: PopConfig): number => {
  const safe = cfg.aspectRatio && cfg.position ? getSafeArea(cfg.aspectRatio, cfg.position) : SAFE;
  return cfg.width * (1 - 2 * safe.side);
};

export function roleFontPx(role: Role, chunkScale: number, cfg: PopConfig): number {
  const basePx = cfg.preset ? getPresetBaseFontPx(cfg.preset, cfg.fontSizeMultiplier) : BASE_FONT_PX;
  const roleScale = cfg.preset ? getPresetScale(cfg.preset)[role] : SCALE[role];
  return basePx * cfg.unit * roleScale * chunkScale;
}

export function layoutChunk(
  items: LayoutItem[], lineSizes: number[], chunkScale: number, measures: Measures, cfg: PopConfig,
): LayoutResult {
  const u = cfg.unit;
  const basePx = (cfg.preset ? getPresetBaseFontPx(cfg.preset, cfg.fontSizeMultiplier) : BASE_FONT_PX) * u * chunkScale;
  const gap = 0.26 * basePx;
  const lineGap = 0.05 * basePx;

  const wb: WordBox[] = [];
  const lineWords: number[][] = [];
  let at = 0;
  for (let li = 0; li < lineSizes.length; li++) {
    const idxs: number[] = [];
    for (let k = 0; k < lineSizes[li]; k++, at++) idxs.push(at);
    lineWords.push(idxs);
  }
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const m = measures[measureKeyOf(it.role, it.display)];
    if (!m) throw new Error(`layout: missing measurement for ${it.role}|${it.display}`);
    const fontPx = roleFontPx(it.role, chunkScale, cfg);
    const hero = it.role === "hero";
    const padX = fontPx * (hero ? (cfg.preset === "minimal-pro" ? 0.12 : 0.2) : 0.06);
    const padY = fontPx * (hero ? (cfg.preset === "minimal-pro" ? 0.08 : 0.12) : 0.04);
    const textW = m.w * fontPx;
    const ascentPx = m.ascent * fontPx;
    const descentPx = m.descent * fontPx;
    wb.push({
      box: { x: 0, y: 0, w: textW + 2 * padX, h: ascentPx + descentPx + 2 * padY },
      line: 0, fontPx, ascentPx, descentPx, textW, padX, padY,
    });
  }

  // per line: baseline-aligned
  const lineGeom: { w: number; asc: number; desc: number }[] = lineWords.map((idxs) => {
    let w = 0, asc = 0, desc = 0;
    idxs.forEach((i, k) => {
      w += wb[i].box.w + (k > 0 ? gap : 0);
      asc = Math.max(asc, wb[i].padY + wb[i].ascentPx);
      desc = Math.max(desc, wb[i].descentPx + wb[i].padY);
    });
    return { w, asc, desc };
  });
  const blockH = lineGeom.reduce((n, l, i) => n + l.asc + l.desc + (i > 0 ? lineGap : 0), 0);
  const safe = cfg.aspectRatio && cfg.position ? getSafeArea(cfg.aspectRatio, cfg.position) : SAFE;
  
  let y: number;
  if (cfg.position === "center") {
    y = (cfg.height - blockH) / 2;
  } else if (cfg.position === "top") {
    y = cfg.height * safe.top;
  } else {
    // bottom
    const bottom = cfg.height * (1 - safe.bottom) - 0.03 * cfg.height;
    y = bottom - blockH;
  }

  const lines: LayoutResult["lines"] = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  lineWords.forEach((idxs, li) => {
    const g = lineGeom[li];
    let x = (cfg.width - g.w) / 2;
    const baseline = y + g.asc;
    for (const i of idxs) {
      const w = wb[i];
      w.line = li;
      w.box.x = x;
      w.box.y = baseline - (w.padY + w.ascentPx);
      x += w.box.w + gap;
      minX = Math.min(minX, w.box.x); minY = Math.min(minY, w.box.y);
      maxX = Math.max(maxX, w.box.x + w.box.w); maxY = Math.max(maxY, w.box.y + w.box.h);
    }
    lines.push({ box: { x: (cfg.width - g.w) / 2, y, w: g.w, h: g.asc + g.desc }, count: idxs.length });
    y += g.asc + g.desc + lineGap;
  });

  return {
    words: wb,
    lines,
    bbox: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
    maxLineW: Math.max(...lineGeom.map((l) => l.w)),
  };
}
