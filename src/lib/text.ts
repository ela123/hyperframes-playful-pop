// Text heuristics shared by analyze (build time) and plan (fills missing roles).
import type { CaptionWord, CountSpec, Role } from "../types.ts";
import { CHUNKING } from "../tokens.ts";

export const STOPWORDS = new Set(
  ("the of and to a an in on at for with from by as or but if so is are was were be been it its this that these those " +
    "i you he she we they me him her us them my your our their his than then there here into onto over up out about")
    .split(" "),
);

export const lettersOnly = (s: string): string => s.replace(/[^\p{L}]/gu, "");
export const isAllCaps = (s: string): boolean => {
  const l = lettersOnly(s);
  return l.length >= 2 && l === l.toUpperCase() && l !== l.toLowerCase();
};
export const endsStrong = (s: string): boolean => /[.!?…]["')\]]*$/.test(s);
export const endsWeak = (s: string): boolean => /[,;:\u2014\u2013-]["')\]]*$/.test(s);

/* ---------- numbers ---------- */
const core = (s: string): string => s.replace(/[.,!?;:"')\]]+$/g, "").replace(/^["'(\[]+/g, "");

export function isOrdinal(s: string): boolean { return /^\d+(st|nd|rd|th)$/i.test(core(s)); }
export function isYear(s: string): boolean {
  const c = core(s);
  return /^\d{4}$/.test(c) && +c >= 1900 && +c <= 2100;
}
export function isPhone(s: string): boolean {
  const c = core(s);
  if (/^\+?\(?\d{2,4}\)?[-. ]\d{2,4}([-. ]\d{2,6})+$/.test(c)) return true;
  return /^\+?\d{7,}$/.test(c);
}
export function isPlainNumber(s: string): boolean {
  return /\d/.test(s) && !isOrdinal(s) && !isYear(s) && !isPhone(s) && parseCount(s) !== null;
}

/** count-up spec for numbers; null for years, phones, ordinals and anything that is not a plain number. */
export function parseCount(text: string): CountSpec | null {
  if (isOrdinal(text) || isYear(text) || isPhone(text)) return null;
  const m = /^([$\u20AC\u00A3]?)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(%|[kKmMbB]|x)?([.,!?;:"')\]]*)$/.exec(text);
  if (!m) return null;
  const commas = m[2].includes(",");
  const value = parseFloat(m[2].replace(/,/g, "") + (m[3] ?? ""));
  if (!isFinite(value)) return null;
  return { value, decimals: m[3] ? m[3].length - 1 : 0, prefix: m[1] ?? "", suffix: m[4] ?? "", commas, tail: m[5] ?? "" };
}

export function formatCount(c: CountSpec, progress: number): string {
  const v = c.value * progress;
  let s = c.decimals > 0 ? v.toFixed(c.decimals) : String(Math.round(v));
  if (c.commas) {
    const [i, d] = s.split(".");
    s = i.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (d ? "." + d : "");
  }
  return c.prefix + s + c.suffix + c.tail;
}

/* ---------- role heuristics (analyze) ---------- */
export function baseRole(text: string): Role {
  const l = lettersOnly(text);
  if (/\d/.test(text)) return isPlainNumber(text) ? "hero" : "normal";
  if (STOPWORDS.has(l.toLowerCase())) return "connector";
  if (isAllCaps(text)) return "hero";
  if (l.length >= 7) return "hero";
  if (l.length >= 5) return "accent";
  return "normal";
}

/** Assign roles for a chunk's words: at most one hero (extra heroes demote to accent), accents capped at 2. */
export function assignRoles(words: CaptionWord[]): void {
  const roles = words.map((w) => baseRole(w.text));
  const score = (w: CaptionWord, i: number): number => {
    const l = lettersOnly(w.text).length;
    if (/\d/.test(w.text)) return 100 + l;
    if (isAllCaps(w.text)) return 50 + l;
    return l;
  };
  const heroIdx = roles.map((r, i) => (r === "hero" ? i : -1)).filter((i) => i >= 0);
  if (heroIdx.length > 1) {
    heroIdx.sort((a, b) => score(words[b], b) - score(words[a], a));
    for (const i of heroIdx.slice(1)) roles[i] = "accent";
  }
  // clause emphasis: last content word of the chunk becomes an accent if nothing else is
  if (!roles.includes("accent") && !roles.includes("hero")) {
    for (let i = words.length - 1; i >= 0; i--) {
      if (roles[i] === "normal" && lettersOnly(words[i].text).length >= 4) { roles[i] = "accent"; break; }
    }
  }
  const accIdx = roles.map((r, i) => (r === "accent" ? i : -1)).filter((i) => i >= 0);
  if (accIdx.length > 2) {
    accIdx.sort((a, b) => lettersOnly(words[b].text).length - lettersOnly(words[a].text).length);
    for (const i of accIdx.slice(2)) roles[i] = "normal";
  }
  words.forEach((w, i) => { w.role = roles[i]; });
}

/* ---------- chunking ---------- */
export interface ChunkDraft { words: CaptionWord[] }

/** Greedy chunker: <= maxWords, break at strong punctuation / pauses, prefer a natural break when forced to split. */
export function chunkWords(words: CaptionWord[], maxWords = CHUNKING.maxWords): CaptionWord[][] {
  const out: CaptionWord[][] = [];
  let cur: CaptionWord[] = [];
  const flush = (): void => { if (cur.length) out.push(cur); cur = []; };
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    cur.push(w);
    const next = words[i + 1];
    if (!next) break;
    const gap = next.startMs - w.endMs;
    const strong = endsStrong(w.text);
    const pause = gap > CHUNKING.pauseMs;
    if (strong || (pause && cur.length >= 2)) { flush(); continue; }
    if (cur.length >= maxWords) {
      // forced split: back up to the best natural boundary in the last 3 words
      let cut = cur.length;
      for (let k = cur.length - 1; k >= Math.max(2, cur.length - 3); k--) {
        if (endsWeak(cur[k - 1].text)) { cut = k; break; }
        const g = cur[k].startMs - cur[k - 1].endMs;
        if (g > 120) { cut = k; break; }
      }
      const rest = cur.slice(cut);
      cur = cur.slice(0, cut);
      flush();
      cur = rest;
    }
  }
  flush();
  return out;
}

/** Split a chunk's words into <= 2 lines (balanced by character count, preferring punctuation breaks). */
export function splitLines(words: CaptionWord[]): CaptionWord[][] {
  if (words.length <= 3) return [words];
  const total = words.reduce((n, w) => n + w.text.length + 1, 0);
  let best = 1, bestCost = Infinity, run = 0;
  for (let i = 1; i < words.length; i++) {
    run += words[i - 1].text.length + 1;
    let cost = Math.abs(run - (total - run));
    if (endsWeak(words[i - 1].text) || endsStrong(words[i - 1].text)) cost -= 4;
    if (cost < bestCost) { bestCost = cost; best = i; }
  }
  return [words.slice(0, best), words.slice(best)];
}
