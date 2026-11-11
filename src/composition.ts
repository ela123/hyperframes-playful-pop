// Browser entry. Bundled by scripts/build.ts into dist/index.html.
// Simplified, clean, artistic caption engine supporting the 5 curated effect templates:
// 1. flicker-strobe: soft neon flicker with eased opacity and warm glow (settles in <= 0.27s)
// 2. kinetic-pop: scale-overshoot pop with spring ease and subtle shadow
// 3. digital-decoder: brief RGB-split & character scramble that decodes clean
// 4. speed-slide: motion-eased directional slide with clean deceleration
// 5. typewriter-terminal: monospace typography with human typing cadence and soft cursor
import type { ChunkPlan, ColorName, Plan, WordPlan } from "./types.ts";
import {
  COLORS, getPresetFonts, ROLE_OPACITY, withAlpha,
} from "./tokens.ts";
import { chunkVis } from "./state.ts";
import type { ChunkVis } from "./state.ts";

declare const gsap: any;
declare global { interface Window { __POP__: Plan; __timelines: Record<string, unknown> } }

const col = (c: ColorName | string): string => (COLORS as Record<string, string>)[c] || c;
const px = (n: number): string => `${n}px`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, style?: Partial<CSSStyleDeclaration>): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (style) Object.assign(e.style, style);
  return e;
}

interface WordSlot {
  root: HTMLElement;
  text: HTMLElement;
  cursor: HTMLElement;
  lastText: string;
  word: WordPlan | null;
}

interface Pool {
  root: HTMLElement;
  backdrop: HTMLElement;
  shake: HTMLElement;
  bg: HTMLElement;
  txt: HTMLElement;
  lines: HTMLElement[];
  words: WordSlot[];
  boundChunk: ChunkPlan | null;
}

const MAX_WORDS = 14;
const MAX_LINES = 3;
const GLYPHS = ["#", "0", "1", "X", "/", "_", "&", "%", "<", ">", "*"];

/** Pure deterministic glyph scramble for the digital decoder effect */
function scrambleWord(word: string, frameOffset: number, seed: number): string {
  const chars = word.split("");
  const len = chars.length;
  // Progressively lock letters from left to right as frameOffset advances (0 to 6)
  const lockedCount = Math.min(len, Math.floor((frameOffset / 6) * len));
  return chars.map((ch, i) => {
    if (i < lockedCount || ch === " " || /^[.,!?:;]$/.test(ch)) return ch;
    const glyphIndex = Math.abs((seed * 31 + i * 17 + frameOffset * 13)) % GLYPHS.length;
    return GLYPHS[glyphIndex];
  }).join("");
}

function createWordSlot(): WordSlot {
  const root = el("div", "w", {
    position: "absolute", left: "0", top: "0", width: "100px", height: "50px",
    transformOrigin: "50% 50%", opacity: "0", display: "none",
  });

  const text = el("span", "t", {
    position: "absolute", left: "0", width: "100%", top: "0", textAlign: "center",
    whiteSpace: "nowrap", pointerEvents: "none",
  });
  root.appendChild(text);

  const cursor = el("span", "cursor", {
    display: "none", marginLeft: "2px", opacity: "0", pointerEvents: "none",
  });
  cursor.textContent = "\u258B"; // soft solid block cursor
  root.appendChild(cursor);

  return { root, text, cursor, lastText: "", word: null };
}

function createPool(host: HTMLElement, plan: Plan): Pool {
  const cfg = plan.config;
  const root = el("div", "chunk", {
    position: "absolute", left: "0", top: "0", width: "100%", height: "100%",
    visibility: "hidden",
  });

  // Artistic backdrop card: guarantees text contrast without obscuring faces
  const backdrop = el("div", "caption-backdrop", {
    position: "absolute", display: "none", pointerEvents: "none",
  });
  root.appendChild(backdrop);

  const shake = el("div", "layer", {});
  const bg = el("div", "layer", {});
  const txt = el("div", "layer", {});

  const lines: HTMLElement[] = [];
  for (let i = 0; i < MAX_LINES; i++) {
    const le = el("div", "layer", {});
    txt.appendChild(le);
    lines.push(le);
  }

  const words: WordSlot[] = [];
  for (let i = 0; i < MAX_WORDS; i++) {
    const slot = createWordSlot();
    words.push(slot);
  }

  shake.appendChild(bg);
  shake.appendChild(txt);
  root.appendChild(shake);
  host.appendChild(root);

  return { root, backdrop, shake, bg, txt, lines, words, boundChunk: null };
}

