// captions.json (+ fonts, video) -> dist/index.html : a self-contained HyperFrames composition.
//   npm run build -- --quality preview|final
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { build as esbuild } from "esbuild";
import type { CaptionsFile } from "../src/types.ts";
import { resolveConfig } from "../src/config.ts";
import { COLORS, FONT_FACES } from "../src/tokens.ts";
import { buildPlan, collectMeasureKeys } from "../src/plan.ts";
import { loadUserConfig, need, P, probeDuration, qualityArg, ROOT } from "./common.ts";
import { measureAll } from "./measure.ts";

export async function buildAll(quality = qualityArg()): Promise<void> {
  need("ffprobe", "Install FFmpeg (Node >= 22 and FFmpeg are required).");
  const user = loadUserConfig();
  const videoSrc = join(ROOT, user.video);
  if (!existsSync(videoSrc)) throw new Error(`video not found: ${videoSrc} (put your clip at assets/intro.mp4)`);
  if (!existsSync(P.captions)) throw new Error("assets/captions.json missing. Run: npm run transcribe && npm run analyze");
  for (const f of FONT_FACES) if (!existsSync(join(P.fonts, f.file))) throw new Error(`font missing: assets/fonts/${f.file}. Run: npx tsx scripts/fetch-fonts.ts (one time) or add the OFL files by hand`);

  const durationSec = probeDuration(videoSrc);
  console.log(`source video: ${durationSec.toFixed(1)}s (${(durationSec / 60).toFixed(1)} min)`);
  const cfg = resolveConfig({
    quality,
    video: user.video,
    footageIsLight: user.footageIsLight,
    durationSec,
    preset: user.preset,
    position: user.position,
    aspectRatio: user.aspectRatio,
    animationStyle: user.animationStyle,
    fontSize: user.fontSize,
    font: user.font,
    textColor: user.textColor,
    highlightColor: user.highlightColor,
    maxWordsPerCaption: user.maxWordsPerCaption,
  });
  const captions = JSON.parse(readFileSync(P.captions, "utf8")) as CaptionsFile;

  const { measures, source } = await measureAll(collectMeasureKeys(captions, cfg));
  console.log(`measurements: ${source}`);
  const plan = buildPlan(captions, measures, cfg);
  plan.warnings.unshift(...(source === "heuristic" ? ["text widths are ESTIMATED (no browser): layout may be off until puppeteer runs"] : []));

  // 1) bundle the browser entry
  const bundle = await esbuild({
    entryPoints: [join(ROOT, "src", "composition.ts")], bundle: true, format: "iife", target: "chrome120", write: false, minify: false, legalComments: "none",
  });
  const script = bundle.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");

  // 2) assets next to index.html (HyperFrames serves the project folder)
  mkdirSync(join(P.dist, "assets", "fonts"), { recursive: true });
  mkdirSync(join(P.dist, "vendor"), { recursive: true });
  const videoName = "intro.mp4";
  copyFileSync(videoSrc, join(P.dist, "assets", videoName));
  for (const f of readdirSync(P.fonts)) if (f.endsWith(".woff2")) copyFileSync(join(P.fonts, f), join(P.dist, "assets", "fonts", f));
  const gsapPath = join(ROOT, "node_modules", "gsap", "dist", "gsap.min.js");
  if (!existsSync(gsapPath)) throw new Error("gsap not installed (npm install)");
  copyFileSync(gsapPath, join(P.dist, "vendor", "gsap.min.js"));
  const project = join(ROOT, "template", "project");
  if (existsSync(project)) cpSync(project, P.dist, { recursive: true });

  // audio as its own clip (HyperFrames pattern: muted <video> + <audio>); skipped when the clip has no audio track
  let audio = "";
  try {
    execFileSync("ffmpeg", ["-y", "-i", videoSrc, "-vn", "-ac", "2", "-ar", "48000", join(P.dist, "assets", "intro.wav")], { stdio: "ignore" });
    audio = `  <audio id="source-audio" data-start="0" data-duration="${durationSec.toFixed(3)}" data-track-index="3" src="assets/intro.wav"></audio>`;
  } catch { console.warn("! no audio track extracted"); }

  // 3) html
  const faces = FONT_FACES.map((f) => `@font-face { font-family: "${f.family}"; font-weight: ${f.weight}; font-style: normal; src: url("assets/fonts/${f.file}") format("woff2"); }`).join("\n");
  const vars = Object.entries(COLORS).map(([k, v]) => `--${k}: ${v};`).join(" ");
  const html = readFileSync(P.template, "utf8")
    .replaceAll("{{FONT_FACES}}", faces).replaceAll("{{VARS}}", vars)
    .replaceAll("{{WIDTH}}", String(cfg.width)).replaceAll("{{HEIGHT}}", String(cfg.height))
    .replaceAll("{{ID}}", cfg.compositionId).replaceAll("{{FPS}}", String(cfg.fps))
    .replaceAll("{{DURATION}}", durationSec.toFixed(3)).replaceAll("{{VIDEO}}", `assets/${videoName}`)
    .replaceAll("{{AUDIO}}", audio)
    .replace("{{PLAN_JSON}}", () => JSON.stringify(plan).replace(/</g, "\\u003c"))
    .replace("{{SCRIPT}}", () => script);
  writeFileSync(join(P.dist, "index.html"), html);
  writeFileSync(join(P.dist, "plan.json"), JSON.stringify(plan, null, 1));

  const heroes = plan.chunks.reduce((n, c) => n + c.words.filter((w) => w.role === "hero").length, 0);
  console.log(`dist/index.html  ${quality}  ${cfg.width}x${cfg.height}@${cfg.fps}  ${plan.chunks.length} chunks, ${heroes} heroes, ${durationSec.toFixed(2)}s`);
  for (const w of plan.warnings) console.warn("  note:", w);
}

if (process.argv[1]?.endsWith("build.ts")) buildAll().catch((e) => { console.error(e.message); process.exit(1); });
