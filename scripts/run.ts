// Thin wrappers around the HyperFrames CLI, always run inside dist/ (the generated project).
//   dev      build final, open `hyperframes preview`
//   preview  build preview (0.5x), `hyperframes render --quality draft` -> out/preview.mp4
//   render   build final, `hyperframes render --quality high --fps 30` -> out/final.mp4
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { arg, P } from "./common.ts";
import { buildAll } from "./build.ts";

function hf(args: string[]): void {
  const r = spawnSync("npx", ["hyperframes", ...args], { cwd: P.dist, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

async function main(): Promise<void> {
  const cmd = process.argv[2];
  mkdirSync(P.out, { recursive: true });
  if (cmd === "dev") { await buildAll("final"); hf(["lint"]); hf(["preview", ...(arg("port") ? ["--port", arg("port")!] : [])]); }
  else if (cmd === "preview") { await buildAll("preview"); hf(["render", "--quality", "draft", "--fps", "30", "--output", join(P.out, "preview.mp4")]); }
  else if (cmd === "render") { await buildAll("final"); hf(["render", "--quality", "high", "--fps", "30", "--output", join(P.out, "final.mp4")]); }
  else { console.error("usage: run.ts dev|preview|render"); process.exit(2); }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
