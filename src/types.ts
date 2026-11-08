// Shared types. No runtime code here (kept strip-types friendly).

export type Role = "hero" | "accent" | "normal" | "connector";
export type PresetName = "playful-pop" | "minimal-pro" | "cinematic" | "quiet-art";
export type Position = "bottom" | "center" | "top";
export type AspectRatio = "16:9" | "9:16" | "1:1";
export type AnimationStyle = "default" | "pop" | "subtle-fade" | "slide-up" | "scale-punch" | "static";

export type EntranceName =
  | "sticker-slap" | "spin-pop" | "jelly" | "drop-bounce" | "pop" | "wiggle-in" | "fade-pop"
  | "clean-fade" | "slide-fade-up" | "cinematic-drift" | "soft-rise";
export type EmphasisName =
  | "marker-highlight" | "wobble" | "squash-bounce" | "doodle-underline" | "star-burst"
  | "pill-highlight" | "cinematic-glow" | "accent-color" | "quiet-underline";
export type ColorName =
  | "ink" | "cream" | "pink" | "yellow" | "sky" | "mint" | "violet"
  | "slateDark" | "slateMedium" | "snowWhite" | "emeraldAccent" | "electricBlue" | "amberGold" | "mutedGray"
  | "obsidianDark" | "charcoalCard" | "platinumWhite" | "goldenAmber" | "champagne" | "cinematicTeal" | "deepCrimson"
  | "quietWhite" | "quietBackdrop" | "quietAmber" | "quietOchre" | "quietUnderline";
export type Quality = "preview" | "final";
export type DoodleKind = "star" | "sparkle" | "heart" | "squiggle" | "arrow" | "circle" | "zigzag";

/* ---------- captions.json (schema kept from the Remotion project) ---------- */
export interface CaptionWord { text: string; startMs: number; endMs: number; role?: Role }
export interface CaptionLine { words: CaptionWord[] }
export interface CaptionChunk { startMs: number; endMs: number; lines: CaptionLine[] }
export interface CaptionsFile { fps?: number; chunks?: CaptionChunk[]; words?: CaptionWord[] }

/* ---------- measurement (em units, so one measurement serves every size) ---------- */
export interface Measure { w: number; ascent: number; descent: number }
export type Measures = Record<string, Measure>;
export interface MeasureKey { key: string; family: string; weight: number; text: string }

/* ---------- config ---------- */
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
  preset: PresetName;
  position: Position;
  aspectRatio: AspectRatio;
  animationStyle: AnimationStyle;
  fontSizeMultiplier: number;
  fontOverride?: string;
  textColorOverride?: string;
  highlightColorOverride?: string;
  maxWordsPerCaption: number;
}

/* ---------- plan (everything the renderer needs, fully baked, JSON-safe) ---------- */
export interface Box { x: number; y: number; w: number; h: number }

export interface CountSpec { value: number; decimals: number; prefix: string; suffix: string; commas: boolean; tail: string }

export interface StarSpec { angle: number; dist: number; size: number; rot: number }

export interface WordPlan {
  id: string;
  text: string;            // as in captions.json
  display: string;         // after role casing
  role: Role;
  chunk: number;
  index: number;
  line: number;
  color: ColorName;        // fill/sticker color (cream for normal/connector)
  rot: number;             // resting rotation, degrees
  fontPx: number;
  ascentPx: number;
  descentPx: number;
  textW: number;
  box: Box;                // layout box (includes sticker padding)
  padX: number;
  padY: number;
  spokenStart: number;     // frames
  spokenEnd: number;       // frames, >= spokenStart + 6
  entrance: { name: EntranceName; start: number; dur: number };
  emphasis: EmphasisName[];
  emphStart: number;
  emphDur: number;
  count: CountSpec | null;
  seed: number;
  backPath: string;        // hero sticker blob path (local coords of box)
  backRot: number;         // local rotation of the sticker, degrees
  markerRot: number;
  underline: string;       // doodle underline path (local coords of box)
  underlineLen: number;
  stars: StarSpec[];
  wobbleSign: number;
}

export interface DoodleSpec {
  kind: DoodleKind; cx: number; cy: number; size: number; rot0: number; rotSpeed: number;
  color: ColorName; seed: number; floatAmp: number; phaseX: number; phaseY: number; popDelay: number;
}
export interface BurstSpec {
  word: string; cx: number; cy: number; size: number; color: ColorName; rot0: number; spin: number;
  start: number; path: string;
}
export interface ConfettiSpec {
  circle: boolean; w: number; h: number; color: ColorName; x0: number; y0: number; vx: number; vy: number;
  g: number; rot0: number; rotSpeed: number; delay: number; start: number; life: number;
}
export interface HalftoneSpec { cx: number; cy: number; rx: number; ry: number; color: ColorName; gap: number; dot: number }

export interface LinePlan { index: number; words: string[]; box: Box }

export interface ChunkPlan {
  index: number;
  startFrame: number;
  endFrame: number;        // frame (exclusive) after which nothing of the chunk is visible
  exitStart: number;
  exitDur: number;
  restFrames: number;      // margin between last entrance end and exit start
  fontScale: number;
  words: WordPlan[];
  lines: LinePlan[];
  bbox: Box;
  origin: { x: number; y: number };
  shakes: { frame: number; dx: number; dy: number }[];
  exitRots: number[];      // per line, degrees (+-8)
  doodles: DoodleSpec[];
  bursts: BurstSpec[];
  confetti: ConfettiSpec[];
  halftone: HalftoneSpec;
  notes: string[];
}

export interface Plan {
  config: PopConfig;
  chunks: ChunkPlan[];
  warnings: string[];
}
