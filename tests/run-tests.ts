// Dependency-free unit tests (node:assert). Run: npm test
import assert from "node:assert/strict";
import { mulberry32, rng } from "../src/lib/prng.ts";
import { springEase, dropBounce } from "../src/lib/easing.ts";
import { isOrdinal, isPhone, isYear, parseCount, formatCount, baseRole } from "../src/lib/text.ts";
import { resolveConfig } from "../src/config.ts";
import { buildPlan, collectMeasureKeys } from "../src/plan.ts";
import { heuristicMeasure } from "../src/lib/layout.ts";
import { chunkVis } from "../src/state.ts";
import { planChecks } from "../src/checks.ts";
import { entranceState } from "../src/entrances.ts";
import type { CaptionsFile, Measures } from "../src/types.ts";
import { analyzeWords } from "../scripts/analyze.ts";

let passed = 0;
const t = (name: string, fn: () => void): void => { fn(); passed++; console.log("  ok", name); };

t("prng is deterministic and seed-sensitive", () => {
  const a = mulberry32(42), b = mulberry32(42), c = mulberry32(43);
  const sa = [a(), a(), a()], sb = [b(), b(), b()];
  assert.deepEqual(sa, sb);
  assert.notEqual(sa[0], c());
  assert.ok(rng(1).range(-4, 4) >= -4);
});

t("springEase: starts 0, ends 1, overshoot capped", () => {
  const e = springEase(1, { damping: 9, stiffness: 260, overshoot: 0.15 });
  assert.equal(e(0), 0); assert.equal(e(1), 1);
  let peak = 0;
  for (let i = 0; i <= 100; i++) peak = Math.max(peak, e(i / 100));
  assert.ok(peak > 1.05 && peak <= 1.1501, `peak ${peak}`);
  assert.ok(Math.abs(e(0.999) - 1) < 0.02);
});

t("dropBounce falls then bounces twice", () => {
  assert.equal(dropBounce(0), 1); assert.equal(dropBounce(1), 0);
  assert.ok(dropBounce(0.6) > dropBounce(0.83) && dropBounce(0.83) > 0);
});

t("count-up skips years, phones, ordinals", () => {
  assert.ok(isYear("2024") && isYear("1999.") && !isYear("2500"));
  assert.ok(isOrdinal("1st") && isOrdinal("22nd,"));
  assert.ok(isPhone("555-123-4567") && isPhone("+14155552671"));
  assert.equal(parseCount("2024"), null); assert.equal(parseCount("3rd"), null); assert.equal(parseCount("555-123-4567"), null);
  const c = parseCount("$1,250.50,")!;
  assert.equal(c.value, 1250.5); assert.equal(formatCount(c, 1), "$1,250.50,"); assert.equal(formatCount(c, 0), "$0.00,");
  assert.equal(formatCount(parseCount("20%")!, 0.5), "10%");
  assert.equal(baseRole("2024"), "normal"); assert.equal(baseRole("20"), "hero"); assert.equal(baseRole("the"), "connector");
});

// ---- synthetic transcript (about 22 s) ----
const TEXT = ("Twenty years ago I built my first company in a tiny garage. It was TERRIBLE, honestly, but we kept going! " +
  "By 2019 we had grown to 150 people. Nobody believed it. Then everything changed overnight, and the future looked incredible. " +
  "Now we ship products that millions of customers love. Simple. Fast. Beautiful. Try it today.").split(" ");
const words = TEXT.map((text, i) => ({ text, startMs: 300 + i * 330 + (i % 9 === 8 ? 300 : 0) + Math.floor(i / 9) * 120, endMs: 300 + i * 330 + 280 + (i % 9 === 8 ? 300 : 0) + Math.floor(i / 9) * 120 }));
const captions = analyzeWords(words) as CaptionsFile;
const cfg = resolveConfig({ quality: "final", video: "assets/intro.mp4", footageIsLight: false, durationSec: 30 });
const measures: Measures = {};
for (const k of collectMeasureKeys(captions)) measures[k.key] = heuristicMeasure(k);
const plan = buildPlan(captions, measures, cfg);

