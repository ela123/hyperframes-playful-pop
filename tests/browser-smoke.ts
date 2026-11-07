// Smoke test of the REAL browser bundle in headless Chromium (playwright).
// Uses a tiny GSAP stand-in when the real gsap is not installed (offline sandbox); with `npm i` it uses the real one.
import { build as esbuild } from "esbuild";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { analyzeWords } from "../scripts/analyze.ts";
import { resolveConfig } from "../src/config.ts";
import { buildPlan, collectMeasureKeys } from "../src/plan.ts";
import { heuristicMeasure } from "../src/lib/layout.ts";
import { COLORS } from "../src/tokens.ts";

const OUT = process.argv[2] ?? "/tmp/smoke";
mkdirSync(OUT, { recursive: true });
const TEXT = "Twenty years ago I built my first company in a tiny garage. It was TERRIBLE, honestly, but we kept going! By 2019 we had grown to 150 people. Nobody believed it.".split(" ");
const words = TEXT.map((text, i) => ({ text, startMs: 300 + i * 420 + (i % 7 === 6 ? 350 : 0), endMs: 300 + i * 420 + 330 + (i % 7 === 6 ? 350 : 0) }));
const caps = analyzeWords(words);
const cfg = resolveConfig({ quality: process.argv[3] === "preview" ? "preview" : "final", video: "x", footageIsLight: false, durationSec: 12 });
const ms: any = {}; for (const k of collectMeasureKeys(caps)) ms[k.key] = heuristicMeasure(k);
const plan = buildPlan(caps, ms, cfg);

const SHIM = `window.gsap={timeline(){const tw=[];const tl={to(t,v,pos){tw.push({t,v,pos});return tl},
 seek(sec){for(const x of tw){const d=x.v.duration;const p=Math.min(1,Math.max(0,(sec-x.pos)/d));if(sec<x.pos)continue;x.t.p=p;x.v.modifiers.p(p)}}, _tw:tw};return tl}};`;
const gsapPath = join(process.cwd(), "node_modules", "gsap", "dist", "gsap.min.js");
const gsapSrc = existsSync(gsapPath) ? readFileSync(gsapPath, "utf8") : SHIM;

const b = await esbuild({ entryPoints: ["src/composition.ts"], bundle: true, format: "iife", write: false, target: "chrome120" });
const vars = Object.entries(COLORS).map(([k, v]) => `--${k}:${v};`).join("");
const html = `<!doctype html><meta charset=utf-8><style>:root{${vars}}html,body{margin:0;width:${cfg.width}px;height:${cfg.height}px;background:var(--sky);overflow:hidden}
#stage{position:relative;width:${cfg.width}px;height:${cfg.height}px;overflow:hidden}#under,#captions{position:absolute;left:0;top:0;width:${cfg.width}px;height:${cfg.height}px}
.layer{position:absolute;left:0;top:0;width:100%;height:100%}.w{position:absolute}</style>
<div id=stage data-composition-id=${cfg.compositionId}><div id=under></div><div id=captions></div></div>
<script>${gsapSrc}</script><script>window.__POP__=${JSON.stringify(plan)}</script><script>${b.outputFiles[0].text}</script>`;
writeFileSync(join(OUT, "index.html"), html);

const { chromium } = await import(existsSync("/opt/npm-tools/node_modules/playwright/index.mjs") ? "/opt/npm-tools/node_modules/playwright/index.mjs" : "playwright");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: cfg.width, height: cfg.height } });
const errors: string[] = [];
page.on("pageerror", (e: Error) => errors.push(e.message));
page.on("console", (m: any) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto("file://" + join(OUT, "index.html"));
const hash = async (sec: number): Promise<string> => {
  await page.evaluate((s: number) => (window as any).__timelines["playful-pop"].seek(s), sec);
  const dom = await page.evaluate(() => document.getElementById("captions")!.innerHTML);
  return createHash("sha1").update(dom).digest("hex");
};
// pick frames: a normal frame, a hero frame, a very short moment
const hero = plan.chunks.flatMap((c) => c.words).find((w) => w.role === "hero")!;
const frames = [Math.round(plan.chunks[0].startFrame + 20), hero.spokenStart + 8, hero.spokenStart + 3];
const results: Record<string, string[]> = {};
for (const f of frames) {
  const a = await hash(f / cfg.fps);
  await page.evaluate(() => (window as any).__timelines["playful-pop"].seek(0.05)); // wander elsewhere
  const b2 = await hash(f / cfg.fps);
  results[f] = [a, b2];
  await page.screenshot({ path: join(OUT, `frame-${f}.png`) });
}
await browser.close();
let ok = errors.length === 0;
for (const [f, [a, b2]] of Object.entries(results)) { console.log(`frame ${f}: ${a === b2 ? "identical" : "DIFFERENT"} ${a.slice(0, 10)}`); if (a !== b2) ok = false; }
if (errors.length) console.log("page errors:", errors);
console.log(ok ? "browser smoke OK" : "browser smoke FAILED");
process.exit(ok ? 0 : 1);
