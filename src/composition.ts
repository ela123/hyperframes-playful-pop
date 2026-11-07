// Browser entry. Bundled by scripts/build.ts into dist/index.html.
// High-performance virtualized caption design system:
// Uses a lightweight DOM element pool (~15-25 nodes total) and a single master timeline tween.
// Scales effortlessly to 34+ minute videos without RAM bloat or garbage collection pauses.
import type { ChunkPlan, ColorName, Plan, WordPlan } from "./types.ts";
import {
  BACKING_OUTLINE_EM, COLORS, DECOR, FONTS, getPresetFonts, QUALITY,
  ROLE_OPACITY, SHADOW_EM, STROKE_EM, withAlpha,
} from "./tokens.ts";
import { shapePath, starPoints } from "./graphics.ts";
import { chunkVis } from "./state.ts";
import type { ChunkVis } from "./state.ts";

declare const gsap: any;
declare global { interface Window { __POP__: Plan; __timelines: Record<string, unknown> } }

const SVGNS = "http://www.w3.org/2000/svg";
const col = (c: ColorName): string => COLORS[c] || c;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, style?: Partial<CSSStyleDeclaration>): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (style) Object.assign(e.style, style);
  return e;
}

function svg(tag: string, attrs: Record<string, string | number> = {}): SVGElement {
  const e = document.createElementNS(SVGNS, tag);
  for (const k of Object.keys(attrs)) e.setAttribute(k, String(attrs[k]));
  return e;
}

const px = (n: number): string => `${n}px`;

interface WordSlot {
  root: HTMLElement;
  text: HTMLElement;
  backSvg: SVGElement;
  backShadow: SVGElement;
  backFill: SVGElement;
  markerSvg: SVGElement;
  markerRect: SVGElement;
  ul: SVGElement[];
  stars: SVGElement[];
  lastText: string;
  word: WordPlan | null;
}

interface Pool {
  root: HTMLElement;
  backdrop: HTMLElement;
  shake: HTMLElement;
  bg: HTMLElement;
  txt: HTMLElement;
  fx: HTMLElement;
  lines: HTMLElement[];
  words: WordSlot[];
  doodles: SVGElement[];
  bursts: SVGElement[];
  confetti: HTMLElement[];
  halftone: SVGElement;
  boundChunk: ChunkPlan | null;
}

const MAX_WORDS = 14;
const MAX_LINES = 3;
const MAX_DOODLES = 6;
const MAX_CONFETTI = 20;
const MAX_BURSTS = 2;