t("analyze: <=6 words, <=2 lines, <=1 hero per chunk", () => {
  for (const c of captions.chunks!) {
    const ws = c.lines.flatMap((l) => l.words);
    assert.ok(ws.length <= 6 && c.lines.length <= 2);
    assert.ok(ws.filter((w) => w.role === "hero").length <= 1);
  }
});

t("plan: chunks, layout inside safe area, bottom >= 12%", () => {
  assert.ok(plan.chunks.length >= 6);
  for (const c of plan.chunks) {
    assert.ok(c.fontScale >= 0.7);
    for (const w of c.words) {
      assert.ok(w.box.x >= cfg.width * 0.08 - 1 && w.box.x + w.box.w <= cfg.width * 0.92 + 1, `x ${w.box.x}`);
      assert.ok(w.box.y + w.box.h <= cfg.height * 0.88 + 1);
    }
  }
});

t("plan checks 4-6 + timing pass on a realistic transcript", () => {
  for (const r of planChecks(plan)) assert.ok(r.ok, `${r.name}: ${r.lines.filter((l) => !l.includes("margin ")).join(" | ")}`);
});

t("heroes alternate entrances; accents alternate; roles map to entrances", () => {
  const heroes = plan.chunks.flatMap((c) => c.words).filter((w) => w.role === "hero").map((w) => w.entrance.name);
  heroes.forEach((n, i) => assert.equal(n, i % 2 === 0 ? "sticker-slap" : "spin-pop"));
  const acc = plan.chunks.flatMap((c) => c.words).filter((w) => w.role === "accent").map((w) => w.entrance.name);
  acc.forEach((n, i) => assert.equal(n, i % 2 === 0 ? "jelly" : "drop-bounce"));
  for (const w of plan.chunks.flatMap((c) => c.words)) {
    if (w.role === "connector") assert.equal(w.entrance.name, "fade-pop");
    if (w.role === "normal" || w.role === "connector") assert.deepEqual(w.emphasis, []);
    if (w.role === "hero") assert.deepEqual(w.emphasis, ["marker-highlight", "star-burst"]);
    if (w.role === "accent") assert.equal(w.emphasis.length, 1);
  }
});

t("accent emphasis never repeats the previous accent", () => {
  const acc = plan.chunks.flatMap((c) => c.words).filter((w) => w.role === "accent").map((w) => w.emphasis[0]);
  for (let i = 1; i < acc.length; i++) assert.notEqual(acc[i], acc[i - 1]);
});

t("shakes: at most one per 20 frames", () => {
  const f = plan.chunks.flatMap((c) => c.shakes.map((s) => s.frame)).sort((a, b) => a - b);
  for (let i = 1; i < f.length; i++) assert.ok(f[i] - f[i - 1] >= 20);
});

t("state is a pure function of the frame (order-independent)", () => {
  const c = plan.chunks[2];
  const frames = [c.startFrame, c.startFrame + 5, c.exitStart, c.endFrame - 1];
  const a = frames.map((f) => JSON.stringify(chunkVis(c, f, cfg)));
  const b = [...frames].reverse().map((f) => JSON.stringify(chunkVis(c, f, cfg))).reverse();
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(plan), JSON.stringify(buildPlan(captions, measures, cfg)), "plan must be reproducible");
});

t("words are invisible before their entrance and hidden after the chunk", () => {
  const c = plan.chunks[1];
  const w = c.words[c.words.length - 1];
  const v0 = chunkVis(c, w.entrance.start - 1, cfg);
  assert.equal(v0.words[c.words.length - 1].o, 0);
  assert.equal(chunkVis(c, c.endFrame, cfg).visible, false);
  assert.equal(entranceState("pop", -0.1, 1).o, 0);
});

