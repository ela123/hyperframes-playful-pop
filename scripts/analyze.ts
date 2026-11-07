// assets/words.raw.json (word-level) -> assets/captions.json (roles + chunks + lines). Schema unchanged.
import { readFileSync, writeFileSync } from "node:fs";
import type { CaptionChunk, CaptionWord } from "../src/types.ts";
import { assignRoles, chunkWords, splitLines } from "../src/lib/text.ts";
import { CHUNKING, TIMING } from "../src/tokens.ts";
import { P, loadUserConfig } from "./common.ts";

export function analyzeWords(words: CaptionWord[], maxWords = CHUNKING.maxWords): { fps: number; chunks: CaptionChunk[] } {
  const groups = chunkWords(words.map((w) => ({ text: w.text, startMs: Math.round(w.startMs), endMs: Math.round(w.endMs) })), maxWords);
  const chunks: CaptionChunk[] = groups.map((g, i) => {
    assignRoles(g);
    const next = groups[i + 1];
    const last = g[g.length - 1];
    const endMs = Math.min(last.endMs + CHUNKING.tailMs, next ? next[0].startMs : Infinity);
    return { startMs: g[0].startMs, endMs: Math.max(endMs, last.endMs), lines: splitLines(g).map((l) => ({ words: l })) };
  });
  return { fps: TIMING.fps, chunks };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("analyze.ts")) {
  const raw = JSON.parse(readFileSync(P.rawWords, "utf8"));
  const words: CaptionWord[] = Array.isArray(raw) ? raw : raw.words;
  const user = loadUserConfig();
  const out = analyzeWords(words, user.maxWordsPerCaption || CHUNKING.maxWords);
  writeFileSync(P.captions, JSON.stringify(out, null, 2) + "\n");
  const n = out.chunks.reduce((s, c) => s + c.lines.reduce((m, l) => m + l.words.length, 0), 0);
  console.log(`captions.json: ${out.chunks.length} chunks, ${n} words -> ${P.captions}`);
  console.log("Hand-edit it freely (roles, text, timings), then run: npm run build");
}
