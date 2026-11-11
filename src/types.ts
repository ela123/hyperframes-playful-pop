// Shared types for the refactored, simplified, artistic caption engine.
// Deterministic, strip-types friendly, zero bloat.

export type Role = "hero" | "accent" | "normal" | "connector";

export type EffectFamily =
  | "flicker-strobe"
  | "kinetic-pop"
  | "digital-decoder"
  | "speed-slide"
  | "typewriter-terminal";

// Backwards-compatible preset alias
export type PresetName = EffectFamily | "playful-pop" | "minimal-pro" | "cinematic" | "quiet-art";

export type Intensity = "subtle" | "medium" | "bold";
export type Position = "bottom" | "center" | "top";
export type AspectRatio = "16:9" | "9:16" | "1:1";
export type AnimationStyle = "default" | "subtle-fade" | "slide-up" | "scale-punch" | "static";

export type EntranceName =
  | "flicker-strobe"
  | "kinetic-pop"
  | "digital-decoder"
  | "speed-slide"
  | "typewriter-terminal"
  | "clean-fade"
  | "soft-rise"
  // Legacy aliases
  | "sticker-slap" | "spin-pop" | "jelly" | "drop-bounce" | "pop" | "wiggle-in" | "fade-pop"
  | "slide-fade-up" | "cinematic-drift";

export type EmphasisName =
  | "accent-color"
  | "soft-glow"
  | "decoder-glitch"
  | "pop-overshoot"
  | "cursor-blink"
  | "pill-highlight"
  // Legacy aliases
  | "marker-highlight" | "wobble" | "squash-bounce" | "doodle-underline" | "star-burst"
  | "cinematic-glow" | "quiet-underline";

export type ColorName =
  | "canvasText" | "canvasBackdrop" | "canvasAccent"
  | "accentEmerald" | "accentTeal" | "accentRose" | "accentBlue"
  | "canvasMuted" | "canvasBorder"
  // Legacy color names mapped to palette
  | "ink" | "cream" | "pink" | "yellow" | "sky" | "mint" | "violet"
  | "slateDark" | "slateMedium" | "snowWhite" | "emeraldAccent" | "electricBlue" | "amberGold" | "mutedGray"
  | "obsidianDark" | "charcoalCard" | "platinumWhite" | "goldenAmber" | "champagne" | "cinematicTeal" | "deepCrimson"
  | "quietWhite" | "quietBackdrop" | "quietAmber" | "quietOchre" | "quietUnderline";

export type Quality = "preview" | "final";

/* ---------- captions.json or in-config captions ---------- */
export interface CaptionWord { text: string; startMs: number; endMs: number; role?: Role }
export interface CaptionLine { words: CaptionWord[] }
export interface CaptionChunk { startMs: number; endMs: number; lines: CaptionLine[] }
export interface CaptionsFile { fps?: number; chunks?: CaptionChunk[]; words?: CaptionWord[] }

export interface ConfigCaptionItem {
  text: string;
  startMs: number;
  endMs: number;
  hero?: string;
}

/* ---------- measurement (em units) ---------- */
export interface Measure { w: number; ascent: number; descent: number }
export type Measures = Record<string, Measure>;
export interface MeasureKey { key: string; family: string; weight: number; text: string }

/* ---------- config ---------- */
export interface PaletteConfig {
  text?: ColorName | string;
  backdrop?: ColorName | string;
  accent?: ColorName | string;
}

export interface PopConfig {
  video: string;
  width: number;
  height: number;
  fps: number;
  quality: Quality;
  footageIsLight: boolean;
  unit: number;
  compositionId: string;
  durationFrames: number;
  effect: EffectFamily;
  preset: PresetName; // normalized to effect
  intensity: Intensity;
  position: Position;
  aspectRatio: AspectRatio;
  animationStyle: AnimationStyle;
  fontSizeMultiplier: number;
  fontOverride?: string;
  textColorOverride?: string;
  highlightColorOverride?: string;
  backdropColorOverride?: string;
  maxWordsPerCaption: number;
  captions?: ConfigCaptionItem[];
}

/* ---------- plan (fully baked, JSON-safe) ---------- */
export interface Box { x: number; y: number; w: number; h: number }
export interface CountSpec { value: number; decimals: number; prefix: string; suffix: string; commas: boolean; tail: string }
export interface StarSpec { angle: number; dist: number; size: number; rot: number }

export interface WordPlan {
  id: string;
  text: string;
  display: string;
  role: Role;
  chunk: number;
  index: number;
  line: number;
  color: ColorName;
  rot: number;             // always 0 in the new artistic design (no tilted text)
  fontPx: number;
  ascentPx: number;
  descentPx: number;
  textW: number;
  box: Box;
  padX: number;
  padY: number;
  spokenStart: number;     // frames
  spokenEnd: number;       // frames
  entrance: { name: EntranceName; start: number; dur: number };
  emphasis: EmphasisName[];
  emphStart: number;
  emphDur: number;
  count: CountSpec | null;
  seed: number;
  backPath: string;
  backRot: number;
  markerRot: number;
  underline: string;
  underlineLen: number;
  stars: StarSpec[];
  wobbleSign: number;
}

export type DoodleKind = "star" | "sparkle" | "heart" | "squiggle" | "arrow" | "circle" | "zigzag";
export interface DoodleSpec {
  kind: DoodleKind; cx: number; cy: number; size: number; rot0: number; rotSpeed: number;
  color: ColorName; seed: number; floatAmp: number; phaseX: number; phaseY: number; popDelay: number;
}
export interface BurstSpec { cx: number; cy: number; size: number; color: ColorName; startFrame: number }
export interface ConfettiSpec { x: number; y0: number; vx: number; vy0: number; rot0: number; vRot: number; w: number; h: number; color: ColorName }
export interface HalftoneSpec { cx: number; cy: number; rx: number; ry: number; rot: number; color: ColorName; seed: number }

export interface ChunkPlan {
  index: number;
  startFrame: number;
  endFrame: number;
  exitStart: number;
  exitDur: number;
  restFrames: number;
  fontScale: number;
  words: WordPlan[];
  lines: { index: number; words: string[]; box: Box }[];
  bbox: Box;
  origin: { x: number; y: number };
  shakes: { frame: number; dx: number; dy: number }[];
  exitRots: number[];
  doodles: DoodleSpec[];
  bursts: BurstSpec[];
  confetti: ConfettiSpec[];
  halftone: HalftoneSpec | null;
  notes: string[];
}

export interface Plan {
  config: PopConfig;
  chunks: ChunkPlan[];
  warnings: string[];
}
