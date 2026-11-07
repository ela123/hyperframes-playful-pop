// Pure plan-level checks (section 11, items 4-6 + timing). Shared by `npm run check` and the unit tests.
import type { Plan } from "./types.ts";
import { TIMING } from "./tokens.ts";
import { doodleFootprint, wordFootprint } from "./graphics.ts";
import { entranceState } from "./entrances.ts";
import { DECOR } from "./tokens.ts";

export interface CheckResult { name: string; ok: boolean; lines: string[] }
const hit = (a: { x0: number; y0: number; x1: number; y1: number }, b: typeof a): boolean => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

export function checkOverlaps(plan: Plan): CheckResult {
  const u = plan.config.unit, lines: string[] = [];
  let ok = true;
  for (const c of plan.chunks) {
    const texts = c.words.map((w) => wordFootprint(w, 0));
    c.doodles.forEach((d, i) => {
      const r = doodleFootprint(d, u);
      if (texts.some((t) => hit(r, t))) { ok = false; lines.push(`chunk ${c.index}: doodle ${i} (${d.kind}) overlaps text`); }
      c.doodles.slice(i + 1).forEach((o, k) => {
        if (hit(r, doodleFootprint(o, u))) { ok = false; lines.push(`chunk ${c.index}: doodles ${i} and ${i + 1 + k} overlap`); }
      });
    });
    if (c.doodles.length < DECOR.doodlesMin) lines.push(`chunk ${c.index}: only ${c.doodles.length} doodles (min ${DECOR.doodlesMin}) [warn]`);
    const lastEnt = Math.max(...c.words.map((w) => w.entrance.start + w.entrance.dur));
    const margin = c.exitStart - lastEnt;
    if (margin < 0) { ok = false; lines.push(`chunk ${c.index}: entrance overlaps exit by ${-margin}f`); }
    else if (margin < TIMING.minRest) lines.push(`chunk ${c.index}: rest margin ${margin}f < ${TIMING.minRest}f [warn]`);
    lines.push(`chunk ${c.index}: frames ${c.startFrame}-${c.endFrame}, entrance->exit margin ${margin}f`);
  }
  for (let i = 1; i < plan.chunks.length; i++) {
    const a = plan.chunks[i - 1], b = plan.chunks[i];
    if (a.endFrame > b.startFrame) { ok = false; lines.push(`chunks ${a.index}/${b.index} overlap in time (${a.endFrame} > ${b.startFrame})`); }
  }
  return { name: "no overlaps (shapes/text, entrance/exit, chunks)", ok, lines };
}

export function checkReadability(plan: Plan): CheckResult {
  const lines: string[] = [];
  let ok = true;
  for (const c of plan.chunks) for (const w of c.words) {
    if (w.role !== "hero") continue;
    const st = entranceState(w.entrance.name, (w.spokenStart + 8 - w.entrance.start) / w.entrance.dur, plan.config.unit, w.wobbleSign);
    const good = st.o === 1 && st.sx === 1 && st.sy === 1 && st.rot === 0 && st.x === 0 && st.y === 0;
    if (!good) { ok = false; lines.push(`hero "${w.text}" (chunk ${c.index}) not fully visible at final scale within 8f of its start`); }
    if (w.entrance.start > w.spokenStart) { ok = false; lines.push(`hero "${w.text}" enters later than its spoken start`); }
  }
  return { name: "hero readability within 8 frames", ok, lines };
}

export function checkPalette(plan: Plan): CheckResult {
  const lines: string[] = [];
  let ok = true;
  for (const c of plan.chunks) {
    const col = c.words.filter((w) => w.role === "hero" || w.role === "accent");
    for (let i = 1; i < col.length; i++) if (col[i].color === col[i - 1].color) { ok = false; lines.push(`chunk ${c.index}: "${col[i - 1].text}" and "${col[i].text}" share ${col[i].color}`); }
  }
  return { name: "palette rule (no repeated color in a row)", ok, lines };
}

export function checkTiming(plan: Plan): CheckResult {
  const lines: string[] = [];
  let ok = true;
  for (const c of plan.chunks) for (const w of c.words) {
    if (w.entrance.start > w.spokenStart) { ok = false; lines.push(`"${w.text}" enters after its spoken start`); }
    if (w.spokenStart - w.entrance.start > TIMING.anticipation) { ok = false; lines.push(`"${w.text}" enters more than ${TIMING.anticipation}f early`); }
  }
  return { name: "caption timing (entrance = spoken start - 2f)", ok, lines };
}

export function planChecks(plan: Plan): CheckResult[] {
  return [checkOverlaps(plan), checkReadability(plan), checkPalette(plan), checkTiming(plan)];
}