function bindChunk(pool: Pool, c: ChunkPlan, cfg: Plan["config"]): void {
  pool.boundChunk = c;
  const effect = cfg.effect;
  const origin = `${c.origin.x}px ${c.origin.y}px`;
  pool.bg.style.transformOrigin = origin;
  pool.txt.style.transformOrigin = origin;

  // Curated, artistic backdrop card (ensures high contrast without covering speaker)
  const padX = 28 * cfg.unit;
  const padY = 14 * cfg.unit;
  pool.backdrop.style.display = "block";
  pool.backdrop.style.left = px(Math.max(0, c.bbox.x - padX));
  pool.backdrop.style.top = px(Math.max(0, c.bbox.y - padY));
  pool.backdrop.style.width = px(c.bbox.w + padX * 2);
  pool.backdrop.style.height = px(c.bbox.h + padY * 2);
  pool.backdrop.style.background = cfg.backdropColorOverride
    ? col(cfg.backdropColorOverride)
    : withAlpha(COLORS.canvasBackdrop, 0.76);
  pool.backdrop.style.borderRadius = px(12 * cfg.unit);
  pool.backdrop.style.boxShadow = `0 ${4 * cfg.unit}px ${24 * cfg.unit}px rgba(0, 0, 0, 0.42)`;

  if (effect === "typewriter-terminal") {
    pool.backdrop.style.border = `1px solid ${COLORS.canvasBorder}`;
  } else {
    pool.backdrop.style.border = "none";
  }

  // Bind lines
  for (let li = 0; li < MAX_LINES; li++) {
    const lPlan = c.lines[li];
    const lEl = pool.lines[li];
    if (lPlan) {
      lEl.style.display = "block";
      lEl.style.transformOrigin = `${lPlan.box.x + lPlan.box.w / 2}px ${lPlan.box.y + lPlan.box.h / 2}px`;
    } else {
      lEl.style.display = "none";
    }
  }

  // Bind words
  const presetFonts = getPresetFonts(effect, cfg.fontOverride);
  for (let i = 0; i < MAX_WORDS; i++) {
    const slot = pool.words[i];
    const w = c.words[i];
    if (!w) {
      slot.root.style.display = "none";
      slot.word = null;
      continue;
    }
    slot.word = w;
    slot.root.style.display = "block";
    slot.root.style.left = px(w.box.x);
    slot.root.style.top = px(w.box.y);
    slot.root.style.width = px(w.box.w);
    slot.root.style.height = px(w.box.h);

    const f = presetFonts[w.role] || presetFonts.normal;
    const t = slot.text;
    t.style.top = px(w.padY);
    t.style.lineHeight = px(w.ascentPx + w.descentPx);
    t.style.fontFamily = `"${f.family}", ${f.fallback}`;
    t.style.fontWeight = String(f.weight);
    t.style.fontSize = px(w.fontPx);
    t.style.letterSpacing = effect === "typewriter-terminal" ? "0.04em" : "0.01em";

    // Text color: Only the hero receives the accent color! Non-hero words are soft warm white.
    if (w.role === "hero") {
      t.style.color = col(w.color);
    } else {
      t.style.color = cfg.textColorOverride ? col(cfg.textColorOverride) : COLORS.canvasText;
    }

    // Effect specific text styling
    switch (effect) {
      case "flicker-strobe":
        t.style.textShadow = w.role === "hero"
          ? `0 0 ${14 * cfg.unit}px ${withAlpha(COLORS.canvasAccent, 0.65)}, 0 0 ${28 * cfg.unit}px ${withAlpha(COLORS.canvasAccent, 0.3)}`
          : `0 ${1.5 * cfg.unit}px ${6 * cfg.unit}px rgba(0, 0, 0, 0.65)`;
        break;
      case "digital-decoder":
        t.style.textShadow = w.role === "hero"
          ? `-1.5px 0 ${withAlpha(COLORS.accentRose, 0.8)}, 1.5px 0 ${withAlpha(COLORS.accentTeal, 0.8)}`
          : `0 ${1.5 * cfg.unit}px ${6 * cfg.unit}px rgba(0, 0, 0, 0.65)`;
        break;
      case "kinetic-pop":
      case "speed-slide":
      case "typewriter-terminal":
      default:
        t.style.textShadow = `0 ${2 * cfg.unit}px ${8 * cfg.unit}px rgba(0, 0, 0, 0.65)`;
        break;
    }

    t.textContent = w.count ? w.display.replace(/\d/g, "0") : w.display;
    slot.lastText = w.display;

    // Terminal cursor
    if (effect === "typewriter-terminal" && w.role === "hero") {
      slot.cursor.style.display = "inline-block";
      slot.cursor.style.color = col(w.color);
      slot.cursor.style.fontSize = px(w.fontPx * 0.9);
    } else {
      slot.cursor.style.display = "none";
    }

    pool.lines[w.line].appendChild(slot.root);
  }
}