t("very short chunk (<20 frames) still schedules without overlap", () => {
  const caps: CaptionsFile = { chunks: [
    { startMs: 0, endMs: 400, lines: [{ words: [{ text: "Wow", startMs: 100, endMs: 350, role: "hero" }] }] },
    { startMs: 450, endMs: 1500, lines: [{ words: [{ text: "that", startMs: 500, endMs: 700 }, { text: "worked", startMs: 700, endMs: 1100 }] }] },
  ] };
  const ms: Measures = {};
  for (const k of collectMeasureKeys(caps)) ms[k.key] = heuristicMeasure(k);
  const p = buildPlan(caps, ms, cfg);
  assert.ok(p.chunks[0].endFrame <= p.chunks[1].startFrame);
  assert.ok(p.chunks[0].endFrame - p.chunks[0].startFrame < 20);
  assert.ok(p.chunks[0].restFrames >= 0);
});

t("preview and final share one design (same words/roles/timing)", () => {
  const pc = resolveConfig({ quality: "preview", video: "assets/intro.mp4", footageIsLight: false, durationSec: 30 });
  const pp = buildPlan(captions, measures, pc);
  assert.equal(pp.chunks.length, plan.chunks.length);
  assert.deepEqual(pp.chunks.map((c) => c.startFrame), plan.chunks.map((c) => c.startFrame));
  assert.ok(pp.chunks.every((c) => c.confetti.length <= 6 * Math.max(1, c.words.filter((w) => w.role === "hero").length)));
});

t("Minimal Professional preset: clean typography, pill highlight, no decorative clutter", () => {
  const minCfg = resolveConfig({
    quality: "final", video: "assets/intro.mp4", footageIsLight: false, durationSec: 30,
    preset: "minimal-pro", position: "bottom", aspectRatio: "16:9",
  });
  const minMeasures: Measures = {};
  for (const k of collectMeasureKeys(captions, minCfg)) minMeasures[k.key] = heuristicMeasure(k);
  const minPlan = buildPlan(captions, minMeasures, minCfg);

  assert.equal(minPlan.config.preset, "minimal-pro");
  // All words must have 0 rotation for a crisp professional look
  for (const c of minPlan.chunks) {
    for (const w of c.words) {
      assert.equal(w.rot, 0, `word ${w.text} has non-zero rot`);
      if (w.role === "hero") assert.deepEqual(w.emphasis, ["pill-highlight"]);
      if (w.role === "accent") assert.deepEqual(w.emphasis, ["accent-color"]);
      assert.equal(w.stars.length, 0);
    }
    // No comic doodles, confetti, or bursts in Minimal Professional
    assert.equal(c.doodles.length, 0);
    assert.equal(c.confetti.length, 0);
    assert.equal(c.bursts.length, 0);
    assert.equal(c.shakes.length, 0);
  }
  for (const r of planChecks(minPlan)) assert.ok(r.ok, `${r.name}: ${r.lines.join(" | ")}`);
});

t("Cinematic Modern preset: widescreen tracking, golden accents, cinematic drift", () => {
  const cineCfg = resolveConfig({
    quality: "final", video: "assets/intro.mp4", footageIsLight: false, durationSec: 30,
    preset: "cinematic", position: "bottom", aspectRatio: "16:9",
  });
  const cineMeasures: Measures = {};
  for (const k of collectMeasureKeys(captions, cineCfg)) cineMeasures[k.key] = heuristicMeasure(k);
  const cinePlan = buildPlan(captions, cineMeasures, cineCfg);

  assert.equal(cinePlan.config.preset, "cinematic");
  for (const c of cinePlan.chunks) {
    for (const w of c.words) {
      assert.equal(w.rot, 0);
      assert.equal(w.display, w.text.toUpperCase());
      if (w.role === "hero") {
        assert.equal(w.entrance.name, "cinematic-drift");
        assert.deepEqual(w.emphasis, ["cinematic-glow"]);
      }
    }
    assert.equal(c.doodles.length, 0);
    assert.equal(c.confetti.length, 0);
  }
  for (const r of planChecks(cinePlan)) assert.ok(r.ok, `${r.name}: ${r.lines.join(" | ")}`);
});

