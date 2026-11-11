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
  const e = springEase(1, { damping: 14, stiffness: 220, overshoot: 0.12 });
  assert.equal(e(0), 0); assert.equal(e(1), 1);
  let peak = 0;
  for (let i = 0; i <= 100; i++) peak = Math.max(peak, e(i / 100));
  assert.ok(peak >= 1.0 && peak <= 1.15, `peak ${peak}`);
  assert.ok(Math.abs(e(0.999) - 1) < 0.02);
});

t("dropBounce falls then bounces", () => {
  assert.equal(dropBounce(0), 1); assert.equal(dropBounce(1), 0);
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
const cfg = resolveConfig({ quality: "final", video: "assets/intro.mp4", durationSec: 30, effect: "kinetic-pop" });
const measures: Measures = {};
for (const k of collectMeasureKeys(captions, cfg)) measures[k.key] = heuristicMeasure(k);
const plan = buildPlan(captions, measures, cfg);

t("analyze: chunk limits and word grouping", () => {
  for (const c of captions.chunks!) {
    const ws = c.lines.flatMap((l) => l.words);
    assert.ok(ws.length <= 6 && c.lines.length <= 2);
  }
});

t("plan: chunks inside safe area, non-zero margin", () => {
  assert.ok(plan.chunks.length >= 6);
  for (const c of plan.chunks) {
    assert.ok(c.fontScale >= 0.7);
    for (const w of c.words) {
      assert.ok(w.box.x >= cfg.width * 0.08 - 1 && w.box.x + w.box.w <= cfg.width * 0.92 + 1, `x ${w.box.x}`);
      assert.ok(w.box.y + w.box.h <= cfg.height * 0.88 + 1);
    }
  }
});

t("anti-distraction: zero rotation, max 1 hero per chunk, zero decorative clutter", () => {
  for (const c of plan.chunks) {
    const heroes = c.words.filter((w) => w.role === "hero");
    assert.ok(heroes.length <= 1, `chunk ${c.index} has ${heroes.length} heroes (max 1 allowed)`);
    for (const w of c.words) {
      assert.equal(w.rot, 0, `word ${w.text} has non-zero rot`);
      assert.equal(w.stars.length, 0);
    }
    assert.equal(c.doodles.length, 0);
    assert.equal(c.confetti.length, 0);
    assert.equal(c.bursts.length, 0);
    assert.equal(c.shakes.length, 0);
  }
});

t("plan checks pass on realistic transcript", () => {
  for (const r of planChecks(plan)) assert.ok(r.ok, `${r.name}: ${r.lines.filter((l) => !l.includes("margin ")).join(" | ")}`);
});

t("anti-distraction timing: all curated entrances settle within 0.15s to 0.4s", () => {
  const families = ["flicker-strobe", "kinetic-pop", "digital-decoder", "speed-slide", "typewriter-terminal"] as const;
  for (const fam of families) {
    const st = entranceState(fam, 1.0, 1, 1, "subtle");
    assert.equal(st.o, 1);
    assert.equal(st.sx, 1);
    assert.equal(st.sy, 1);
    assert.equal(st.rot, 0);
    assert.equal(st.x, 0);
    assert.equal(st.y, 0);

    // After 8 frames (0.27s), hero must be fully settled and visible
    const st8 = entranceState(fam, 1.05, 1, 1, "subtle");
    assert.equal(st8.o, 1);
    assert.equal(st8.sx, 1);
  }
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
  assert.equal(entranceState("clean-fade", -0.1, 1).o, 0);
});

t("single config file: inline captions in pop.config.json override file", () => {
  const inlineCfg = resolveConfig({
    quality: "final", video: "assets/intro.mp4", durationSec: 10,
    effect: "flicker-strobe", intensity: "subtle",
    captions: [
      { text: "Simpler cleaner artistic", startMs: 200, endMs: 2200, hero: "artistic" },
      { text: "Video first editing second", startMs: 2400, endMs: 4600, hero: "first" },
    ],
  });
  const inlineMeasures: Measures = {};
  for (const k of collectMeasureKeys(captions, inlineCfg)) inlineMeasures[k.key] = heuristicMeasure(k);
  const inlinePlan = buildPlan(captions, inlineMeasures, inlineCfg);

  assert.equal(inlinePlan.chunks.length, 2);
  const w0 = inlinePlan.chunks[0].words;
  assert.equal(w0.map((w) => w.text).join(" "), "Simpler cleaner artistic");
  const hero0 = w0.find((w) => w.role === "hero");
  assert.ok(hero0 && hero0.text === "artistic");
  assert.equal(hero0.entrance.name, "flicker-strobe");
});

t("5 curated effect templates build cleanly", () => {
  const templates = ["flicker-strobe", "kinetic-pop", "digital-decoder", "speed-slide", "typewriter-terminal"] as const;
  for (const tmpl of templates) {
    const tmplCfg = resolveConfig({
      quality: "final", video: "assets/intro.mp4", durationSec: 20,
      effect: tmpl, intensity: "subtle",
    });
    const tmplMeasures: Measures = {};
    for (const k of collectMeasureKeys(captions, tmplCfg)) tmplMeasures[k.key] = heuristicMeasure(k);
    const tmplPlan = buildPlan(captions, tmplMeasures, tmplCfg);

    assert.equal(tmplPlan.config.effect, tmpl);
    for (const c of tmplPlan.chunks) {
      assert.equal(c.doodles.length, 0);
      assert.equal(c.confetti.length, 0);
      assert.equal(c.bursts.length, 0);
      for (const w of c.words) {
        assert.equal(w.rot, 0);
        if (w.role === "hero") assert.equal(w.entrance.name, tmpl);
        else assert.equal(w.entrance.name, "clean-fade");
      }
    }
    for (const r of planChecks(tmplPlan)) assert.ok(r.ok, `${tmpl} check: ${r.name}`);
  }
});

t("intensity setting: subtle, medium, bold adjust scale & distances", () => {
  const sSub = entranceState("kinetic-pop", 0.5, 1, 1, "subtle");
  const sMed = entranceState("kinetic-pop", 0.5, 1, 1, "medium");
  const sBld = entranceState("kinetic-pop", 0.5, 1, 1, "bold");
  assert.ok(sSub.sx <= sMed.sx && sMed.sx <= sBld.sx, `subtle: ${sSub.sx}, med: ${sMed.sx}, bold: ${sBld.sx}`);
});

t("Aspect ratios & positions: 16:9 YouTube, 9:16 Shorts/TikTok, 1:1 Square", () => {
  const r169 = resolveConfig({ quality: "final", video: "x", durationSec: 10, aspectRatio: "16:9", position: "bottom" });
  assert.equal(r169.width, 1920); assert.equal(r169.height, 1080);

  const r916 = resolveConfig({ quality: "final", video: "x", durationSec: 10, aspectRatio: "9:16", position: "bottom" });
  assert.equal(r916.width, 1080); assert.equal(r916.height, 1920);

  const rCenter = resolveConfig({ quality: "final", video: "x", durationSec: 10, aspectRatio: "9:16", position: "center" });
  const pCenter = buildPlan(captions, measures, rCenter);
  const midChunk = pCenter.chunks[0];
  assert.ok(midChunk.bbox.y > 600 && midChunk.bbox.y < 1300, `center y: ${midChunk.bbox.y}`);

  const r11 = resolveConfig({ quality: "final", video: "x", durationSec: 10, aspectRatio: "1:1", position: "top" });
  assert.equal(r11.width, 1080); assert.equal(r11.height, 1080);
});

t("34-minute video scalability benchmark (61,200 frames, ~1,200 chunks)", () => {
  const durationSec = 34 * 60;
  const totalWords = 4800;
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

  const longCfg = resolveConfig({
    quality: "final", video: "assets/intro.mp4", durationSec,
    effect: "kinetic-pop", intensity: "subtle", position: "bottom",
  });
  assert.equal(longCfg.durationFrames, 34 * 60 * 30);

  const tStart = Date.now();
  const longMeasures: Measures = {};
  for (const k of collectMeasureKeys(longCaps, longCfg)) longMeasures[k.key] = heuristicMeasure(k);
  const longPlan = buildPlan(longCaps, longMeasures, longCfg);
  const planDurationMs = Date.now() - tStart;

  assert.ok(planDurationMs < 15000, `plan generation took ${planDurationMs}ms`);
  assert.ok(longPlan.chunks.length > 800);

  for (let i = 1; i < longPlan.chunks.length; i++) {
    assert.ok(
      longPlan.chunks[i - 1].endFrame <= longPlan.chunks[i].startFrame,
      `chunk overlap at ${i}: ${longPlan.chunks[i - 1].endFrame} > ${longPlan.chunks[i].startFrame}`
    );
  }

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
