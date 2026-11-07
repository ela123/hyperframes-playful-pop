import type { AnimationStyle, AspectRatio, PopConfig, Position, PresetName, Quality } from "./types.ts";
import { ASPECT_DIMENSIONS, QUALITY, TIMING } from "./tokens.ts";

export const REF_W = 1920;
export const REF_H = 1080;

export interface ConfigInput {
  quality: Quality;
  video: string;
  footageIsLight: boolean;
  durationSec: number;
  preset?: PresetName;
  position?: Position;
  aspectRatio?: AspectRatio;
  animationStyle?: AnimationStyle;
  fontSize?: number;
  font?: string;
  textColor?: string;
  highlightColor?: string;
  maxWordsPerCaption?: number;
}

/** Resolves responsive dimensions, preset aesthetics, safe boundaries, and duration. */
export function resolveConfig(i: ConfigInput): PopConfig {
  const preset: PresetName = i.preset || "playful-pop";
  const position: Position = i.position || "bottom";
  const aspectRatio: AspectRatio = i.aspectRatio || "16:9";
  const animationStyle: AnimationStyle = i.animationStyle || "default";
  const fontSizeMultiplier = typeof i.fontSize === "number" && i.fontSize > 0 ? i.fontSize : 1.0;
  const maxWordsPerCaption = typeof i.maxWordsPerCaption === "number" && i.maxWordsPerCaption > 0 ? i.maxWordsPerCaption : 6;

  const dims = ASPECT_DIMENSIONS[aspectRatio] || ASPECT_DIMENSIONS["16:9"];
  const s = QUALITY[i.quality].renderScale;
  const width = Math.round(dims.width * s);
  const height = Math.round(dims.height * s);

  // Unit normalised to standard 1080p scale
  const unit = (Math.min(width / dims.width, height / dims.height) * (dims.height / 1080));

  return {
    video: i.video,
    width,
    height,
    fps: TIMING.fps,
    quality: i.quality,
    footageIsLight: i.footageIsLight,
    unit: Math.max(0.2, unit),
    compositionId: "playful-pop",
    durationFrames: Math.max(1, Math.ceil(i.durationSec * TIMING.fps)),
    preset,
    position,
    aspectRatio,
    animationStyle,
    fontSizeMultiplier,
    fontOverride: i.font && i.font !== "default" ? i.font : undefined,
    textColorOverride: i.textColor && i.textColor !== "default" ? i.textColor : undefined,
    highlightColorOverride: i.highlightColor && i.highlightColor !== "default" ? i.highlightColor : undefined,
    maxWordsPerCaption,
  };
}