t("Aspect ratios & positions: 16:9 YouTube, 9:16 Shorts/TikTok, 1:1 Square", () => {
  const r169 = resolveConfig({ quality: "final", video: "x", footageIsLight: false, durationSec: 10, aspectRatio: "16:9", position: "bottom" });
  assert.equal(r169.width, 1920); assert.equal(r169.height, 1080);

  const r916 = resolveConfig({ quality: "final", video: "x", footageIsLight: false, durationSec: 10, aspectRatio: "9:16", position: "bottom" });
  assert.equal(r916.width, 1080); assert.equal(r916.height, 1920);

  const rCenter = resolveConfig({ quality: "final", video: "x", footageIsLight: false, durationSec: 10, aspectRatio: "9:16", position: "center" });
  const pCenter = buildPlan(captions, measures, rCenter);
  // Center position should position captions near vertical middle (~960px for 1920 height)
  const midChunk = pCenter.chunks[0];
  assert.ok(midChunk.bbox.y > 600 && midChunk.bbox.y < 1300, `center y: ${midChunk.bbox.y}`);

  const r11 = resolveConfig({ quality: "final", video: "x", footageIsLight: false, durationSec: 10, aspectRatio: "1:1", position: "top" });
  assert.equal(r11.width, 1080); assert.equal(r11.height, 1080);
});

t("34-minute video scalability benchmark (61,200 frames, ~1,200 chunks)", () => {
  // Generate a realistic 34-minute transcript (2040 seconds)
  const durationSec = 34 * 60; // 2040 seconds
  const totalWords = 4800; // ~141 words/min
  const longWords: { text: string; startMs: number; endMs: number }[] = [];
  const vocab = ["growth", "innovation", "design", "speed", "quality", "experience", "performance", "future", "simple", "power"];
  let tCur = 500;
  for (let i = 0; i < totalWords; i++) {
    const isPause = i % 5 === 4;
    const dur = 280 + (i % 3) * 40;
    const word = vocab[i % vocab.length] + (isPause ? "." : "");
    longWords.push({ text: word, startMs: tCur, endMs: tCur + dur });
    tCur += dur + (isPause ? 260 : 60);
    if (tCur > durationSec * 1000 - 2000) break;
  }
  const longCaps = analyzeWords(longWords) as CaptionsFile;
  assert.ok(longCaps.chunks!.length > 800, `chunks count: ${longCaps.chunks!.length}`);

  const longCfg = resolveConfig({
    quality: "final", video: "assets/intro.mp4", footageIsLight: false, durationSec,
    preset: "minimal-pro", position: "bottom",
  });
  assert.equal(longCfg.durationFrames, 34 * 60 * 30); // 61,200 frames

  const tStart = Date.now();
  const longMeasures: Measures = {};
  for (const k of collectMeasureKeys(longCaps, longCfg)) longMeasures[k.key] = heuristicMeasure(k);
  const longPlan = buildPlan(longCaps, longMeasures, longCfg);
  const planDurationMs = Date.now() - tStart;

  // Plan generation must be extremely fast even on 34-minute videos (< 15s for 4,800 words on low-spec hardware)
  assert.ok(planDurationMs < 15000, `plan generation took ${planDurationMs}ms (expected <15000ms)`);
  assert.ok(longPlan.chunks.length > 800);

  // Check no overlaps across all 34 minutes
  for (let i = 1; i < longPlan.chunks.length; i++) {
    assert.ok(
      longPlan.chunks[i - 1].endFrame <= longPlan.chunks[i].startFrame,
      `chunk overlap at ${i}: ${longPlan.chunks[i - 1].endFrame} > ${longPlan.chunks[i].startFrame}`
    );
  }

  // Check determinism at distant frames across 34 minutes
  const fCheck = [100, 15000, 30000, 45000, 60000];
  for (const f of fCheck) {
    const ch = longPlan.chunks.find((c) => f >= c.startFrame && f < c.endFrame);
    if (ch) {
      const v1 = chunkVis(ch, f, longCfg);
      const v2 = chunkVis(ch, f, longCfg);
      assert.deepEqual(v1, v2);
    }
  }
});

console.log(`\n${passed} tests passed`);