function createWordSlot(fx: HTMLElement): WordSlot {
  const root = el("div", "w", {
    position: "absolute", left: "0", top: "0", width: "100px", height: "50px",
    transformOrigin: "50% 55%", opacity: "0", display: "none",
  });

  // Hero sticker back SVG
  const backSvg = svg("svg");
  backSvg.style.cssText = "position:absolute;left:0;top:0;overflow:visible;display:none";
  const gBack = svg("g");
  const backShadow = svg("path");
  const backFill = svg("path");
  gBack.appendChild(backShadow);
  gBack.appendChild(backFill);
  backSvg.appendChild(gBack);
  root.appendChild(backSvg);

  // Marker / Pill highlight SVG
  const markerSvg = svg("svg");
  markerSvg.style.cssText = "position:absolute;overflow:visible;transform-origin:0% 50%;opacity:0;display:none";
  const gMarker = svg("g");
  const markerRect = svg("rect");
  gMarker.appendChild(markerRect);
  markerSvg.appendChild(gMarker);
  root.appendChild(markerSvg);

  // Text element
  const text = el("span", "t", {
    position: "absolute", left: "0", width: "100%", top: "0", textAlign: "center",
    whiteSpace: "nowrap",
  });
  root.appendChild(text);

  // Underline SVGs (2 paths: outer stroke and inner fill)
  const ulSvg = svg("svg");
  ulSvg.style.cssText = "position:absolute;left:0;top:0;overflow:visible;display:none";
  const ulP1 = svg("path", { fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" });
  const ulP2 = svg("path", { fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" });
  ulSvg.appendChild(ulP1);
  ulSvg.appendChild(ulP2);
  root.appendChild(ulSvg);

  // Stars
  const stars: SVGElement[] = [];
  for (let k = 0; k < 8; k++) {
    const s = svg("svg", { width: 32, height: 32, viewBox: "-0.6 -0.6 1.2 1.2" });
    s.style.cssText = "position:absolute;overflow:visible;opacity:0;display:none";
    s.appendChild(svg("path", { d: starPoints(), "stroke-linejoin": "round" }));
    fx.appendChild(s);
    stars.push(s);
  }

  return {
    root, text, backSvg, backShadow, backFill, markerSvg, markerRect,
    ul: [ulP1, ulP2], stars, lastText: "", word: null,
  };
}

function createPool(host: HTMLElement, plan: Plan): Pool {
  const cfg = plan.config;
  const root = el("div", "chunk", {
    position: "absolute", left: "0", top: "0", width: "100%", height: "100%",
    visibility: "hidden",
  });

  // Minimal / Cinematic subtle backdrop container
  const backdrop = el("div", "caption-backdrop", {
    position: "absolute", display: "none", pointerEvents: "none",
  });
  root.appendChild(backdrop);

  const shake = el("div", "layer", {});
  const bg = el("div", "layer", {});
  const txt = el("div", "layer", {});
  const fx = el("div", "layer", {});

  // Halftone SVG
  const W = cfg.width, H = cfg.height;
  const hs = svg("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
  hs.style.cssText = "position:absolute;left:0;top:0;overflow:visible;display:none";
  bg.appendChild(hs);

  // Doodles
  const doodles: SVGElement[] = [];
  for (let i = 0; i < MAX_DOODLES; i++) {
    const s = svg("svg", { viewBox: "-0.6 -0.6 1.2 1.2" });
    s.style.cssText = "position:absolute;overflow:visible;opacity:0;display:none";
    bg.appendChild(s);
    doodles.push(s);
  }

  // Bursts
  const bursts: SVGElement[] = [];
  for (let i = 0; i < MAX_BURSTS; i++) {
    const s = svg("svg", { viewBox: "-0.6 -0.6 1.2 1.2" });
    s.style.cssText = "position:absolute;overflow:visible;opacity:0;display:none";
    txt.appendChild(s);
    bursts.push(s);
  }

  // Confetti
  const confetti: HTMLElement[] = [];
  for (let i = 0; i < MAX_CONFETTI; i++) {
    const c = el("div", "", { position: "absolute", opacity: "0", display: "none" });
    bg.appendChild(c);
    confetti.push(c);
  }

  // Lines
  const lines: HTMLElement[] = [];
  for (let i = 0; i < MAX_LINES; i++) {
    const le = el("div", "layer", {});
    txt.appendChild(le);
    lines.push(le);
  }

  // Words
  const words: WordSlot[] = [];
  for (let i = 0; i < MAX_WORDS; i++) {
    const slot = createWordSlot(fx);
    words.push(slot);
  }

  shake.appendChild(bg);
  shake.appendChild(txt);
  shake.appendChild(fx);
  root.appendChild(shake);
  host.appendChild(root);

  return {
    root, backdrop, shake, bg, txt, fx, lines, words, doodles, bursts, confetti,
    halftone: hs, boundChunk: null,
  };
}

function bindChunk(pool: Pool, c: ChunkPlan, cfg: Plan["config"]): void {
  pool.boundChunk = c;
  const preset = cfg.preset;
  const isPop = preset === "playful-pop";
  const isMinPro = preset === "minimal-pro";
  const isCinematic = preset === "cinematic";

  const origin = `${c.origin.x}px ${c.origin.y}px`;
  pool.bg.style.transformOrigin = origin;
  pool.txt.style.transformOrigin = origin;

  // Backdrop styling per preset
  if (isMinPro) {
    pool.backdrop.style.display = "block";
    pool.backdrop.style.left = px(Math.max(0, c.bbox.x - 28 * cfg.unit));
    pool.backdrop.style.top = px(Math.max(0, c.bbox.y - 14 * cfg.unit));
    pool.backdrop.style.width = px(c.bbox.w + 56 * cfg.unit);
    pool.backdrop.style.height = px(c.bbox.h + 28 * cfg.unit);
    pool.backdrop.style.background = withAlpha(COLORS.slateDark, 0.78);
    pool.backdrop.style.borderRadius = px(16 * cfg.unit);
    pool.backdrop.style.boxShadow = `0 ${4 * cfg.unit}px ${20 * cfg.unit}px rgba(0,0,0,0.45)`;
  } else if (isCinematic) {
    pool.backdrop.style.display = "block";
    pool.backdrop.style.left = "0";
    pool.backdrop.style.top = px(Math.max(0, c.bbox.y - 20 * cfg.unit));
    pool.backdrop.style.width = "100%";
    pool.backdrop.style.height = px(c.bbox.h + 40 * cfg.unit);
    pool.backdrop.style.background = `linear-gradient(to bottom, ${withAlpha(COLORS.obsidianDark, 0)}, ${withAlpha(COLORS.obsidianDark, 0.72)} 30%, ${withAlpha(COLORS.obsidianDark, 0.72)} 70%, ${withAlpha(COLORS.obsidianDark, 0)})`;
    pool.backdrop.style.borderRadius = "0";
    pool.backdrop.style.boxShadow = "none";
  } else {
    pool.backdrop.style.display = "none";
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
  const presetFonts = getPresetFonts(cfg.preset, cfg.fontOverride);
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

    const f = presetFonts[w.role] || FONTS[w.role];
    const t = slot.text;
    t.style.top = px(w.padY);
    t.style.lineHeight = px(w.ascentPx + w.descentPx);
    t.style.fontFamily = `"${f.family}", ${f.fallback}`;
    t.style.fontWeight = String(f.weight);
    t.style.fontSize = px(w.fontPx);

    // Styling per preset
    if (isPop) {
      t.style.color = w.role === "accent" ? col(w.color) : COLORS.cream;
      t.style.setProperty("-webkit-text-stroke", `${(w.fontPx * STROKE_EM * 2).toFixed(2)}px ${COLORS.ink}`);
      t.style.setProperty("paint-order", "stroke fill");
      t.style.textShadow = `${(w.fontPx * SHADOW_EM.x).toFixed(2)}px ${(w.fontPx * SHADOW_EM.y).toFixed(2)}px 0 ${COLORS.ink}`;
      t.style.letterSpacing = "normal";
    } else if (isMinPro) {
      t.style.color = w.role === "hero" ? col(w.color) : w.role === "accent" ? col(w.color) : COLORS.snowWhite;
      t.style.setProperty("-webkit-text-stroke", "0");
      t.style.textShadow = `0 ${2 * cfg.unit}px ${6 * cfg.unit}px rgba(0,0,0,0.65)`;
      t.style.letterSpacing = "-0.01em";
    } else {
      // Cinematic
      t.style.color = w.role === "hero" ? col(w.color) : w.role === "accent" ? col(w.color) : COLORS.platinumWhite;
      t.style.setProperty("-webkit-text-stroke", "0");
      t.style.textShadow = `0 ${3 * cfg.unit}px ${12 * cfg.unit}px rgba(0,0,0,0.85)`;
      t.style.letterSpacing = "0.08em";
    }

    t.textContent = w.count ? w.display.replace(/\d/g, "0") : w.display;
    slot.lastText = w.display;

    // Attach to correct line
    pool.lines[w.line].appendChild(slot.root);

    // Hero sticker / Pill highlight
    const sw = w.fontPx * BACKING_OUTLINE_EM;
    if (isPop && w.role === "hero") {
      slot.backSvg.style.display = "block";
      slot.backSvg.setAttribute("width", String(w.box.w));
      slot.backSvg.setAttribute("height", String(w.box.h));
      slot.backSvg.setAttribute("viewBox", `0 0 ${w.box.w} ${w.box.h}`);
      const g = slot.backSvg.firstElementChild as SVGElement;
      g.setAttribute("transform", `rotate(${w.backRot} ${w.box.w / 2} ${w.box.h / 2})`);
      slot.backShadow.setAttribute("d", w.backPath);
      slot.backShadow.setAttribute("fill", COLORS.ink);
      slot.backShadow.setAttribute("transform", `translate(${w.fontPx * SHADOW_EM.x} ${w.fontPx * SHADOW_EM.y})`);
      slot.backFill.setAttribute("d", w.backPath);
      slot.backFill.setAttribute("fill", col(w.color));
      slot.backFill.setAttribute("stroke", COLORS.ink);
      slot.backFill.setAttribute("stroke-width", String(sw));
      slot.backFill.setAttribute("stroke-linejoin", "round");
    } else {
      slot.backSvg.style.display = "none";
    }

    // Marker / Pill highlight
    if (w.emphasis.includes("marker-highlight") || w.emphasis.includes("pill-highlight")) {
      const isPill = w.emphasis.includes("pill-highlight");
      const mw = w.textW + w.padX * (isPill ? 1.6 : 1.2);
      const mh = w.ascentPx * (isPill ? 1.15 : 0.95);
      slot.markerSvg.style.display = "block";
      slot.markerSvg.setAttribute("width", String(mw));
      slot.markerSvg.setAttribute("height", String(mh));
      slot.markerSvg.setAttribute("viewBox", `0 0 ${mw} ${mh}`);
      slot.markerSvg.style.left = `${w.padX * (isPill ? 0.2 : 0.4)}px`;
      slot.markerSvg.style.top = `${w.padY + w.ascentPx * (isPill ? 0.05 : 0.12)}px`;

      const g = slot.markerSvg.firstElementChild as SVGElement;
      g.setAttribute("transform", `rotate(${w.markerRot} ${mw / 2} ${mh / 2})`);
      slot.markerRect.setAttribute("x", String(sw / 2));
      slot.markerRect.setAttribute("y", String(sw / 2));
      slot.markerRect.setAttribute("width", String(mw - sw));
      slot.markerRect.setAttribute("height", String(mh - sw));
      slot.markerRect.setAttribute("rx", String(mh * (isPill ? 0.35 : 0.28)));
      slot.markerRect.setAttribute("fill", isPill ? col(w.color) : COLORS.cream);
      slot.markerRect.setAttribute("stroke", isPill ? withAlpha(COLORS.ink, 0.4) : COLORS.ink);
      slot.markerRect.setAttribute("stroke-width", String(isPill ? 1 : sw));
      slot.markerRect.setAttribute("stroke-linejoin", "round");
    } else {
      slot.markerSvg.style.display = "none";
    }

    // Underline
    if (w.emphasis.includes("doodle-underline")) {
      const ulSvg = slot.root.querySelector("svg:last-of-type") as SVGElement;
      if (ulSvg) {
        ulSvg.style.display = "block";
        ulSvg.setAttribute("width", String(w.box.w));
        ulSvg.setAttribute("height", String(w.box.h));
        ulSvg.setAttribute("viewBox", `0 0 ${w.box.w} ${w.box.h}`);
        const [p1, p2] = slot.ul;
        p1.setAttribute("d", w.underline);
        p1.setAttribute("stroke", COLORS.ink);
        p1.setAttribute("stroke-width", String(w.fontPx * 0.2));
        p1.setAttribute("stroke-dasharray", String(w.underlineLen + 4));
        p2.setAttribute("d", w.underline);
        p2.setAttribute("stroke", col(w.color));
        p2.setAttribute("stroke-width", String(w.fontPx * 0.1));
        p2.setAttribute("stroke-dasharray", String(w.underlineLen + 4));
      }
    }

    // Stars
    if (isPop && w.stars && w.stars.length) {
      const cx = w.box.x + w.box.w / 2, cy = w.box.y + w.box.h / 2;
      w.stars.forEach((st, k) => {
        const s = slot.stars[k];
        if (!s) return;
        s.style.display = "block";
        s.setAttribute("width", String(st.size));
        s.setAttribute("height", String(st.size));
        s.style.left = `${cx - st.size / 2}px`;
        s.style.top = `${cy - st.size / 2}px`;
        const path = s.firstElementChild as SVGElement;
        path.setAttribute("fill", col(w.color));
        path.setAttribute("stroke", COLORS.ink);
        path.setAttribute("stroke-width", "0.14");
        path.setAttribute("transform", `rotate(${st.rot})`);
      });
      for (let k = w.stars.length; k < 8; k++) slot.stars[k].style.display = "none";
    } else {
      slot.stars.forEach((s) => { s.style.display = "none"; });
    }
  }

  // Doodles / Bursts / Confetti (only in playful-pop)
  if (isPop && c.doodles.length) {
    c.doodles.forEach((d, i) => {
      const s = pool.doodles[i];
      if (!s) return;
      s.style.display = "block";
      s.setAttribute("width", String(d.size));
      s.setAttribute("height", String(d.size));
      s.style.left = `${d.cx - d.size / 2}px`;
      s.style.top = `${d.cy - d.size / 2}px`;
      s.innerHTML = "";
      const sp = shapePath(d.kind, d.seed);
      if (sp.filled) {
        s.appendChild(svg("path", { d: sp.d, fill: col(d.color), stroke: COLORS.ink, "stroke-width": 0.1, "stroke-linejoin": "round" }));
      } else {
        s.appendChild(svg("path", { d: sp.d, fill: "none", stroke: COLORS.ink, "stroke-width": 0.2, "stroke-linecap": "round", "stroke-linejoin": "round" }));
        s.appendChild(svg("path", { d: sp.d, fill: "none", stroke: col(d.color), "stroke-width": 0.1, "stroke-linecap": "round", "stroke-linejoin": "round" }));
      }
    });
    for (let i = c.doodles.length; i < MAX_DOODLES; i++) pool.doodles[i].style.display = "none";
  } else {
    pool.doodles.forEach((d) => { d.style.display = "none"; });
  }

  if (isPop && c.bursts.length) {
    c.bursts.forEach((b, i) => {
      const s = pool.bursts[i];
      if (!s) return;
      s.style.display = "block";
      s.setAttribute("width", String(b.size));
      s.setAttribute("height", String(b.size));
      s.style.left = `${b.cx - b.size / 2}px`;
      s.style.top = `${b.cy - b.size / 2}px`;
      s.innerHTML = "";
      s.appendChild(svg("path", { d: b.path, fill: COLORS.ink, transform: "translate(0.04 0.05)" }));
      s.appendChild(svg("path", { d: b.path, fill: col(b.color), stroke: COLORS.ink, "stroke-width": 0.045, "stroke-linejoin": "round" }));
    });
    for (let i = c.bursts.length; i < MAX_BURSTS; i++) pool.bursts[i].style.display = "none";
  } else {
    pool.bursts.forEach((b) => { b.style.display = "none"; });
  }

  if (isPop && c.confetti.length) {
    c.confetti.forEach((p, i) => {
      const ce = pool.confetti[i];
      if (!ce) return;
      ce.style.display = "block";
      ce.style.width = px(p.w);
      ce.style.height = px(p.h);
      ce.style.background = col(p.color);
      ce.style.border = `${Math.max(1, p.w * 0.1).toFixed(1)}px solid ${COLORS.ink}`;
      ce.style.boxSizing = "border-box";
      ce.style.borderRadius = p.circle ? "50%" : px(p.h * 0.25);
    });
    for (let i = c.confetti.length; i < MAX_CONFETTI; i++) pool.confetti[i].style.display = "none";
  } else {
    pool.confetti.forEach((ce) => { ce.style.display = "none"; });
  }

  // Halftone
  if (isPop && c.halftone && c.halftone.gap > 0) {
    const h = c.halftone;
    const hs = pool.halftone;
    hs.style.display = "block";
    hs.style.opacity = String(DECOR.halftoneOpacity);
    hs.style.transformOrigin = `${h.cx}px ${h.cy}px`;
    hs.innerHTML = `
      <defs>
        <pattern id="htPat" width="${h.gap}" height="${h.gap}" patternUnits="userSpaceOnUse">
          <circle cx="${h.gap / 2}" cy="${h.gap / 2}" r="${h.dot}" fill="${col(h.color)}" />
        </pattern>
        <radialGradient id="htGrad">
          <stop offset="0.35" stop-color="${COLORS.cream}" stop-opacity="1" />
          <stop offset="1" stop-color="${COLORS.cream}" stop-opacity="0" />
        </radialGradient>
        <mask id="htMask" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
          <ellipse cx="${h.cx}" cy="${h.cy}" rx="${h.rx}" ry="${h.ry}" fill="url(#htGrad)" />
        </mask>
      </defs>
      <rect x="0" y="0" width="${W}" height="${H}" fill="url(#htPat)" mask="url(#htMask)" />
    `;
  } else {
    pool.halftone.style.display = "none";
  }
}

function applyState(pool: Pool, v: ChunkVis, cfg: Plan["config"]): void {
  pool.root.style.visibility = v.visible ? "visible" : "hidden";
  if (!v.visible || !pool.boundChunk) return;

  const isPop = cfg.preset === "playful-pop";
  const isMinPro = cfg.preset === "minimal-pro";

  pool.shake.style.transform = `translate(${v.shake.x}px, ${v.shake.y}px)`;
  pool.bg.style.transform = `scale(${v.bgScale})`;
  pool.txt.style.transform = `scale(${v.textScale})`;
  if (isPop) pool.halftone.style.transform = `scale(${v.halftone.s})`;

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

    if (wv.text !== wr.lastText) {
      wr.text.textContent = wv.text;
      wr.lastText = wv.text;
    }

    if (isPop && wr.word.role === "hero") {
      wr.text.style.color = wv.markerOn ? COLORS.ink : COLORS.cream;
      wr.text.style.setProperty("-webkit-text-stroke-color", wv.markerOn ? COLORS.cream : COLORS.ink);
    } else if (isMinPro && wr.word.role === "hero" && wv.markerOn) {
      wr.text.style.color = COLORS.slateDark;
    }

    if (wr.markerSvg.style.display !== "none") {
      wr.markerSvg.style.opacity = wv.marker > 0 ? "1" : "0";
      wr.markerSvg.style.transform = `scaleX(${wv.marker})`;
    }

    wr.ul.forEach((p) => {
      p.style.opacity = wv.underline > 0 ? "1" : "0";
      p.setAttribute("stroke-dashoffset", String((wr.word!.underlineLen + 4) * (1 - wv.underline)));
    });

    wr.stars.forEach((s, k) => {
      const st = wv.stars[k], spec = wr.word!.stars[k];
      if (!st || !spec) return;
      s.style.opacity = String(st.o);
      s.style.transform = `translate(${st.x}px, ${st.y}px) rotate(${spec.rot}deg) scale(${st.s})`;
    });
  });

  if (isPop) {
    v.doodles.forEach((d, i) => {
      if (pool.doodles[i]) pool.doodles[i].style.transform = `translate(${d.x}px, ${d.y}px) rotate(${d.rot}deg) scale(${d.s})`;
    });
    v.bursts.forEach((b, i) => {
      if (pool.bursts[i]) {
        pool.bursts[i].style.opacity = String(b.o);
        pool.bursts[i].style.transform = `rotate(${b.rot}deg) scale(${b.s})`;
      }
    });
    v.confetti.forEach((p, i) => {
      if (pool.confetti[i]) {
        pool.confetti[i].style.opacity = String(p.o);
        pool.confetti[i].style.transform = `translate(${p.x}px, ${p.y}px) rotate(${p.rot}deg)`;
      }
    });
  }
}

/** Binary search to find the active chunk in O(log N). */
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
  const q = QUALITY[cfg.quality];

  // Optional background overlay / gradient
  const under = document.getElementById("under") as HTMLElement | null;
  if (under) {
    if (cfg.preset === "playful-pop" && q.overlay) {
      const s = svg("svg", { width: cfg.width, height: cfg.height, viewBox: `0 0 ${cfg.width} ${cfg.height}` });
      s.style.cssText = `position:absolute;left:0;top:0;opacity:${DECOR.overlayOpacity}`;
      const gap = 14 * cfg.unit;
      const defs = svg("defs");
      const pat = svg("pattern", { id: "overlayDots", width: gap, height: gap, patternUnits: "userSpaceOnUse", patternTransform: "rotate(22)" });
      pat.appendChild(svg("circle", { cx: gap / 2, cy: gap / 2, r: gap * 0.22, fill: COLORS.ink }));
      defs.appendChild(pat); s.appendChild(defs);
      s.appendChild(svg("rect", { width: cfg.width, height: cfg.height, fill: "url(#overlayDots)" }));
      under.appendChild(s);
    }
    if (cfg.footageIsLight) {
      const g = el("div", "", {
        position: "absolute", left: "0", right: "0", bottom: "0", height: "42%",
        background: `linear-gradient(to bottom, ${withAlpha(COLORS.ink, 0)}, ${withAlpha(COLORS.ink, DECOR.gradientMaxOpacity)})`,
      });
      under.appendChild(g);
    }
  }

  // Create lightweight DOM pool
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
    applyState(pool, vis, cfg);
  };

  // Master GSAP timeline: single proxy tween driving the entire playback
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

// Pre-load font files
try {
  const ready: Promise<unknown>[] = [];
  for (const k of Object.keys(FONTS) as (keyof typeof FONTS)[]) {
    ready.push(document.fonts.load(`${FONTS[k].weight} 40px "${FONTS[k].family}"`));
  }
  void ready;
} catch { /* fonts API unavailable: harmless */ }

init();
export { ROLE_OPACITY };
