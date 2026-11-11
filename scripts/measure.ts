// Build-time text measurement in a REAL browser with the REAL self-hosted fonts (em units, cached).
// The composition never measures at render time: the timeline has to be registered synchronously.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { MeasureKey, Measures } from "../src/types.ts";
import { FONT_FACES } from "../src/tokens.ts";
import { BROWSER_MEASURE_SOURCE, heuristicMeasure } from "../src/lib/layout.ts";
import { P } from "./common.ts";

function fontHash(): string {
  const h = createHash("sha1");
  if (existsSync(P.fonts)) for (const f of readdirSync(P.fonts).sort()) if (f.endsWith(".woff2")) h.update(readFileSync(join(P.fonts, f)));
  return h.digest("hex");
}

async function loadPuppeteer(): Promise<any | null> {
  for (const name of ["puppeteer", "puppeteer-core"]) {
    try { return await import(name); } catch { /* try next */ }
  }
  return null;
}

export async function measureAll(keys: MeasureKey[]): Promise<{ measures: Measures; source: "browser" | "cache" | "heuristic" }> {
  const hash = fontHash();
  let cache: { hash: string; measures: Measures } = { hash, measures: {} };
  if (existsSync(P.measures)) {
    try { const c = JSON.parse(readFileSync(P.measures, "utf8")); if (c.hash === hash) cache = c; } catch { /* ignore */ }
  }
  const missing = keys.filter((k) => !cache.measures[k.key]);
  if (!missing.length) return { measures: cache.measures, source: "cache" };

  const pp = await loadPuppeteer();
  if (pp) {
    const mod = pp.default ?? pp;
    let browser: any;
    try {
      browser = await mod.launch({ headless: true, args: ["--no-sandbox", "--allow-file-access-from-files"] });
      const faces = FONT_FACES.map((f) => `@font-face{font-family:"${f.family}";font-weight:${f.weight};src:url("${pathToFileURL(join(P.fonts, f.file)).href}") format("woff2");}`).join("\n");
      const html = join(P.assets, ".measure.html");
      writeFileSync(html, `<!doctype html><meta charset="utf-8"><style>${faces}</style><body>`);
      const page = await browser.newPage();
      await page.goto(pathToFileURL(html).href);
      const got = (await page.evaluate(`(${BROWSER_MEASURE_SOURCE})(${JSON.stringify(missing)})`)) as Measures;
      for (const k of missing) if (!got[k.key] || !(got[k.key].w > 0)) throw new Error(`browser returned no width for ${k.key} (are the fonts in assets/fonts?)`);
      Object.assign(cache.measures, got);
      writeFileSync(P.measures, JSON.stringify(cache) + "\n");
      return { measures: cache.measures, source: "browser" };
    } catch (e) {
      console.warn(`! browser measurement failed (${(e as Error).message}); falling back to estimated widths`);
    } finally { if (browser) await browser.close(); }
  } else {
    console.warn("! puppeteer not installed; falling back to estimated widths (npm i -D puppeteer)");
  }
  const measures: Measures = { ...cache.measures };
  for (const k of missing) measures[k.key] = heuristicMeasure(k);
  try { writeFileSync(P.measures, JSON.stringify({ hash, measures }) + "\n"); } catch { /* ignore */ }
  return { measures, source: "heuristic" };
}
