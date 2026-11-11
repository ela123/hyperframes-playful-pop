import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  AnimationStyle, AspectRatio, ConfigCaptionItem, EffectFamily, Intensity,
  PaletteConfig, Position, PresetName, Quality,
} from "../src/types.ts";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const P = {
  root: ROOT,
  assets: join(ROOT, "assets"),
  fonts: join(ROOT, "assets", "fonts"),
  rawWords: join(ROOT, "assets", "words.raw.json"),
  captions: join(ROOT, "assets", "captions.json"),
  measures: join(ROOT, "assets", "measures.json"),
  dist: join(ROOT, "dist"),
  out: join(ROOT, "out"),
  stills: join(ROOT, "out", "stills"),
  template: join(ROOT, "template", "index.html"),
};

export interface UserConfig {
  video: string;
  footageIsLight?: boolean;
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

export function loadUserConfig(): UserConfig {
  const f = join(ROOT, "pop.config.json");
  const base: UserConfig = {
    video: "assets/intro.mp4",
    footageIsLight: false,
    effect: "kinetic-pop",
    intensity: "subtle",
    position: "bottom",
    aspectRatio: "16:9",
    animationStyle: "default",
    fontSize: 1.0,
    maxWordsPerCaption: 4,
  };
  return existsSync(f) ? { ...base, ...JSON.parse(readFileSync(f, "utf8")) } : base;
}

export function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.split("=").slice(1).join("=") : fallback;
}
export const flag = (name: string): boolean => process.argv.includes(`--${name}`);

export function qualityArg(): Quality {
  const q = arg("quality", "final");
  if (q !== "preview" && q !== "final") throw new Error(`--quality must be preview|final (got ${q})`);
  return q;
}

export function probeDuration(file: string): number {
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file], { encoding: "utf8" });
  const d = parseFloat(out.trim());
  if (!isFinite(d)) throw new Error(`ffprobe could not read the duration of ${file}`);
  return d;
}

export function need(cmd: string, hint: string): void {
  try { execFileSync(cmd, ["-version"], { stdio: "ignore" }); }
  catch { throw new Error(`${cmd} not found. ${hint}`); }
}
