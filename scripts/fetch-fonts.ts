// ONE-TIME setup helper (dev machine, needs internet): downloads the two OFL fonts as woff2 into assets/fonts.
// Nothing is ever fetched at build/render time; the composition only references the local files.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { P } from "./common.ts";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const CSS = "https://fonts.googleapis.com/css2?family=Lilita+One&family=Fredoka:wght@300..700&display=swap";

async function main(): Promise<void> {
  mkdirSync(P.fonts, { recursive: true });
  const css = await (await fetch(CSS, { headers: { "User-Agent": UA } })).text();
  const blocks = css.split("@font-face").slice(1);
  const want: Record<string, string> = { "Lilita One": "LilitaOne-Regular.woff2", Fredoka: "Fredoka-Variable.woff2" };
  const done = new Set<string>();
  for (const b of blocks) {
    const fam = /font-family:\s*'([^']+)'/.exec(b)?.[1];
    const sub = /\/\*\s*([\w-]+)\s*\*\//.exec(css.slice(css.indexOf(b) - 40, css.indexOf(b)))?.[1];
    const url = /url\((https:[^)]+\.woff2)\)/.exec(b)?.[1];
    if (!fam || !url || !want[fam] || done.has(fam) || (sub && sub !== "latin")) continue;
    writeFileSync(join(P.fonts, want[fam]), Buffer.from(await (await fetch(url)).arrayBuffer()));
    done.add(fam);
    console.log(`saved ${want[fam]}`);
  }
  if (done.size < 2) throw new Error("could not locate both latin woff2 files; download Lilita One + Fredoka manually (OFL) into assets/fonts");
}
main().catch((e) => { console.error(e.message); process.exit(1); });
