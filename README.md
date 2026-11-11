# HyperFrames Minimal & Artistic Caption Engine

> **Design Philosophy**: Viewers should remember the video's content, not the editing. Effects must support the message, never compete with it.

A lightweight, distraction-free kinetic caption engine built for HyperFrames and GSAP. Clean, elegant, high-contrast typography designed so text settles into stillness, remaining 100% readable for the vast majority of its screen time.

---

## 5 Curated Effect Templates

Pick one effect template in `pop.config.json` via the `"effect"` field:

| Template | Effect Family | Best Used For | Behavior & Anti-Distraction Rule |
|---|---|---|---|
| **`kinetic-pop`** *(Default)* | Kinetic & Punchy Pop | Key words, verbs, punchlines | Smooth spring scale-overshoot (`1.08x`) settling into stillness in $\le 0.25\text{s}$ with a soft natural drop shadow. |
| **`flicker-strobe`** | Flicker & Strobe | Intros, mood setting, hooks | Gentle 2–3 beat warm neon flicker with eased opacity and subtle ambient glow, resolving to steady light. Never harsh. |
| **`digital-decoder`** | Digital Glitch & Decoder | Tech terms, data, reveals | Micro horizontal RGB-split and high-tech character glyph scramble that resolves cleanly to the final word in $< 0.25\text{s}$. |
| **`speed-slide`** | Directional Blur & Speed Slides | Transitions, titles, scene shifts | Motion-blurred directional slide-in with cubic ease-out deceleration, settling into a crisp line with consistent direction. |
| **`typewriter-terminal`** | Typewriter & Code Terminal | Coding, quotes, intimate stories | Monospace typography typed with human timing cadence, a subtle scanline/card frame, and a soft blinking cursor. |

---

## Single Configuration File (`pop.config.json`)

All captions, timings, effect choices, intensity, and styling are controlled from one unified file. You never have to touch engine code to customize a video.

```json
{
  "video": "assets/intro.mp4",
  "effect": "kinetic-pop",
  "intensity": "subtle",
  "position": "bottom",
  "aspectRatio": "16:9",
  "fontSize": 1.0,
  "maxWordsPerCaption": 4,
  "font": "default",
  "palette": {
    "text": "canvasText",
    "backdrop": "canvasBackdrop",
    "accent": "canvasAccent"
  }
}
```

### Options

* **`effect`**: `"kinetic-pop"` \| `"flicker-strobe"` \| `"digital-decoder"` \| `"speed-slide"` \| `"typewriter-terminal"`.
* **`intensity`**: `"subtle"` *(default)* \| `"medium"` \| `"bold"`
  * `subtle`: Minimal displacement, gentle spring (`1.07x`), softest flicker.
  * `medium`: Balanced spring overshoot (`1.13x`), 3-beat flicker, standard slide.
  * `bold`: Higher-contrast emphasis (`1.20x`) for high-energy punchlines.
* **`position`**: `"bottom"` \| `"center"` \| `"top"` (default: `"bottom"`).
* **`aspectRatio`**: `"16:9"` (1920x1080) \| `"9:16"` (Shorts / Reels / TikTok) \| `"1:1"` (Square).
* **`maxWordsPerCaption`**: Default `4` words for maximum visual breathing room and readability.

---

## How to Change Captions

You have two simple ways to change the text:

### Option A: Directly in `pop.config.json` (Recommended for Quick Edits)
Add an inline `"captions"` array directly into `pop.config.json`:

```json
{
  "video": "assets/intro.mp4",
  "effect": "kinetic-pop",
  "captions": [
    { "text": "Twenty years ago", "startMs": 300, "endMs": 1800, "hero": "Twenty" },
    { "text": "I built my first company", "startMs": 1900, "endMs": 3400, "hero": "first" },
    { "text": "in a tiny garage.", "startMs": 3500, "endMs": 4800, "hero": "garage" }
  ]
}
```
* **`text`**: The words spoken.
* **`startMs` / `endMs`**: When the caption appears and exits.
* **`hero`**: *(Optional)* The single key word that receives the curated effect.

### Option B: Automatic Transcription
If `"captions"` is omitted from `pop.config.json`, the engine automatically reads `assets/captions.json` generated from Whisper:
```bash
npm run transcribe   # transcribes assets/intro.mp4 to assets/words.raw.json
npm run analyze      # formats words into role-tagged chunks in assets/captions.json
```

---

## Anti-Distraction Rules Enforced

1. **Strict 0.15s – 0.4s Settle Window**: All effects finish their entrance transition in $\le 0.4\text{s}$. Once settled, text remains completely still.
2. **Max 1 Effect Per Caption**: Effects apply only to the emphasis moment (`hero`). Normal and connector words fade in quietly (`clean-fade`) without competing for attention.
3. **Cohesive 3-Color Palette**: 2 main colors (`#FAF8F5` soft cream text, `#11141A` translucent backdrop) and 1 refined accent (`#E5A83B` golden amber). Zero multi-color rainbow cycling.
4. **Safe Margin Positioning**: Captions are bounded away from the edges and never cover speaker faces.

---

## Workflow Commands

| Command | Description |
|---|---|
| `npm test` | Runs the test suite (16 tests, anti-distraction rules & 34-min benchmark) |
| `npm run check:static` | Runs static determinism, grep checks, and font verification |
| `npm run build` | Compiles self-contained composition to `dist/index.html` |
| `npm run preview` | Fast draft preview render $\to$ `out/preview.mp4` |
| `npm run render` | High-quality production render $\to$ `out/final.mp4` |
| `npm run dev` | Live interactive browser preview with scrubbing |
