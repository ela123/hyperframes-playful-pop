import type {
  AnimationStyle, AspectRatio, ConfigCaptionItem, EffectFamily, Intensity,
  PaletteConfig, PopConfig, Position, PresetName, Quality,
} from "./types.ts";
import { ASPECT_DIMENSIONS, EFFECT_FAMILIES, QUALITY, TIMING } from "./tokens.ts";

export const REF_W = 1920;
export const REF_H = 1080;

export interface ConfigInput {
  quality: Quality;
  video: string;
  footageIsLight?: boolean;
  durationSec: number;
  effect?: EffectFamily | PresetName;
  preset?: PresetName;
  intensity?: Intensity;
  position?: Position;
  aspectRatio?: AspectRatio;
  animationStyle?: AnimationStyle;
  fontSize?: number;
  font?: string;
  textColor?: string;
  highlightColor?: string;
  backdropColor?: string;
  palette?: PaletteConfig;
  maxWordsPerCaption?: number;
  captions?: ConfigCaptionItem[];
}

/** Map legacy preset names to the 5 curated effect templates */
export function normalizeEffect(name?: string): EffectFamily {
  if (!name) return "kinetic-pop";
  switch (name) {
    case "flicker-strobe":
    case "kinetic-pop":
    case "digital-decoder":
    case "speed-slide":
    case "typewriter-terminal":
      return name;
    case "cinematic":
      return "flicker-strobe";
    case "minimal-pro":
      return "speed-slide";
    case "quiet-art":
      return "typewriter-terminal";
    case "playful-pop":
    default:
      return "kinetic-pop";
  }
}

/** Resolves responsive dimensions, curated effect aesthetics, safe boundaries, and duration. */
export function resolveConfig(i: ConfigInput): PopConfig {
  const chosenEffect = normalizeEffect(i.effect || i.preset);
  const intensity: Intensity = i.intensity || "subtle";
  const position: Position = i.position || "bottom";
  const aspectRatio: AspectRatio = i.aspectRatio || "16:9";
  const animationStyle: AnimationStyle = i.animationStyle || "default";
  const fontSizeMultiplier = typeof i.fontSize === "number" && i.fontSize > 0 ? i.fontSize : 1.0;
  const maxWordsPerCaption = typeof i.maxWordsPerCaption === "number" && i.maxWordsPerCaption > 0 ? i.maxWordsPerCaption : 4;
  const footageIsLight = typeof i.footageIsLight === "boolean" ? i.footageIsLight : false;

  const dims = ASPECT_DIMENSIONS[aspectRatio] || ASPECT_DIMENSIONS["16:9"];
  const s = QUALITY[i.quality].renderScale;
  const width = Math.round(dims.width * s);
  const height = Math.round(dims.height * s);

  // Unit normalised to standard 1080p scale
  const unit = Math.min(width / dims.width, height / dims.height) * (dims.height / 1080);

  const textColor = i.textColor || i.palette?.text;
  const highlightColor = i.highlightColor || i.palette?.accent;
  const backdropColor = i.backdropColor || i.palette?.backdrop;

  return {
    video: i.video || "assets/intro.mp4",
    width,
    height,
    fps: TIMING.fps,
    quality: i.quality,
    footageIsLight,
    unit: Math.max(0.2, unit),
    compositionId: chosenEffect,
    durationFrames: Math.max(1, Math.ceil(i.durationSec * TIMING.fps)),
    effect: chosenEffect,
    preset: chosenEffect,
    intensity,
    position,
    aspectRatio,
    animationStyle,
    fontSizeMultiplier,
    fontOverride: i.font && i.font !== "default" ? i.font : undefined,
    textColorOverride: textColor && textColor !== "default" ? textColor : undefined,
    highlightColorOverride: highlightColor && highlightColor !== "default" ? highlightColor : undefined,
    backdropColorOverride: backdropColor && backdropColor !== "default" ? backdropColor : undefined,
    maxWordsPerCaption,
    captions: i.captions,
  };
}
