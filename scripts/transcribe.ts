// video -> assets/words.raw.json with WORD-level timestamps (never interpolated from SRT cues).
//   --provider openai  (default if OPENAI_API_KEY is set)  Whisper API, timestamp_granularities=word
//   --provider local   faster-whisper via scripts/transcribe_local.py (free, offline, `pip install faster-whisper`)
//   --srt              also write assets/words.srt (convenience only; the renderer never reads it)
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { arg, flag, loadUserConfig, need, P, ROOT } from "./common.ts";

interface RawWord { text: string; startMs: number; endMs: number }

async function viaOpenAI(wav: string): Promise<RawWord[]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set (or use --provider local)");
  const form = new FormData();
  form.append("file", new Blob([readFileSync(wav)]), "audio.wav");
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
  if (!res.ok) throw new Error(`Whisper API ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as { words?: { word: string; start: number; end: number }[] };
  if (!j.words?.length) throw new Error("Whisper API returned no word timestamps");
  return j.words.map((w) => ({ text: w.word.trim(), startMs: Math.round(w.start * 1000), endMs: Math.round(w.end * 1000) }));
}

function viaLocal(wav: string): RawWord[] {
  const model = arg("model", "small.en")!;
  const out = execFileSync("python3", [join(ROOT, "scripts", "transcribe_local.py"), wav, model], { encoding: "utf8", maxBuffer: 1 << 26 });
  return JSON.parse(out) as RawWord[];
}

const ts = (ms: number): string => {
  const p = (n: number, l = 2): string => String(n).padStart(l, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};

async function main(): Promise<void> {
  need("ffmpeg", "Install FFmpeg (https://ffmpeg.org).");
  const video = join(P.root, arg("video", loadUserConfig().video)!);
  const wav = join(mkdtempSync(join(tmpdir(), "pop-")), "audio.wav");
  execFileSync("ffmpeg", ["-y", "-i", video, "-vn", "-ac", "1", "-ar", "16000", wav], { stdio: "ignore" });
  const provider = arg("provider", process.env.OPENAI_API_KEY ? "openai" : "local");
  const words = provider === "openai" ? await viaOpenAI(wav) : viaLocal(wav);
  writeFileSync(P.rawWords, JSON.stringify({ provider, words }, null, 2) + "\n");
  console.log(`${words.length} words (${provider}) -> ${P.rawWords}`);
  if (flag("srt")) {
    const srt = words.map((w, i) => `${i + 1}\n${ts(w.startMs)} --> ${ts(w.endMs)}\n${w.text}\n`).join("\n");
    writeFileSync(P.rawWords.replace("words.raw.json", "words.srt"), srt);
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
