// npm run check [-- --static]   Section 11 checks. Exits non-zero on any failure.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, copyFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { Plan } from "../src/types.ts";
import { planChecks } from "../src/checks.ts";
import { chunkVis } from "../src/state.ts";
import { flag, P, ROOT } from "./common.ts";

const results: { name: string; ok: boolean; lines: string[] }[] = [];
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

// 1) static grep checks. Patterns are assembled from pieces so this file never matches itself.
function grepChecks(): void {
  const files = [...walk(join(ROOT, "src")), ...walk(join(ROOT, "template"))].filter((f) => /\.(ts|html|css)$/.test(f));
  const rules: [string, RegExp, (f: string) => boolean][] = [
    ["Math." + "random", /Math\s*\.\s*random/, () => true],
    ["Date." + "now", /Date\s*\.\s*now/, () => true],
    ["performance." + "now", /performance\s*\.\s*now/, () => true],
    ["requestAnimation" + "Frame", /requestAnimation\s*Frame/, () => true],
    ["CSS anim" + "ation", /(^|[\s;{"'`])anim\w*ation(-\w+)?\s*:/m, () => true],
    ["CSS trans" + "ition", /(^|[\s;{"'`])trans\w*ition(-\w+)?\s*:/m, () => true],
    ["hex color literal outside tokens.ts", /#[0-9a-fA-F]{3,8}\b/, (f) => !f.endsWith("tokens.ts")],
    ["remote font URL", /https?:\/\/[^\s'"]*(fonts\.g\w+\.com|typekit|fonts\.bunny)/, () => true],
    ["network fetch at render time", /\bfetch\s*\(|XMLHttpRequest/, () => true],
  ];
  const lines: string[] = [];
  for (const f of files) {
    const txt = readFileSync(f, "utf8").split("\n");
    for (const [name, re, applies] of rules) if (applies(f)) txt.forEach((l, i) => { if (re.test(l.replace(/\/\/.*$/, ""))) lines.push(`${relative(ROOT, f)}:${i + 1}  ${name}`); });
  }
  results.push({ name: "static grep (determinism / colors / fonts)", ok: lines.length === 0, lines });
}

function lint(): void {
  const r = spawnSync("npx", ["hyperframes", "lint"], { cwd: P.dist, encoding: "utf8", shell: process.platform === "win32" });
  results.push({ name: "hyperframes lint", ok: r.status === 0, lines: ((r.stdout ?? "") + (r.stderr ?? "")).trim().split("\n").slice(-15) });
}

// 3) determinism: the whole animation is state(chunk, frame); hash it in shuffled order, twice
function determinism(plan: Plan): void {
  const frames: number[] = [];
  for (const c of plan.chunks) frames.push(c.startFrame + 3, c.exitStart + 1);
  const run = (order: number[]): string => createHash("sha1").update(order.map((f) => plan.chunks.map((c) => JSON.stringify(chunkVis(c, f, plan.config))).join("")).join("|")).digest("hex");
  const a = run(frames), b = run([...frames].reverse().reverse()), c = run(frames.slice().sort((x, y) => x - y));
  const lines = [`state hash ${a.slice(0, 12)} / ${b.slice(0, 12)} / ${c.slice(0, 12)}`];
  results.push({ name: "determinism (pure state, repeated)", ok: a === b && a === c, lines });
}

// 3b+7) pixel stills through the HyperFrames CLI, rendered twice and hashed
function stills(plan: Plan): void {
  mkdirSync(P.stills, { recursive: true });
  const hero = plan.chunks.find((c) => c.words.some((w) => w.role === "hero")) ?? plan.chunks[0];
  const short = [...plan.chunks].sort((a, b) => a.endFrame - a.startFrame - (b.endFrame - b.startFrame))[0];
  const mid = plan.chunks[Math.floor(plan.chunks.length / 2)];
  const t = (c: typeof mid, off: number): number => +((c.startFrame + off) / plan.config.fps).toFixed(3);
  const picks = { normal: t(mid, 15), hero: t(hero, 14), short: t(short, 4) };
  const lines: string[] = [];
  const hashes: string[][] = [[], []];
  for (let pass = 0; pass < 2; pass++) {
    for (const [name, sec] of Object.entries(picks)) {
      const before = new Set(existsSync(P.dist) ? walk(P.dist).filter((f) => f.endsWith(".png")) : []);
      const r = spawnSync("npx", ["hyperframes", "snapshot", "--at", String(sec)], { cwd: P.dist, encoding: "utf8", shell: process.platform === "win32" });
      const fresh = walk(P.dist).filter((f) => f.endsWith(".png") && (!before.has(f) || statSync(f).mtimeMs > Date.now() - 60000));
      if (r.status !== 0 || !fresh.length) { lines.push(`snapshot ${name}@${sec}s failed: ${(r.stderr || r.stdout || "").trim().split("\n").pop()}`); hashes[pass].push("fail" + name); continue; }
      const f = fresh[fresh.length - 1];
      hashes[pass].push(createHash("sha1").update(readFileSync(f)).digest("hex"));
      if (pass === 0) copyFileSync(f, join(P.stills, `${name}.png`));
    }
  }
  const same = hashes[0].every((h, i) => h === hashes[1][i] && !h.startsWith("fail"));
  lines.push(`pixel hashes pass1 vs pass2: ${same ? "identical" : "MISMATCH or snapshot unavailable"}`, `stills -> ${relative(ROOT, P.stills)}`);
  results.push({ name: "rendered stills + pixel determinism", ok: same, lines });
}

const planFile = join(P.dist, "plan.json");
grepChecks();
if (!existsSync(planFile)) { results.push({ name: "plan", ok: false, lines: ["dist/plan.json missing: run npm run build first"] }); }
else {
  const plan = JSON.parse(readFileSync(planFile, "utf8")) as Plan;
  results.push(...planChecks(plan));
  determinism(plan);
  if (!flag("static")) { lint(); stills(plan); }
}
let bad = 0;
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}`);
  for (const l of r.lines) console.log("      " + l);
  if (!r.ok) bad++;
}
console.log("\nManual: 5 s preview clip = `npm run preview` then `ffmpeg -i out/preview.mp4 -t 5 -c copy out/preview-5s.mp4`; smoothness = `npm run dev`.");
process.exit(bad ? 1 : 0);