function applyState(pool: Pool, v: ChunkVis, cfg: Plan["config"], frame: number): void {
  pool.root.style.visibility = v.visible ? "visible" : "hidden";
  if (!v.visible || !pool.boundChunk) return;

  const effect = cfg.effect;
  const chunk = pool.boundChunk;

  v.lines.forEach((l, i) => {
    if (pool.lines[i]) {
      pool.lines[i].style.transform = l.transform;
      pool.lines[i].style.opacity = String(l.o);
    }
  });

  v.words.forEach((wv, i) => {
    const wr = pool.words[i];
    if (!wr || !wr.word) return;
    wr.root.style.opacity = String(wv.o);
    wr.root.style.transform = wv.transform;

    const w = wr.word;
    const isHero = w.role === "hero";
    const spokenOffset = frame - w.spokenStart;

    // 1. Digital Decoder character scrambling (resolves clean in <= 0.25s)
    if (effect === "digital-decoder" && isHero && spokenOffset >= 0 && spokenOffset < 7) {
      const scrambled = scrambleWord(w.display, spokenOffset, w.seed);
      if (scrambled !== wr.lastText) {
        wr.text.textContent = scrambled;
        wr.lastText = scrambled;
      }
    } else {
      if (wv.text !== wr.lastText) {
        wr.text.textContent = wv.text;
        wr.lastText = wv.text;
      }
    }

    // 2. Decoder chromatic split settles clean after frame 7
    if (effect === "digital-decoder" && isHero) {
      if (spokenOffset >= 7 || spokenOffset < 0) {
        wr.text.style.textShadow = `0 ${2 * cfg.unit}px ${8 * cfg.unit}px rgba(0, 0, 0, 0.65)`;
      }
    }

    // 3. Typewriter terminal cursor blink (soft, 2 beats/sec)
    if (effect === "typewriter-terminal" && isHero && wr.cursor.style.display !== "none") {
      const blink = (Math.floor(frame / 10) % 2 === 0) && spokenOffset >= 0;
      wr.cursor.style.opacity = blink ? "0.9" : "0.1";
    }
  });
}

function findActiveChunk(chunks: ChunkPlan[], frame: number): ChunkPlan | null {
  let lo = 0, hi = chunks.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const c = chunks[mid];
    if (frame >= c.startFrame && frame < c.endFrame) return c;
    if (frame < c.startFrame) hi = mid - 1;
    else lo = mid + 1;
  }
  return null;
}

function init(): void {
  const plan = window.__POP__;
  const cfg = plan.config;
  const host = document.getElementById("captions") as HTMLElement;

  const pool = createPool(host, plan);

  const renderFrame = (f: number): void => {
    const active = findActiveChunk(plan.chunks, f);
    if (!active) {
      pool.root.style.visibility = "hidden";
      return;
    }
    if (pool.boundChunk !== active) {
      bindChunk(pool, active, cfg);
    }
    const vis = chunkVis(active, f, cfg);
    applyState(pool, vis, cfg, f);
  };

  const total = cfg.durationFrames;
  const proxy = { f: 0 };
  const tl = gsap.timeline({ paused: true });
  tl.to(proxy, {
    f: total,
    duration: total / cfg.fps,
    ease: "none",
    modifiers: {
      f: (val: number): number => {
        renderFrame(Math.round(val));
        return val;
      },
    },
  }, 0);

  window.__timelines = window.__timelines || {};
  window.__timelines[cfg.compositionId] = tl;
}

init();
export { ROLE_OPACITY };
